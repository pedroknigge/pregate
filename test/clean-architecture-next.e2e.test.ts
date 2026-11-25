import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

// Compiled CLI on a small Next.js tree whose layer map still calls src/app core,
// which is the saved map behind issue 158.
setDefaultTimeout(180_000);
const area = mkdtempSync(join(tmpdir(), "pregate-ca-next-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => engineAt(binary, true), 180_000);
afterAll(() => removeTree(area));

const ROUTE = "src/app/api/admin/position-access/external/[kind]/route.ts";
const ROUTE_SOURCE = "import { NextResponse } from 'next/server';\nexport function GET() {\n  return NextResponse.json({ ok: true });\n}\n";
const CORE_SOURCE = "import { NextResponse } from 'next/server';\nexport function policy() {\n  return NextResponse.json({ ok: true });\n}\n";
const MODULE_SOURCE = "import { NextResponse } from 'next/server';\nexport function createOrder() {\n  return NextResponse.json({ ok: true });\n}\n";

function releasedCapture<T>(capture: string, descriptors: number[], body: () => T): T {
  try { return body(); } finally {
    for (const fd of descriptors) closeSync(fd);
    removeTree(capture);
  }
}

test("issue 158: the compiled CLI allows next/server in an API route and denies it in core", () => {
  const root = join(area, "app");
  mkdirSync(root);
  const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"), XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"), CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const capture = mkdtempSync(join(area, "capture-")), descriptors: number[] = [];
    const opened = (name: string, flags: string) => {
      const fd = openSync(join(capture, name), flags);
      descriptors.push(fd);
      return fd;
    };
    return releasedCapture(capture, descriptors, () => {
      if (input !== undefined) writeFileSync(join(capture, "stdin"), input);
      const out = spawnSync(binary, args, { cwd: root, env,
        stdio: [input === undefined ? "ignore" : opened("stdin", "r"), opened("stdout", "w"), opened("stderr", "w")], timeout: 30000 });
      const text = readFileSync(join(capture, "stdout"), "utf8"), error = readFileSync(join(capture, "stderr"), "utf8");
      if (out.error || out.signal) throw new Error(`Candidate command ${JSON.stringify(args)} failed: ${out.error?.message ?? out.signal}\nstdout:\n${text}\nstderr:\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code, preview.text + preview.error).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
    const applied = run(["approve", "--yes", "--digest", digest]);
    expect(applied.code, applied.text + applied.error).toBe(0);
  };
  put("package.json", JSON.stringify({ name: "next-fixture", private: true, dependencies: { next: "15.5.9" } }) + "\n");
  put("tsconfig.json", JSON.stringify({ compilerOptions: { strict: true } }) + "\n");
  put(ROUTE, ROUTE_SOURCE);
  put("src/core/policy.ts", "export function policy() { return 1; }\n");
  put("src/domain/order.ts", "export const id = 1;\n");
  put("src/app/orders/create-order.ts", "export function createOrder() { return 1; }\n");
  expect(spawnSync("git", ["init", "-q"], { cwd: root, env }).status).toBe(0);

  approve(["init", "--preview", "--preset", "backend-clean-ddd"]);
  put(".pregate/requests/layers.json", JSON.stringify({
    why: "Keep the Next.js app router classified as core, which is the saved map that flagged route handlers.",
    patch: [
      { op: "replace", path: "/enforcement", value: "enforce" },
      { op: "replace", path: "/layers", value: {
        domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
        app: { paths: ["src/app/**"], mayImport: ["domain"], kind: "core" },
        core: { paths: ["src/core/**"], mayImport: [], kind: "core" },
      } },
    ],
  }));
  const applied = run(["preset", "apply", ".pregate/requests/layers.json", "--yes"]);
  expect(applied.code, applied.text + applied.error).toBe(0);

  const route = run(["check", "--stdin", "--path", ROUTE], ROUTE_SOURCE);
  expect(route.text + route.error).not.toContain("architecture/CA-DEP-002");
  expect(route.code, route.text + route.error).toBe(0);

  const core = run(["check", "--stdin", "--path", "src/core/policy.ts"], CORE_SOURCE);
  expect(core.code, core.text + core.error).toBe(1);
  expect(core.text).toContain("architecture/CA-DEP-002");
  expect(core.text).toContain("next/server");

  const domain = run(["check", "--stdin", "--path", "src/domain/order.ts"], CORE_SOURCE);
  expect(domain.text).toContain("architecture/CA-DEP-002");

  const moduleInApp = run(["check", "--stdin", "--path", "src/app/orders/create-order.ts"], MODULE_SOURCE);
  expect(moduleInApp.text).toContain("architecture/CA-DEP-002");
});
