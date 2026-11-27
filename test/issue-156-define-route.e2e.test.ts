import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 156: defineRoute already awaited params, and a destructured await is resolved.
// The compiled CLI must leave those reads alone and still deny a real sync read.
setDefaultTimeout(120_000);
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-issue-156-"));
afterAll(() => removeTree(area));

const reported = `import { defineRoute } from "@/kernel/app/define-route";

export const GET = defineRoute({
  handler: async ({ params }) => {
    const kind = params.kind;
    return Response.json({ kind });
  },
});
`;

const destructured = `export async function GET(_request: Request, props: Promise<{ params: { id: string } }>) {
  const { params } = await props;
  return Response.json({ id: params.id });
}

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({ id });
}
`;

const syncRoute = `export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return Response.json({ id: params.id });
}
`;

const beside = `import { defineRoute } from "@/kernel/app/define-route";

export const GET = defineRoute({
  handler: async ({ params }) => {
    return Response.json({ kind: params.kind });
  },
});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return Response.json({ id: params.id });
}
`;

const unawaited = `export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { params } = props;
  return Response.json({ id: params.id });
}
`;

const forwarded = `export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const read = (params: Promise<{ id: string }>) => params.id;
  return Response.json({ id: read(params) });
}
`;

function project(name: string) {
  const root = join(area, name);
  mkdirSync(root, { recursive: true });
  const env = {
    ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(area, "home"), USERPROFILE: join(area, "home"),
    XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
    CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 45_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, text: out.stdout.toString() + out.stderr.toString() };
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  return { root, put, run, git };
}

test("issue 156 segment fixtures pass through the compiled CLI", () => {
  const root = project("rules");
  const tested = root.run(["rules", "test", "--library", "nextjs"]);
  expect(tested.code, tested.text).toBe(0);
  for (const line of [
    "nextjs/data/no-sync-segment-params pass/define-route",
    "nextjs/data/no-sync-segment-params pass/define-route-forms",
    "nextjs/data/no-sync-segment-params pass/destructured-await",
    "nextjs/data/no-sync-segment-params fail/sync-beside-define-route",
    "nextjs/data/no-sync-segment-params fail/unawaited-destructure",
    "nextjs/data/no-sync-segment-params fail/forwarded-promise",
    "nextjs/data/no-sync-segment-params fail/route-params",
  ]) expect(tested.text, line).toContain(`ok   ${line}`);
});

let gate: ReturnType<typeof project>;
beforeAll(() => {
  gate = project("gate");
  gate.put("package.json", JSON.stringify({ dependencies: { next: "16.4.5", react: "19.0.0" } }));
  gate.put("app/page.tsx", "export default function Page() { return <main>Home</main>; }\n");
  gate.git("init", "-q");
  expect(gate.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  for (const methodology of ["nextjs/rendering", "nextjs/routing"]) expect(gate.run(["pack", "enable", methodology, "--yes"]).code).toBe(0);
  gate.put(".pregate/requests/scope.json", JSON.stringify({
    why: "Exercise NEXT-SEGMENT-001 on defineRoute and a direct Promise read.",
    patch: [
      { op: "add", path: "/scope", value: { include: ["**"], exclude: [] } },
      { op: "add", path: "/enforcement", value: "enforce" },
    ],
  }));
  const applied = gate.run(["preset", "apply", ".pregate/requests/scope.json", "--yes"]);
  expect(applied.code, applied.text).toBe(0);
  gate.git("add", "-A");
  gate.git("commit", "-qm", "baseline");
});

test("issue 156 defineRoute params.kind is not a sync segment read", () => {
  const check = gate.run(["check", "--stdin", "--path", "src/app/api/admin/position-access/external/[kind]/route.ts"], reported);
  expect(check.text, check.text).not.toContain("nextjs/NEXT-SEGMENT-001");
  expect(check.code, check.text).toBe(0);
});

test("issue 156 destructured awaited params are not a sync segment read", () => {
  const check = gate.run(["check", "--stdin", "--path", "app/api/item/[id]/route.ts"], destructured);
  expect(check.text, check.text).not.toContain("nextjs/NEXT-SEGMENT-001");
  expect(check.code, check.text).toBe(0);
});

test("issue 156 a direct params read in a route handler still denies", () => {
  const check = gate.run(["check", "--stdin", "--path", "app/api/item/[id]/route.ts"], syncRoute);
  expect(check.text, check.text).toContain("nextjs/NEXT-SEGMENT-001");
  expect(check.text, check.text).toContain("app/api/item/[id]/route.ts:2");
  expect(check.code, check.text).toBe(1);
});

test("issue 156 a sync read beside defineRoute still denies", () => {
  const check = gate.run(["check", "--stdin", "--path", "src/app/api/admin/position-access/external/[kind]/route.ts"], beside);
  expect(check.text, check.text).toContain("nextjs/NEXT-SEGMENT-001");
  expect(check.text, check.text).toContain("src/app/api/admin/position-access/external/[kind]/route.ts:10");
  expect(check.text, check.text).not.toContain("src/app/api/admin/position-access/external/[kind]/route.ts:5");
  expect(check.code, check.text).toBe(1);
});

test("issue 156 an unawaited params destructure still denies", () => {
  const check = gate.run(["check", "--stdin", "--path", "app/api/item/[id]/route.ts"], unawaited);
  expect(check.text, check.text).toContain("nextjs/NEXT-SEGMENT-001");
  expect(check.text, check.text).toContain("app/api/item/[id]/route.ts:3");
  expect(check.code, check.text).toBe(1);
});

test("issue 156 a helper that receives the params Promise still denies", () => {
  const check = gate.run(["check", "--stdin", "--path", "app/api/item/[id]/route.ts"], forwarded);
  expect(check.text, check.text).toContain("nextjs/NEXT-SEGMENT-001");
  expect(check.text, check.text).toContain("app/api/item/[id]/route.ts:2");
  expect(check.code, check.text).toBe(1);
});
