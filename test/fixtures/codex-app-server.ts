import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// A stand-in for `codex app-server` 0.159.2, the three methods MH-24 uses, over JSON-RPC lines on
// stdio. It keeps the rules harness-codex-live §1 verified: a user hook's key is
// <file>:<event_snake>:<group>:<hook>, its hash depends only on its content, and its trust is
// `[hooks.state."<key>"] trusted_hash` in config.toml, so a hook that changes or moves index stops
// being trusted. `codex trust-all` (fake only) approves every listed hook, as the user does in /hooks.
// CODEX_FAKE_REFUSE_TRUST=1 accepts the batchWrite and does not record it, so the next list still
// says the PREGATE hooks are untrusted. Foreign trust that was already recorded stays.

type Hook = { key: string; trustStatus: string; currentHash: string };

const HOME = process.env.CODEX_HOME!;
const FILE = `${HOME}/hooks.json`;
const CONFIG = `${HOME}/config.toml`;
// The setup client reads one JSON line at a time and does not exit. A block-buffered stdout
// would sit on that read until the 60 s kill.
const out = Bun.stdout.writer();
const emit = (line: string): void => {
  out.write(line);
  out.flush();
};
const SNAKE: Record<string, string> = { PreToolUse: "pre_tool_use", Stop: "stop", SessionStart: "session_start" };
const STATE = /^\[hooks\.state\."([^"]+)"\]\ntrusted_hash = "([^"]*)"\n?/gm;

const text = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

function trusted(): Map<string, string> {
  return new Map([...text(CONFIG).matchAll(STATE)].map((m) => [m[1]!, m[2]!]));
}

function list(): Hook[] {
  const hooks = (JSON.parse(text(FILE) || "{}") as { hooks?: Record<string, { matcher?: string; hooks?: object[] }[]> }).hooks ?? {};
  const state = trusted();
  return Object.entries(hooks).flatMap(([event, groups]) => groups.flatMap((g, i) => (g.hooks ?? []).map((h, j) => {
    const key = `${FILE}:${SNAKE[event] ?? event}:${i}:${j}`;
    const currentHash = `sha256:${createHash("sha256").update(JSON.stringify([event, g.matcher ?? null, h])).digest("hex")}`;
    const t = state.get(key);
    return { key, currentHash, trustStatus: t === undefined ? "untrusted" : t === currentHash ? "trusted" : "modified" };
  })));
}

function trust(value: Record<string, { trusted_hash: string }>): void {
  if (process.env.CODEX_FAKE_REFUSE_TRUST === "1") return;
  let config = text(CONFIG).replace(STATE, (block, key: string) => (key in value ? "" : block));
  for (const [key, { trusted_hash }] of Object.entries(value)) config += `[hooks.state."${key}"]\ntrusted_hash = "${trusted_hash}"\n`;
  writeFileSync(CONFIG, config);
}

function answer(method: string, params: Record<string, unknown>): unknown {
  if (method === "initialize") return { userAgent: "codex-fake" };
  if (method === "hooks/list") return { data: [{ cwd: null, hooks: list() }] };
  const [edit] = params.edits as { keyPath: string; mergeStrategy: string; value: Record<string, { trusted_hash: string }> }[];
  if (method !== "config/batchWrite" || edit?.keyPath !== "hooks.state" || edit.mergeStrategy !== "upsert") throw new Error(`unsupported ${method}`);
  trust(edit.value);
  return {};
}

if (process.argv[2] === "trust-all") {
  trust(Object.fromEntries(list().map((h) => [h.key, { trusted_hash: h.currentHash }])));
} else if (process.argv[2] === "app-server") {
  let buffer = "";
  for await (const chunk of Bun.stdin.stream()) {
    buffer += new TextDecoder().decode(chunk);
    for (let i = buffer.indexOf("\n"); i >= 0; i = buffer.indexOf("\n")) {
      const m = JSON.parse(buffer.slice(0, i)) as { id?: number; method: string; params: Record<string, unknown> };
      buffer = buffer.slice(i + 1);
      if (m.method === process.env.CODEX_FAKE_DIE_ON) process.exit(1);
      if (m.id === undefined) continue;
      try {
        emit(`${JSON.stringify({ jsonrpc: "2.0", id: m.id, result: answer(m.method, m.params) })}\n`);
      } catch (e) {
        emit(`${JSON.stringify({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: String(e) } })}\n`);
      }
    }
  }
} else {
  process.exit(2);
}
