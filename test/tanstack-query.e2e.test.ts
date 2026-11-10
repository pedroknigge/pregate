import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { removeTree } from "./remove-tree.ts";

// The compiled entrypoint: scan, check, and hook see the same TanStack Query pack a repository does.
const cli = join(import.meta.dir, "../src/main.ts");
const area = mkdtempSync(join(tmpdir(), "pregate-tanstack-query-"));
afterAll(() => removeTree(area));

const stringKey = `import { useQuery } from "@tanstack/react-query";

export function Todos() {
  return useQuery({ queryKey: "todos", queryFn: fetchTodos });
}
`;
const arrayKey = `import { useQuery } from "@tanstack/react-query";

export function Todos({ id }: { id: string }) {
  return useQuery({ queryKey: ["todos", id], queryFn: () => fetchTodo(id) });
}
`;
const clientInRender = `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}><div /></QueryClientProvider>;
}
`;
const stableClient = `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function App() {
  return <QueryClientProvider client={queryClient}><div /></QueryClientProvider>;
}
`;

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, "machine");
  mkdirSync(root, { recursive: true });
  const env = {
    ...process.env,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(machine, "home"),
    USERPROFILE: join(machine, "home"),
    XDG_DATA_HOME: join(machine, "data"),
    XDG_STATE_HOME: join(machine, "state"),
    XDG_CONFIG_HOME: join(machine, "config"),
    CODEX_HOME: join(machine, "codex"),
    GROK_HOME: join(machine, "grok"),
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 45_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  const hook = (event: string, sid: string, fields: object = {}) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: event,
    permission_mode: "acceptEdits", prompt_id: "turn", ...fields,
  }));
  return { root, put, run, git, hook };
}

function scan(name: string, files: Record<string, string>) {
  const root = join(area, name);
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  const env = { ...process.env, CI: "1" };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  git("init", "-q");
  git("add", "-A");
  const out = Bun.spawnSync([process.execPath, cli, "scan", "--json"], {
    cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  if (out.signalCode) throw new Error(`scan terminated: ${out.signalCode}\n${out.stderr.toString()}`);
  return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
}

function queryPack(stdout: string) {
  const body = JSON.parse(stdout) as { recommendations: { ns: string }[] };
  return body.recommendations.find((item) => item.ns === "tanstack-query");
}

test("the tanstack-query pack fixtures pass through the CLI", () => {
  const root = project("fixtures");
  const tested = root.run(["rules", "test", "--library", "tanstack-query"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   tanstack-query/keys/no-non-array-query-key");
  expect(tested.text).toContain("ok   tanstack-query/client/no-query-client-in-render");
}, 60_000);

test("scan --json recommends tanstack-query for a project that depends on it", () => {
  const result = scan("app", {
    "package.json": '{"name":"app","dependencies":{"@tanstack/react-query":"^5.59.0"}}\n',
    "src/todos.tsx": arrayKey,
  });
  expect(result.code, result.text).toBe(0);
  expect(queryPack(result.stdout)).toMatchObject({
    ns: "tanstack-query",
    methodologies: ["tanstack-query/keys", "tanstack-query/client"],
    reasons: ["package.json declares @tanstack/react-query"],
    scope: { include: ["**"], exclude: [] },
  });
}, 90_000);

test("scan --json ignores TanStack Query under docs, examples, fixtures, and devDependencies", () => {
  const absent = (name: string, files: Record<string, string>) => {
    const result = scan(name, files);
    expect(result.code, result.text).toBe(0);
    expect(queryPack(result.stdout), name).toBeUndefined();
  };
  absent("docs-site", {
    "docs/package.json": '{"dependencies":{"@tanstack/react-query":"^5.0.0"}}\n',
    "docs/src/App.tsx": stringKey,
  });
  absent("examples-tree", {
    "examples/query/package.json": '{"dependencies":{"@tanstack/vue-query":"^5.0.0"}}\n',
    "examples/query/src/App.tsx": stringKey,
  });
  absent("fixtures-tree", {
    "fixtures/query/package.json": '{"dependencies":{"@tanstack/svelte-query":"^5.0.0"}}\n',
    "fixtures/query/src/list.ts": 'export const queryKey = "todos";\n',
  });
  absent("dev-dependency", {
    "package.json": '{"name":"app","devDependencies":{"@tanstack/react-query":"^5.0.0"}}\n',
    "src/todos.tsx": stringKey,
  });
  absent("mention-only", {
    "package.json": '{"name":"app"}\n',
    "src/todos.tsx": stringKey,
  });
  const kept = scan("primary-app", {
    "apps/web/package.json": '{"dependencies":{"@tanstack/solid-query":"^5.0.0"}}\n',
    "apps/web/src/todos.tsx": arrayKey,
    "docs/package.json": '{"dependencies":{"@tanstack/react-query":"^5.0.0"}}\n',
    "examples/package.json": '{"dependencies":{"@tanstack/vue-query":"^5.0.0"}}\n',
    "fixtures/package.json": '{"dependencies":{"@tanstack/angular-query":"^5.0.0"}}\n',
  });
  expect(kept.code, kept.text).toBe(0);
  expect(queryPack(kept.stdout)).toMatchObject({
    reasons: ["apps/web/package.json declares @tanstack/solid-query"],
    scope: { include: ["apps/web/**"], exclude: [] },
  });
}, 90_000);

test("hook and check deny a string query key and a QueryClient created in render, and allow the documented forms", () => {
  const p = project("gate");
  p.put("package.json", '{ "name": "sample", "dependencies": { "@tanstack/react-query": "^5.59.0" } }\n');
  p.put("src/ok.tsx", "export const ready = true;\n");
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  const added = p.run(["pack", "add", "--library", "tanstack-query", "--yes"]);
  expect(added.code, added.text).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the TanStack Query rules in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");

  const deniedKey = p.run(["check", "--stdin", "--path", "src/todos.tsx"], stringKey);
  expect(deniedKey.code, deniedKey.text).toBe(1);
  expect(deniedKey.text).toContain("tanstack-query/TQ-KEY-001");
  expect(deniedKey.text).toContain("['todos', id]");

  const deniedClient = p.run(["check", "--stdin", "--path", "src/main.tsx"], clientInRender);
  expect(deniedClient.code, deniedClient.text).toBe(1);
  expect(deniedClient.text).toContain("tanstack-query/TQ-CLIENT-001");
  expect(deniedClient.text).toContain("useState");

  const allowedKey = p.run(["check", "--stdin", "--path", "src/todos.tsx"], arrayKey);
  expect(allowedKey.code, allowedKey.text).toBe(0);
  expect(allowedKey.text).not.toContain("TQ-KEY-001");

  const allowedClient = p.run(["check", "--stdin", "--path", "src/main.tsx"], stableClient);
  expect(allowedClient.code, allowedClient.text).toBe(0);
  expect(allowedClient.text).not.toContain("TQ-CLIENT-001");

  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const deniedHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "string-key", tool_input: { file_path: join(p.root, "src/todos.tsx"), content: stringKey },
  });
  expect(deniedHook.code, deniedHook.text).toBe(2);
  expect(JSON.parse(deniedHook.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(deniedHook.text).toContain("tanstack-query/TQ-KEY-001");

  const clientHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "client", tool_input: { file_path: join(p.root, "src/main.tsx"), content: clientInRender },
  });
  expect(clientHook.code, clientHook.text).toBe(2);
  expect(JSON.parse(clientHook.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(clientHook.text).toContain("tanstack-query/TQ-CLIENT-001");

  const allowedHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "array-key", tool_input: { file_path: join(p.root, "src/todos.tsx"), content: arrayKey },
  });
  expect(allowedHook.code, allowedHook.text).toBe(0);
  expect(allowedHook.text).not.toContain("TQ-KEY-001");
  expect(allowedHook.text).not.toContain("TQ-CLIENT-001");

  const quiet = project("without-pack");
  quiet.put("package.json", '{ "name": "sample" }\n');
  quiet.put("src/ok.tsx", "export const ready = true;\n");
  quiet.git("init", "-q");
  expect(quiet.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  quiet.git("add", "-A");
  quiet.git("commit", "-qm", "baseline");
  const unselected = quiet.run(["check", "--stdin", "--path", "src/todos.tsx"], stringKey);
  expect(unselected.code, unselected.text).toBe(0);
  expect(unselected.text).not.toContain("TQ-KEY-001");
  const unselectedClient = quiet.run(["check", "--stdin", "--path", "src/main.tsx"], clientInRender);
  expect(unselectedClient.code, unselectedClient.text).toBe(0);
  expect(unselectedClient.text).not.toContain("TQ-CLIENT-001");
}, 120_000);
