import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 91: the compiled CLI runs the four packs over their fixture files, and check --stdin
// runs the same repros and true positives through the gate.
setDefaultTimeout(120_000);
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-issue-91-"));
afterAll(() => removeTree(area));

const packs = ["supabase", "nextjs", "react", "testing"];

const fixtureLines = [
  ["supabase/client/no-singleton-client-missing pass/exported-origin-string", "supabase/client/no-singleton-client-missing fail/bare-import"],
  ["supabase/client/no-deprecated-auth-helpers pass/exported-package-string", "supabase/client/no-deprecated-auth-helpers fail/nextjs-helpers"],
  ["supabase/client/no-auth-admin-in-client pass/api-route-handler", "supabase/client/no-auth-admin-in-client pass/pages-api-handler", "supabase/client/no-auth-admin-in-client fail/delete-user"],
  ["supabase/client/no-service-role-in-client pass/api-route-handler", "supabase/client/no-service-role-in-client pass/pages-api-handler", "supabase/client/no-service-role-in-client fail/service-role-const"],
  ["supabase/client/no-unbounded-select pass/drizzle-select", "supabase/client/no-unbounded-select pass/dom-select", "supabase/client/no-unbounded-select pass/single-row", "supabase/client/no-unbounded-select pass/maybe-single", "supabase/client/no-unbounded-select pass/insert-returning", "supabase/client/no-unbounded-select fail/bare-select"],
  ["supabase/rpc/no-untyped-rpc pass/zero-arg-rpc", "supabase/rpc/no-untyped-rpc pass/static-template-rpc", "supabase/rpc/no-untyped-rpc pass/foreign-client-rpc", "supabase/rpc/no-untyped-rpc pass/foreign-dynamic-rpc", "supabase/rpc/no-untyped-rpc fail/bare-rpc"],
  ["nextjs/routing/no-next-document-in-app pass/exported-document-string", "nextjs/routing/no-next-document-in-app fail/app-document-import"],
  ["nextjs/data/no-sync-segment-params pass/url-search-params", "nextjs/data/no-sync-segment-params fail/route-params"],
  ["nextjs/data/no-sync-page-props pass/awaited-search-params", "nextjs/data/no-sync-page-props pass/client-navigation-hooks", "nextjs/data/no-sync-page-props fail/page-params-member"],
  ["nextjs/rendering/no-google-font-link pass/template-stylesheet", "nextjs/rendering/no-google-font-link fail/google-fonts-css"],
  ["nextjs/rendering/no-img-element pass/template-markup", "nextjs/rendering/no-img-element fail/img-self-closing"],
  ["nextjs/routing/no-anchor-navigation pass/blank-target", "nextjs/routing/no-anchor-navigation pass/download-anchor", "nextjs/routing/no-anchor-navigation fail/internal-anchor"],
  ["react/components/no-unsafe-blank-target pass/assertion-string", "react/components/no-unsafe-blank-target fail/bare-blank"],
  ["react/hooks/no-conditional-hook pass/ternary-condition", "react/hooks/no-conditional-hook fail/in-if"],
  ["testing/testing/no-focused-tests pass/guarded-skip", "testing/testing/no-focused-tests fail/unconditional-skip-forms"],
] as const;

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
  return { put, run, git };
}

test.each(packs)("issue 91 %s fixtures pass through the CLI", (ns: string) => {
  const root = project(`fixtures-${ns}`);
  const tested = root.run(["rules", "test", "--library", ns]);
  expect(tested.code, tested.text).toBe(0);
  for (const line of fixtureLines.flat()) {
    if (line.startsWith(`${ns}/`)) expect(tested.text, line).toContain(`ok   ${line}`);
  }
});

type GateCase = {
  id: string;
  rule: string;
  name: string;
  path: string;
  source: string;
  fired: boolean;
  deny: boolean;
};

const origin = `export async function getOrigin(row: { source: string }) {\n  return row.source === "supabase";\n}\n`;
const bareImport = `import { createClient } from "supabase";\nexport const db = createClient("https://example.supabase.co", "anon");\n`;
const helperString = `export function note(pkg: string) {\n  return pkg === "@supabase/auth-helpers-nextjs";\n}\n`;
const helperImport = `import { createBrowserClient } from "@supabase/auth-helpers-nextjs";\nexport const client = createBrowserClient("https://example.supabase.co", "anon");\n`;
const adminRoute = `export async function POST(id: string): Promise<void> {\n  await supabase.auth.admin.deleteUser(id);\n}\n`;
const adminComponent = `export async function remove(id: string): Promise<void> {\n  await supabase.auth.admin.deleteUser(id);\n}\n`;
const serviceRole = `import { createClient } from "@supabase/supabase-js";\nconst url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;\nexport const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);\n`;
const serviceComponent = `import { createClient } from "@supabase/supabase-js";\nconst SERVICE_ROLE = "service-role";\nexport const db = createClient("https://example.supabase.co", SERVICE_ROLE);\n`;
const drizzle = `import { createClient } from "@supabase/supabase-js";\ndeclare function eq(column: unknown, value: unknown): unknown;\ndeclare const users: { id: unknown };\nexport async function byId(db: { select(): { from(table: unknown): { where(cond: unknown): Promise<unknown> } } }, id: string) {\n  const rows = await db.select().from(users).where(eq(users.id, id));\n  return rows;\n}\n`;
const domSelect = `import { createClient } from "@supabase/supabase-js";\nexport function selectInput(inputElement: { select(): void }) {\n  inputElement.select();\n}\n`;
const singleRow = `import { createClient } from "@supabase/supabase-js";\nexport async function one(supabase: { from(table: string): Promise<unknown> }, id: string) {\n  const { data } = await supabase.from("items").select("*").eq("id", id).single();\n  return data;\n}\n`;
const maybeSingle = `import { createClient } from "@supabase/supabase-js";\nexport async function maybe(supabase: { from(table: string): Promise<unknown> }, id: string) {\n  const { data } = await supabase.from("items").select("*").eq("id", id).maybeSingle();\n  return data;\n}\n`;
const insertReturning = `import { createClient } from "@supabase/supabase-js";\nexport async function created(supabase: { from(table: string): Promise<unknown> }, payload: unknown) {\n  const { data } = await supabase.from("items").insert(payload).select();\n  return data;\n}\n`;
const bareSelect = `import { createClient } from "@supabase/supabase-js";\nexport async function list(): Promise<void> {\n  await supabase.from("orders").select("*");\n}\n`;
const zeroArg = `import { createClient } from "@supabase/supabase-js";\nexport async function org(supabase: { rpc(fn: string, args?: unknown): Promise<unknown> }) {\n  return supabase.rpc("current_org_id");\n}\n`;
const foreignRpc = `export async function call(client: { rpc(name: string): Promise<unknown> }) {\n  return client.rpc("method");\n}\n`;
const dynamicRpc = `import { createClient } from "@supabase/supabase-js";\nexport async function stats(supabase: { rpc(fn: string): Promise<unknown> }, name: string): Promise<void> {\n  await supabase.rpc(name);\n}\n`;
const documentString = `export async function describe(row: { source: string }) {\n  return row.source === "next/document" ? "pages" : "app";\n}\n`;
const documentImport = `import Document from "next/document";\nexport default function Layout() { return <Document />; }\n`;
const urlParams = `export async function GET(request: Request) {\n  const params = new URL(request.url).searchParams;\n  return Response.json({ q: params.get("q") });\n}\n`;
const syncRoute = `export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {\n  return Response.json({ id: params.id });\n}\n`;
const awaitedSearch = `export default async function Page(props: { searchParams: Promise<{ tab?: string }> }) {\n  const params = await props.searchParams;\n  return <div>{params.tab}</div>;\n}\n`;
const clientPage = `"use client";\nimport { useParams, useSearchParams } from "next/navigation";\nexport default function ClientPage() {\n  const params = useParams<{ id: string }>();\n  const searchParams = useSearchParams();\n  return <div>{params.id} {searchParams.get("tab")}</div>;\n}\n`;
const syncPage = `export default function Page({ params }: { params: Promise<{ slug: string }> }) {\n  return <h1>{params.slug}</h1>;\n}\n`;
const fontTemplate = "export function pdfCss(): string {\n  return `body { background: url(https://fonts.googleapis.com/css2?family=Inter) }`;\n}\n";
const fontLink = `export function Fonts() { return <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />; }\n`;
const imgTemplate = "export function email(): string {\n  return `<img src=\"https://cdn.example/logo.png\" alt=\"\" />`;\n}\n";
const imgElement = `export function Hero() { return <img src="/a.png" alt="a" />; }\n`;
const blankAnchor = `export function Out() {\n  return <a href="/eos" target="_blank" rel="noopener noreferrer">EOS</a>;\n}\n`;
const downloadAnchor = `export function Save() {\n  return <a href="/report.csv" download>Report</a>;\n}\n`;
const internalAnchor = `export function Nav() { return <a href="/about">About</a>; }\n`;
const assertionBlank = `export function assertBlank(html: string) {\n  expect(html).toContain('target="_blank"');\n  expect(html).toContain('rel="noreferrer"');\n}\n`;
const bareBlank = `export function Outbound(props: { url: string }) {\n  return (\n    <a target="_blank" href={props.url}>\n      open\n    </a>\n  );\n}\n`;
const popover = `import { useContext } from "react";\nconst PopoverCtx = { open: false };\nconst PopoverContent = ({ children }: { children: React.ReactNode }) =>\n  useContext(PopoverCtx).open ? <div>{children}</div> : null;\n`;
const hookInIf = `import { useState } from "react";\nexport function Panel(props: { ok: boolean }) {\n  if (props.ok) {\n    const [open, setOpen] = useState(false);\n    return <div>{open ? "open" : "shut"}</div>;\n  }\n  return <div>shut</div>;\n}\n`;
const guardedSkip = `import { test, expect } from "@playwright/test";\n\ntest("checkout", async ({ page, browserName }) => {\n  const hasEnv = process.env.E2E_BASE_URL;\n  if (!hasEnv) {\n    test.skip(true, "Missing env");\n    return;\n  }\n  if (browserName === "webkit") {\n    test.skip();\n    return;\n  }\n  await expect(page).toHaveTitle("Checkout");\n});\n`;
const unconditionalSkip = `import { test } from "@playwright/test";\n\ntest("checkout", async () => {\n  test.skip(true, "later");\n});\n`;

const cases: GateCase[] = [
  { id: "SB-CLIENT-001", rule: "supabase/SB-CLIENT-001", name: "exported string supabase", path: "src/origin.ts", source: origin, fired: false, deny: true },
  { id: "SB-CLIENT-001", rule: "supabase/SB-CLIENT-001", name: "bare supabase import", path: "src/lib/db.ts", source: bareImport, fired: true, deny: true },
  { id: "SB-HELPERS-001", rule: "supabase/SB-HELPERS-001", name: "exported auth-helpers string", path: "src/notes.ts", source: helperString, fired: false, deny: false },
  { id: "SB-HELPERS-001", rule: "supabase/SB-HELPERS-001", name: "auth-helpers import", path: "src/profile.tsx", source: helperImport, fired: true, deny: false },
  { id: "SB-AUTH-001", rule: "supabase/SB-AUTH-001", name: "auth admin in a route handler", path: "src/app/api/users/route.ts", source: adminRoute, fired: false, deny: true },
  { id: "SB-AUTH-001", rule: "supabase/SB-AUTH-001", name: "auth admin in a pages api route", path: "pages/api/admin.ts", source: adminRoute, fired: false, deny: true },
  { id: "SB-AUTH-001", rule: "supabase/SB-AUTH-001", name: "auth admin in a component", path: "src/components/Members.ts", source: adminComponent, fired: true, deny: true },
  { id: "SB-KEY-001", rule: "supabase/SB-KEY-001", name: "service role in a route handler", path: "src/app/api/db/route.ts", source: serviceRole, fired: false, deny: true },
  { id: "SB-KEY-001", rule: "supabase/SB-KEY-001", name: "service role in a pages api route", path: "src/pages/api/db.ts", source: serviceRole, fired: false, deny: true },
  { id: "SB-KEY-001", rule: "supabase/SB-KEY-001", name: "service role in a component", path: "src/components/Profile.ts", source: serviceComponent, fired: true, deny: true },
  { id: "SB-QUERY-001", rule: "supabase/SB-QUERY-001", name: "drizzle select().from()", path: "src/lib/users.ts", source: drizzle, fired: false, deny: true },
  { id: "SB-QUERY-001", rule: "supabase/SB-QUERY-001", name: "DOM element.select()", path: "src/lib/field.ts", source: domSelect, fired: false, deny: true },
  { id: "SB-QUERY-001", rule: "supabase/SB-QUERY-001", name: "supabase .single()", path: "src/lib/one.ts", source: singleRow, fired: false, deny: true },
  { id: "SB-QUERY-001", rule: "supabase/SB-QUERY-001", name: "supabase .maybeSingle()", path: "src/lib/maybe.ts", source: maybeSingle, fired: false, deny: true },
  { id: "SB-QUERY-001", rule: "supabase/SB-QUERY-001", name: "insert().select()", path: "src/lib/write.ts", source: insertReturning, fired: false, deny: true },
  { id: "SB-QUERY-001", rule: "supabase/SB-QUERY-001", name: "unbounded supabase select", path: "src/lib/orders.ts", source: bareSelect, fired: true, deny: true },
  { id: "SB-RPC-001", rule: "supabase/SB-RPC-001", name: "static zero-arg rpc", path: "src/lib/org.ts", source: zeroArg, fired: false, deny: true },
  { id: "SB-RPC-001", rule: "supabase/SB-RPC-001", name: "non-supabase rpc", path: "src/lib/foreign.ts", source: foreignRpc, fired: false, deny: true },
  { id: "SB-RPC-001", rule: "supabase/SB-RPC-001", name: "computed rpc name", path: "src/lib/stats.ts", source: dynamicRpc, fired: true, deny: true },
  { id: "NEXT-DOC-001", rule: "nextjs/NEXT-DOC-001", name: "exported next/document string", path: "app/notes.tsx", source: documentString, fired: false, deny: true },
  { id: "NEXT-DOC-001", rule: "nextjs/NEXT-DOC-001", name: "next/document import", path: "app/layout.tsx", source: documentImport, fired: true, deny: true },
  { id: "NEXT-SEGMENT-001", rule: "nextjs/NEXT-SEGMENT-001", name: "URLSearchParams in a route", path: "app/api/search/route.ts", source: urlParams, fired: false, deny: true },
  { id: "NEXT-SEGMENT-001", rule: "nextjs/NEXT-SEGMENT-001", name: "sync route params", path: "app/api/item/[id]/route.ts", source: syncRoute, fired: true, deny: true },
  { id: "NEXT-PARAMS-001", rule: "nextjs/NEXT-PARAMS-001", name: "awaited searchParams", path: "app/settings/page.tsx", source: awaitedSearch, fired: false, deny: true },
  { id: "NEXT-PARAMS-001", rule: "nextjs/NEXT-PARAMS-001", name: "client useParams and useSearchParams", path: "app/client/page.tsx", source: clientPage, fired: false, deny: true },
  { id: "NEXT-PARAMS-001", rule: "nextjs/NEXT-PARAMS-001", name: "sync page params", path: "app/blog/[slug]/page.tsx", source: syncPage, fired: true, deny: true },
  { id: "NEXT-FONT-001", rule: "nextjs/NEXT-FONT-001", name: "template stylesheet string", path: "src/pdf.ts", source: fontTemplate, fired: false, deny: true },
  { id: "NEXT-FONT-001", rule: "nextjs/NEXT-FONT-001", name: "googleapis link element", path: "src/components/fonts.tsx", source: fontLink, fired: true, deny: true },
  { id: "NEXT-IMG-001", rule: "nextjs/NEXT-IMG-001", name: "template img string", path: "src/email.ts", source: imgTemplate, fired: false, deny: false },
  { id: "NEXT-IMG-001", rule: "nextjs/NEXT-IMG-001", name: "jsx img element", path: "src/components/hero.tsx", source: imgElement, fired: true, deny: false },
  { id: "NEXT-LINK-001", rule: "nextjs/NEXT-LINK-001", name: "anchor with target blank", path: "src/components/eos.tsx", source: blankAnchor, fired: false, deny: false },
  { id: "NEXT-LINK-001", rule: "nextjs/NEXT-LINK-001", name: "download anchor", path: "src/components/report.tsx", source: downloadAnchor, fired: false, deny: false },
  { id: "NEXT-LINK-001", rule: "nextjs/NEXT-LINK-001", name: "internal anchor", path: "src/components/nav.tsx", source: internalAnchor, fired: true, deny: false },
  { id: "REACT-BLANK-001", rule: "react/REACT-BLANK-001", name: "target blank inside an assertion string", path: "src/assert-blank.tsx", source: assertionBlank, fired: false, deny: true },
  { id: "REACT-BLANK-001", rule: "react/REACT-BLANK-001", name: "jsx target blank without rel", path: "src/outbound.tsx", source: bareBlank, fired: true, deny: true },
  { id: "REACT-HOOK-001", rule: "react/REACT-HOOK-001", name: "useContext in a ternary condition", path: "src/popover.tsx", source: popover, fired: false, deny: true },
  { id: "REACT-HOOK-001", rule: "react/REACT-HOOK-001", name: "useState inside if", path: "src/panel.tsx", source: hookInIf, fired: true, deny: true },
  { id: "TDD-FOCUS-001", rule: "testing/TDD-FOCUS-001", name: "runtime if around test.skip", path: "e2e/guarded.spec.ts", source: guardedSkip, fired: false, deny: true },
  { id: "TDD-FOCUS-001", rule: "testing/TDD-FOCUS-001", name: "unconditional test.skip", path: "e2e/checkout.spec.ts", source: unconditionalSkip, fired: true, deny: true },
];

let gate: ReturnType<typeof project>;
beforeAll(() => {
  gate = project("gate");
  gate.put("package.json", JSON.stringify({ dependencies: { next: "16.4.0", react: "19.0.0" } }));
  gate.put("app/page.tsx", "export default function Page() { return <main>Home</main>; }\n");
  gate.git("init", "-q");
  expect(gate.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  for (const ns of packs) expect(gate.run(["pack", "add", "--library", ns, "--yes"]).code).toBe(0);
  gate.put(".pregate/requests/scope.json", JSON.stringify({
    why: "Exercise the four packs on the reported false positives.",
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

test.each(cases)("issue 91 $id $name", (item) => {
  const check = gate.run(["check", "--stdin", "--path", item.path], item.source);
  if (item.fired) {
    expect(check.text, item.name).toContain(item.rule);
    if (item.deny) expect(check.code, check.text).toBe(1);
  } else {
    expect(check.text, item.name).not.toContain(item.rule);
    if (item.deny) expect(check.code, check.text).toBe(0);
  }
});
