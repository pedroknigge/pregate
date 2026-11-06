import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { canonical } from "../src/disk.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { packTemplate } from "../src/pack-template.ts";
import { VERSIONS } from "../src/versions.ts";
import { librarySource } from "../src/library.ts";
import type { Lock, Preset } from "../src/types.ts";
import type { Proposal } from "../src/proposal.ts";
import { inScope } from "../src/paths.ts";
import { guidedReview } from "../src/guided-review.ts";
import { sha256 } from "../src/state.ts";

function withCleanup<T>(work: () => T, cleanup: () => void): T {
  try { return work(); } finally { cleanup(); }
}

setDefaultTimeout(60_000);
const area = mkdtempSync(join(tmpdir(), "pregate-guided-"));
const suppliedBinary = process.env.PREGATE_GUIDED_BINARY;
const binary = suppliedBinary ?? join(area, ENGINE_FILE);
// Release verification can replay every production-terminal control against the
// packaged artifact. This seam is test-only and never recompiles that artifact.
beforeAll(() => {
  if (suppliedBinary === undefined) return compileBinary(hostTarget(), binary);
  expect(isAbsolute(binary)).toBe(true);
  expect(statSync(binary).isFile()).toBe(true);
  const version = Bun.spawnSync([binary, "--version"], { stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  expect(version.exitCode, version.stderr.toString()).toBe(0);
  expect(version.stdout.toString().trim()).toBe(`pregate ${VERSIONS.engine} (core ${VERSIONS.core})`);
}, 120_000);
afterAll(() => rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

function project(name: string, files: Record<string, string> = {}, git = false) {
  const root = canonical(join(area, name));
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (git) expect(Bun.spawnSync(["git", "init", "-q", root], { stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
  const machine = join(area, name + "-machine");
  const path = process.platform === "win32" ? pathWithoutHarnesses() : "/usr/bin:/bin:/usr/sbin:/sbin";
  const env = { ...process.env, HOME: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    CLAUDE_CONFIG_DIR: join(machine, "claude"), XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    PATH: path, ...(process.platform === "win32" ? { Path: path } : {}) };
  const cli = (args: string[], cwd = root) => {
    const out = Bun.spawnSync([binary, ...args], { cwd, env, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
    return { code: out.exitCode, text: out.stdout.toString() + out.stderr.toString() };
  };
  const bytes = () => ["preset.json", "pregate.lock.json"].map(file => {
    const path = join(root, ".pregate", file);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  });
  const proposals = () => {
    const dir = join(env.XDG_DATA_HOME, "pregate/proposals");
    return !existsSync(dir) ? [] : readdirSync(dir).map(file => JSON.parse(readFileSync(join(dir, file), "utf8")) as Proposal);
  };
  const pendingPreset = () => {
    const proposal = proposals().find(p => p.root === root)!;
    return JSON.parse(proposal.writes.find(w => w.path === join(root, ".pregate/preset.json").replaceAll("\\", "/"))!.after!) as Preset;
  };
  const consent = () => {
    const dir = join(env.XDG_DATA_HOME, "pregate/consent");
    // A disabled worktree keeps a record that withholds consent; it grants nothing.
    return !existsSync(dir) ? [] : readdirSync(dir).map(file => readFileSync(join(dir, file), "utf8")).filter(text => !text.includes(`"disabled":true`));
  };
  const init = () => expect(cli(["init", "--preset", "integrity-only", "--yes"]).code).toBe(0);
  const installed = () => [join(env.XDG_DATA_HOME, "pregate", VERSIONS.engine, ENGINE_FILE), join(env.XDG_DATA_HOME, "pregate/bin", process.platform === "win32" ? "launcher.ps1" : "pregate")];
  return { root, env, cli, bytes, proposals, pendingPreset, consent, init, installed };
}

const nextFiles = {
  "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0", "drizzle-orm": "0.1.0" }, devDependencies: { vitest: "1.0.0" } }),
  "app/page.tsx": "export default function Page() { return <main>Hello</main>; }\n",
  "components/Button.tsx": "export function Button() { return <button>Save</button>; }\n",
  "tests/page.test.ts": "export const expected = 'Hello';\n",
  "proxy.ts": "export const proxy = true;\n",
};

test("inspection resolves a Git subdirectory, explains setup and inventories the actual stack without preparing a contract", () => {
  const p = project("inspect git", nextFiles, true);
  const out = p.cli(["guide", "--json"], join(p.root, "components"));
  expect(out.code, out.text).toBe(0);
  const view = JSON.parse(out.text);
  expect(view).toMatchObject({ schemaVersion: 1, root: p.root, state: "new", consent: false, engine: VERSIONS });
  expect(view.recommendations.map((r: { ns: string }) => r.ns)).toEqual(expect.arrayContaining(["nextjs", "react", "typescript", "drizzle", "testing"]));
  expect(view.installation).toMatchObject({ enginePresent: false, launcherPresent: false });
  expect(view.coverageState).toBe("proposed");
  expect(view.coverage).toMatchObject({ inventoried: 4, inScope: 4, outsideScope: [], unsupported: [] });
  expect(view.proposedScope.include).toEqual(expect.arrayContaining(["app/**", "components/**", "tests/**", "proxy.ts"]));
  expect(view.actions.some((a: { command: string }) => a.command.includes("setup"))).toBe(true);
  expect(p.bytes()).toEqual([null, null]);
  expect(p.proposals()).toEqual([]);
  expect(p.consent()).toEqual([]);
  const card = p.cli(["guide"]);
  expect(card.code, card.text).toBe(0);
  expect(card.text).toContain("pregate");
  expect(card.text).toContain("Proposed source scope (not active): 4/4");
  expect(p.bytes()).toEqual([null, null]);
  expect(p.proposals()).toEqual([]);
});

test("one initial preview selects several optional packs and a local pack, covers real roots and leaves consent and disk unchanged", () => {
  const p = project("combined setup", nextFiles);
  const local = join(p.root, "team rules");
  for (const [path, text] of Object.entries(packTemplate("team"))) {
    mkdirSync(dirname(join(local, path)), { recursive: true }); writeFileSync(join(local, path), text);
  }
  const out = p.cli(["guide", "--preview", "--preset", "integrity-only", "--packs", "typescript,react", "--custom-pack", "team rules", "--enforcement", "enforce"]);
  expect(out.code, out.text).toBe(0);
  expect(out.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  expect(out.text).toContain("Protection readiness");
  expect(out.text).toContain("degraded; missing installed engine, launcher, registered harness hooks");
  expect(out.text).toContain("it does not establish working agent-edit protection");
  expect(out.text.indexOf("Protection readiness")).toBeLessThan(out.text.indexOf("Approval activates this worktree"));
  expect(p.bytes()).toEqual([null, null]);
  expect(p.consent()).toEqual([]);
  expect(p.proposals()).toHaveLength(1);
  expect(p.proposals()[0]!.activate).toBe(true);
  const preset = p.pendingPreset();
  expect(preset.sources.map(source => source.ns).sort()).toEqual(["core", "react", "team", "typescript"]);
  expect(preset.sources.find(source => source.ns === "team")).toMatchObject({ kind: "path", path: "team rules" });
  expect(preset.methodologies).toEqual(expect.arrayContaining(["core/pregate-integrity", "typescript/strict-types", "typescript/anti-evasion", "react/components", "team/team"]));
  expect(preset.enforcement).toBe("enforce");
  const lock = JSON.parse(p.proposals()[0]!.lockText) as Lock;
  for (const path of ["app/page.tsx", "components/Button.tsx", "tests/page.test.ts", "proxy.ts"]) expect(inScope(lock, path)).toBe(true);
  expect(lock.rules.some(rule => rule.id.startsWith("team/"))).toBe(true);
  expect(lock.rules.filter(rule => rule.id.startsWith("core/")).length).toBe(68);
});

test("default initial preview combines detected language, framework, library and testing packs with the starter recipe in one review", () => {
  const p = project("default detected setup", nextFiles);
  const result = p.cli(["guide", "--preview"]);
  expect(result.code, result.text).toBe(0);
  expect(result.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  const preset = p.pendingPreset();
  expect(preset.sources.map(source => source.ns)).toEqual(expect.arrayContaining(["core", "typescript", "react", "nextjs", "drizzle", "testing", "clean-code"]));
  expect(preset.methodologies).toEqual(expect.arrayContaining(["clean-code/clean-code", "testing/tdd", "typescript/strict-types", "typescript/anti-evasion", "nextjs/rendering", "nextjs/routing", "react/components", "react/hooks", "drizzle/queries", "drizzle/schema"]));
  expect(p.bytes()).toEqual([null, null]); expect(p.consent()).toEqual([]); expect(p.proposals()).toHaveLength(1);
  expect(preset.enforcement).toBe("advisor");
  expect(result.text).not.toContain("WARNING");
  expect(result.text).not.toContain("Review policy changes below");
  expect(result.text).not.toMatch(/runs in advisor mode/);
  expect(result.text.split("\n").length).toBeLessThan(45);
});

test("guide starts new projects in advisor mode unless chosen otherwise; existing projects keep their mode", () => {
  const fresh = project("advisor default", nextFiles);
  expect(fresh.cli(["guide", "--preview", "--packs", "none"]).code).toBe(0);
  expect(fresh.pendingPreset().enforcement).toBe("advisor");
  const observed = project("observe on request", nextFiles);
  expect(observed.cli(["guide", "--preview", "--packs", "none", "--enforcement", "shadow"]).code).toBe(0);
  expect(observed.pendingPreset().enforcement).toBe("shadow");
  const existing = project("existing mode kept", nextFiles);
  existing.init();
  const mode = (JSON.parse(existing.bytes()[0]!) as Preset).enforcement;
  const prepared = existing.cli(["guide", "--preview", "--packs", "typescript"]);
  expect(prepared.code, prepared.text).toBe(0);
  expect(existing.pendingPreset().enforcement).toBe(mode);
});

test("a core folder its code contradicts is named as not proposed, but only when the derived map is the one under review", () => {
  const files = { "src/core/ky.ts": 'import { merge } from "../utils/merge";\nexport const ky = merge;\n', "src/utils/merge.ts": "export const merge = 1;\n" };
  const derived = project("contradicted core", files);
  const preview = derived.cli(["guide", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).toContain("Layer core (src/core) not proposed: src/core/ky.ts imports src/utils/merge.ts, which is outside every layer.");
  expect(preview.text).not.toContain("Layers to review");
  // A recipe chosen by name keeps its own layers; a note about the derived map would contradict them.
  const recipe = project("contradicted core recipe", files);
  const chosen = recipe.cli(["guide", "--preview", "--preset", "functional-ts"]);
  expect(chosen.code, chosen.text).toBe(0);
  expect(chosen.text).not.toContain("not proposed");
});

test("layered folders suggest clean architecture with layers from the real folders, and the approved contract checks them", () => {
  const p = project("layered domain infra", { "src/domain/order.ts": 'import { db } from "../infra/db";\nexport const order = db;\n', "src/infra/db.ts": "export const db = 1;\n" });
  const architecture = JSON.parse(p.cli(["guide", "--json"]).text).recommendations.find((item: { ns: string }) => item.ns === "architecture");
  expect(architecture.methodologies).toEqual(["architecture/clean-architecture"]);
  expect(architecture.reasons[0]).toContain("Layered folders detected: src/domain, src/infra.");
  const preview = p.cli(["guide", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(p.pendingPreset().layers).toEqual({ domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
    infra: { paths: ["src/infra/**"], mayImport: ["domain"], kind: "adapter" } });
  expect(preview.text).toContain("Layers to review: domain (core; imports no other layer); infra (adapter; may import domain).");
  expect(p.cli(["approve", "--yes", "--digest", preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!]).code).toBe(0);
  expect(p.cli(["guide", "--preview"]).text).not.toContain("Layers to review");
  const findings = JSON.parse(p.cli(["audit", "--json"]).text).findings as { path: string; rule: string }[];
  expect(findings).toContainEqual(expect.objectContaining({ path: "src/domain/order.ts", rule: "architecture/CA-DEP-001" }));
});

test("scan and guide show proposed source coverage without an active contract and expose unsupported source bodies", () => {
  const p = project("initial scope limits", { ...nextFiles, "components/Panel.rb": "puts 'Panel'\n", "src/generated/client.ts": "export const client = 1;\n" });
  const scanned = p.cli(["scan", "--json"]), inspected = p.cli(["guide", "--json"]);
  for (const result of [scanned, inspected]) {
    expect(result.code, result.text).toBe(0);
    expect(JSON.parse(result.text)).toMatchObject({ coverageState: "proposed", coverage: {
      inventoried: 5, inScope: 4, sourceLikeInventoried: 6, unsupported: ["components/Panel.rb"], excluded: ["src/generated/client.ts"],
    } });
  }
  expect(JSON.parse(scanned.text).plan.scope).toEqual(JSON.parse(inspected.text).proposedScope);
  expect(p.bytes()).toEqual([null, null]); expect(p.proposals()).toEqual([]); expect(p.consent()).toEqual([]);
  const preview = p.cli(["guide", "--preview", "--full"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).toContain("Protection readiness");
  expect(preview.text).toContain("registered harness hooks");
});

test("scan ignores a docs-only Next app and a CI Python script, and still detects a real app", () => {
  const packs = (name: string, files: Record<string, string>) => {
    const out = project(name, files).cli(["scan", "--json"]);
    expect(out.code, out.text).toBe(0);
    return JSON.parse(out.text).recommendations as { ns: string; reasons: string[] }[];
  };
  const docs = packs("docs site next", {
    "packages/zod/src/index.ts": "export const schema = 1;\n",
    "packages/docs/package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    "packages/docs/app/page.tsx": "export const page = 1;\n",
  });
  expect(docs.map(item => item.ns)).not.toContain("nextjs");
  expect(docs.map(item => item.ns)).not.toContain("react");
  expect(docs.map(item => item.ns)).toContain("typescript");
  const ci = packs("ci python script", {
    "src/lib.rs": "pub fn f() {}\n",
    "Cargo.toml": "[package]\nname = \"clap\"\nversion = \"0.1.0\"\n",
    ".github/workflows/release-notes.py": "print('notes')\n",
  });
  expect(ci.map(item => item.ns)).not.toContain("python");
  expect(ci.map(item => item.ns)).toContain("rust");
  const root = packs("root next app", {
    "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    "app/page.tsx": "export const page = 1;\n",
    "packages/docs/package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
  });
  expect(root.find(item => item.ns === "nextjs")!.reasons).toEqual(["package.json declares next"]);
  expect(root.map(item => item.ns)).toEqual(expect.arrayContaining(["nextjs", "react"]));
  const apps = packs("apps next app", {
    "apps/web/package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    "apps/web/app/page.tsx": "export const page = 1;\n",
  });
  expect(apps.find(item => item.ns === "nextjs")!.reasons).toEqual(["apps/web/package.json declares next"]);
  expect(apps.map(item => item.ns)).toEqual(expect.arrayContaining(["nextjs", "react"]));
  const python = packs("python project", {
    "pyproject.toml": "[project]\nname = \"demo\"\n",
    "src/app/__init__.py": "value = 1\n",
    ".github/workflows/release-notes.py": "print('notes')\n",
  });
  expect(python.map(item => item.ns)).toContain("python");
});

test("a new repo proposes documentation and stack scanning plus a custom pack in the first combined review", () => {
  const p = project("documented onboarding", { ...nextFiles, "README.md": "# Booking\n\nA booking must belong to one tenant.\n\n```ts\nconst example = 'This must not become a requirement.';\n```\n",
    "docs/domain.md": "# Domain\n\n- A cancelled booking must release its capacity.\n" });
  const view = p.cli(["guide", "--json"]); expect(view.code, view.text).toBe(0);
  const info = JSON.parse(view.text);
  expect(info.onboarding.scanSuggested).toBe(true);
  expect(info.documentation.requirements).toHaveLength(2);
  expect(info.documentation.customPack.ns).toBe("project-documented-onboarding");
  expect(info.discovery.available.length).toBeGreaterThan(30);
  const preview = p.cli(["guide", "--preview", "--preset", "integrity-only", "--packs", "typescript,react", "--custom-from-docs"]);
  expect(preview.code, preview.text).toBe(0); expect(preview.text.match(/Digest:/g)).toHaveLength(1);
  const preset = p.pendingPreset(), ns = info.documentation.customPack.ns;
  expect(preset.sources.map(source => source.ns)).toEqual(expect.arrayContaining(["core", "typescript", "react", ns]));
  expect(preset.overrides?.[`${ns}/PROJECT-DOC-001`]).toEqual({ enforcement: "shadow" });
  expect(p.proposals()[0]!.writes.some(write => write.path.includes(`/packs/${ns}/methodologies/`))).toBe(true);
  expect(p.bytes()).toEqual([null, null]); expect(existsSync(join(p.root, ".pregate/packs", ns))).toBe(false);
  const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  const approved = p.cli(["approve", "--yes", "--digest", digest]); expect(approved.code, approved.text).toBe(0);
  expect(existsSync(join(p.root, ".pregate/packs", ns, "source.json"))).toBe(true);
  const report = p.cli(["fitness", "status", "--json"]);
  expect(JSON.parse(report.text).requirements.filter((rule: { rule: string; status: string }) => rule.rule.startsWith(ns + "/")).map((rule: { status: string }) => rule.status)).toEqual(["unverified", "unverified"]);
});

test("old-project migration and selected pack additions enter one compact review, preserving custom policy", () => {
  const p = project("upgrade and adopt", nextFiles); p.init();
  const preset = JSON.parse(p.bytes()[0]!) as Preset; preset.engine = "0.0.0";
  preset.overrides = { "core/CORE-INV-003": "off" }; preset.scope = { include: ["lib/**"], exclude: ["components/generated/**"] };
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  const before = p.bytes();
  const out = p.cli(["guide", "--preview", "--packs", "typescript,react"]);
  expect(out.code, out.text).toBe(0); expect(out.text.match(/Digest:/g)).toHaveLength(1);
  expect(out.text.length).toBeLessThan(10_000);
  expect(p.pendingPreset().engine).toBe(VERSIONS.engine);
  expect(p.pendingPreset().sources.map(source => source.ns)).toEqual(expect.arrayContaining(["core", "typescript", "react"]));
  expect(p.pendingPreset().overrides?.["core/CORE-INV-003"]).toBe("off");
  expect(p.pendingPreset().scope?.exclude).toEqual(["components/generated/**"]);
  expect(p.bytes()).toEqual(before);
});

test("optional pack opt-out prepares one shadow contract without silently restoring detected recommendations", () => {
  const p = project("explicit opt out", nextFiles);
  const out = p.cli(["guide", "--preview", "--preset", "integrity-only", "--packs", "none", "--enforcement", "shadow"]);
  expect(out.code, out.text).toBe(0);
  expect(p.pendingPreset().sources.map(source => source.ns)).toEqual(["core"]);
  expect(p.pendingPreset().enforcement).toBe("shadow");
  expect(p.bytes()).toEqual([null, null]);
  expect(p.consent()).toEqual([]);
});

test("existing-project adoption expands missing real roots in one review while preserving exclusions, existing packs and disabled consent", () => {
  const p = project("existing adoption", nextFiles); p.init();
  const preset = JSON.parse(p.bytes()[0]!) as Preset;
  preset.scope = { include: ["lib/**"], exclude: ["components/generated/**"] };
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  expect(p.cli(["preset", "compile", "--yes"]).code).toBe(0);
  expect(p.cli(["disable", "--yes"]).code).toBe(0);
  const before = p.bytes();
  const out = p.cli(["guide", "--preview", "--packs", "typescript,react", "--enforcement", "shadow"]);
  expect(out.code, out.text).toBe(0);
  expect(out.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  expect(p.bytes()).toEqual(before);
  expect(p.consent()).toEqual([]);
  const candidate = p.pendingPreset();
  expect(candidate.scope?.include).toEqual(expect.arrayContaining(["lib/**", "app/**", "components/**", "tests/**", "proxy.ts"]));
  expect(candidate.scope?.exclude).toEqual(["components/generated/**"]);
  expect(candidate.sources.map(source => source.ns).sort()).toEqual(["core", "react", "typescript"]);
});

test("stale project migration is actionable and retains custom rules, policy and local consent through preview", () => {
  const p = project("stale policy", { "src/main.ts": "export const main = 1;\n" }); p.init();
  expect(p.cli(["pack", "init", "team"]).code).toBe(0);
  expect(p.cli(["pack", "add", "--path", ".pregate/packs/team", "--yes"]).code).toBe(0);
  expect(p.cli(["pack", "add", "--library", "typescript", "--yes"]).code).toBe(0);
  const preset = JSON.parse(p.bytes()[0]!) as Preset;
  preset.engine = "0.0.0";
  const core = preset.sources.find(s => s.kind === "builtin")!;
  const typescript = preset.sources.find(s => s.kind === "library" && s.ns === "typescript")!;
  if (core.kind === "builtin") core.version = "0.0.0";
  if (typescript.kind === "library") typescript.version = "1.0.0";
  preset.scope = { include: ["src/**"], exclude: ["src/generated/**"] };
  preset.overrides = { "core/CORE-INV-003": "off" };
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  const before = p.bytes(), consent = p.consent();
  const view = p.cli(["guide", "--json"]);
  expect(view.code, view.text).toBe(0);
  expect(JSON.parse(view.text).state).toBe("needs-update");
  expect(JSON.parse(view.text).actions.some((a: { command: string }) => a.command.includes("update"))).toBe(true);
  const out = p.cli(["guide", "--preview"]);
  expect(out.code, out.text).toBe(0);
  expect(p.bytes()).toEqual(before); expect(p.consent()).toEqual(consent);
  const candidate = p.pendingPreset();
  expect(candidate.engine).toBe(VERSIONS.engine);
  expect(candidate.sources.find(s => s.kind === "builtin")).toMatchObject({ version: VERSIONS.core });
  expect(candidate.sources.find(s => s.ns === "typescript")).toMatchObject({ version: JSON.parse(librarySource("typescript")!["source.json"]!).version });
  expect(candidate.sources.find(s => s.ns === "team")).toEqual({ ns: "team", kind: "path", path: ".pregate/packs/team" });
  expect(candidate.scope).toEqual(preset.scope);
  expect(candidate.overrides).toEqual(preset.overrides);
});

test("digest approval of guided updates and pack adoption preserves disabled consent and binds the reviewed choice", () => {
  const p = project("disabled digest flow", nextFiles); p.init();
  expect(p.cli(["disable", "--yes"]).code).toBe(0);
  const preset = JSON.parse(p.bytes()[0]!) as Preset; preset.engine = "0.0.0";
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  for (const flags of [[], ["--packs", "typescript,react", "--enforcement", "shadow"]]) {
    const before = p.bytes();
    const preview = p.cli(["guide", "--preview", ...flags]);
    expect(preview.code, preview.text).toBe(0);
    expect(preview.text).toContain("this approval does not enable protection");
    const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
    expect(p.proposals()[0]!.activate).toBe(false);
    expect(p.bytes()).toEqual(before); expect(p.consent()).toEqual([]);
    const approved = p.cli(["approve", "--yes", "--digest", digest]);
    expect(approved.code, approved.text).toBe(0);
    expect(JSON.parse(p.bytes()[0]!).engine).toBe(VERSIONS.engine);
    expect(p.proposals()).toEqual([]); expect(p.consent()).toEqual([]);
    const view = p.cli(["guide", "--json"]);
    expect(JSON.parse(view.text).state).toBe("inactive");
  }
  expect(JSON.parse(p.bytes()[0]!).sources.map((source: { ns: string }) => source.ns)).toEqual(expect.arrayContaining(["typescript", "react"]));
});

test("compact review names enforcing import rules and their scoped sweep cost before approval", () => {
  const p = project("import sweep review", { "domain/a.ts": "export const a = 1;\n", "domain/b.ts": "export const b = 2;\n",
    "domain/generated/c.ts": "export const c = 3;\n", "outside/d.ts": "export const d = 4;\n" }); p.init();
  writeFileSync(join(p.root, "scope.json"), JSON.stringify({ why: "Review import cost in the actual selected scope.", patch: [{ op: "replace", path: "/scope",
    value: { include: ["domain/**"], exclude: ["domain/generated/**"] } }] }));
  expect(p.cli(["preset", "apply", "scope.json", "--yes"]).code).toBe(0);
  const before = p.bytes();
  for (const mode of ["enforce", "shadow"]) {
    const preview = p.cli(["guide", "--preview", "--packs", "pstack", "--enforcement", mode]);
    expect(preview.code, preview.text).toBe(0);
    const proposal = p.proposals()[0]!;
    const review = guidedReview(proposal, sha256(JSON.stringify(proposal)), false);
    if (mode === "enforce") {
      expect(review.text).toContain("Interactive import rules: pstack/PS-ZOD-001");
      expect(review.text).toContain("up to 2 source importers per call");
      expect(review.text).toContain("ordinary edits review the file alone");
      expect(review.text).toContain("A broad affected set can still exceed the interactive budget");
    } else {
      expect(review.text).not.toContain("source importers per call");
      expect(review.text).not.toContain("source importers per call");
    }
    expect(p.bytes()).toEqual(before);
  }
});

test("malformed contracts and unknown selections explain recovery and do not create an approval or mutate valid work", () => {
  const p = project("bad guided contract"); p.init();
  const preset = JSON.parse(p.bytes()[0]!); preset.unrecognized = true;
  writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset));
  const before = p.bytes(), consent = p.consent();
  const view = p.cli(["guide", "--json"]);
  expect(view.code, view.text).toBe(0);
  expect(JSON.parse(view.text).state).toBe("needs-repair");
  expect(JSON.parse(view.text).errors.join("\n")).toContain("unrecognized");
  const out = p.cli(["guide", "--preview"]);
  expect(out.code).toBe(1);
  expect(out.text).toContain("unrecognized");
  expect(p.bytes()).toEqual(before); expect(p.consent()).toEqual(consent);
  expect(p.proposals()).toEqual([]);
  const n = project("bad guided arguments", nextFiles);
  for (const args of [["--yes"], ["--preview", "--packs", "not-a-pack"], ["--preview", "--enforcement", "off"], ["--preview", "--custom-pack", "missing"], ["--preview", "--preview"], ["--projects", n.root, "--packs", "typescript"], ["--json", "--preview"]]) {
    const result = n.cli(["guide", ...args]);
    expect(result.code, result.text).toBe(1);
    expect(n.bytes()).toEqual([null, null]); expect(n.proposals()).toEqual([]); expect(n.consent()).toEqual([]);
  }
});

test("current projects are read-only no-ops and multi-project preflight rejects a bad target before applying anything", () => {
  const a = project("current no op"); a.init();
  const before = a.bytes(), consent = a.consent();
  for (let i = 0; i < 2; i++) {
    const result = a.cli(["guide", "--preview"]);
    expect(result.code, result.text).toBe(0);
    expect(a.bytes()).toEqual(before); expect(a.consent()).toEqual(consent); expect(a.proposals()).toEqual([]);
  }
  const b = project("other stale"); b.init();
  const preset = JSON.parse(b.bytes()[0]!); preset.engine = "0.0.0";
  writeFileSync(join(b.root, ".pregate/preset.json"), JSON.stringify(preset));
  const stale = b.bytes();
  const result = a.cli(["guide", "--projects", b.root, join(area, "missing project"), "--preview"]);
  expect(result.code).toBe(1);
  expect(a.bytes()).toEqual(before); expect(b.bytes()).toEqual(stale);
  expect(a.consent()).toEqual(consent);
  const fresh = project("not configured");
  const incomplete = a.cli(["guide", "--projects", b.root, fresh.root, "--preview"]);
  expect(incomplete.code, incomplete.text).toBe(1);
  expect(incomplete.text).toContain("no project contract. Configure it first:");
  expect(incomplete.text).toContain("pregate guide --preview");
  expect(incomplete.text).toContain("approve its displayed digest");
  expect(b.bytes()).toEqual(stale); expect(fresh.bytes()).toEqual([null, null]);
});

test("typed schema defects and invalid JSON remain inspectable as JSON and preserve the damaged contract for a reviewed repair", () => {
  const p = project("schema recovery", { "src/main.ts": "export const main = 1;\n" }); p.init();
  const original = JSON.parse(p.bytes()[0]!) as Preset;
  const consent = p.consent();
  for (const text of [
    JSON.stringify({ ...original, scope: { include: 42, exclude: [] } }),
    JSON.stringify({ ...original, scope: { include: ["src/**"], exclude: false } }),
    "{unclosed preset",
  ]) {
    writeFileSync(join(p.root, ".pregate/preset.json"), text);
    const before = p.bytes();
    const result = p.cli(["guide", "--json"]);
    expect(result.code, result.text).toBe(0);
    const view = JSON.parse(result.text);
    expect(view.errors.length).toBeGreaterThan(0);
    expect(["needs-repair", "needs-update"]).toContain(view.state);
    expect(view.actions.some((action: { id: string }) => action.id === "update")).toBe(true);
    expect(p.bytes()).toEqual(before); expect(p.consent()).toEqual(consent); expect(p.proposals()).toEqual([]);
  }
});

const python = Bun.which("python3");
type TerminalMutation = { index: number; path: string } & ({ text: string; mode?: never } | { mode: number; text?: never });
function terminal(p: ReturnType<typeof project>, responses: [string, string][], args = ["guide"], mutations: TerminalMutation[] = []) {
  const script = String.raw`import os, pty, select, signal, sys, time, json
argv = json.loads(sys.argv[1]); responses = json.loads(sys.argv[2]); mutations = json.loads(sys.argv[3])
pid, master = pty.fork()
if pid == 0:
    os.execv(argv[0], argv)
text = ""; index = 0; stage = 0; end = time.monotonic() + 35; status = None
while time.monotonic() < end:
    if select.select([master], [], [], .1)[0]:
        try: block = os.read(master, 65536)
        except OSError: block = b""
        if block: text += block.decode("utf-8", errors="replace")
        if index < len(responses) and responses[index][0] in text[stage:]:
            for mutation in mutations:
                if mutation["index"] == index:
                    if "mode" in mutation: os.chmod(mutation["path"], mutation["mode"])
                    else:
                        with open(mutation["path"], "w") as file: file.write(mutation["text"])
            answer = responses[index][1]
            stage = len(text); os.write(master, (answer + ("" if answer == "\x04" else "\n")).encode()); index += 1
    done, status = os.waitpid(pid, os.WNOHANG)
    if done: break
else:
    os.kill(pid, signal.SIGKILL); _, status = os.waitpid(pid, 0)
print(json.dumps({"code": os.waitstatus_to_exitcode(status), "responses": index, "text": text}))
`;
  const env: Record<string, string | undefined> = { ...p.env }; delete env.CI; delete env.PREGATE_UNATTENDED_APPROVAL; delete env.PREGATE_TESTING; delete env.PREGATE_TEST_ANSWER;
  const out = Bun.spawnSync([python!, "-c", script, JSON.stringify([binary, ...args]), JSON.stringify(responses), JSON.stringify(mutations)], { cwd: p.root, env, stdout: "pipe", stderr: "pipe", timeout: 40_000 });
  expect(out.exitCode, out.stderr.toString() + out.stdout.toString()).toBe(0);
  return JSON.parse(out.stdout.toString()) as { code: number; responses: number; text: string };
}

test.skipIf(process.platform === "win32" || python === null)("production interactive guide cancels safely and completes setup with one human approval in a real terminal", () => {
  const cancel = project("tty cancel", nextFiles);
  const rejected = terminal(cancel, [["Choose an action", "q"]]);
  expect(rejected.code, rejected.text).toBe(0); expect(rejected.responses).toBe(1);
  expect(cancel.bytes()).toEqual([null, null]); expect(cancel.consent()).toEqual([]);
  expect(cancel.installed().map(existsSync)).toEqual([false, false]);
  const p = project("tty setup", nextFiles);
  const accepted = terminal(p, [["Choose an action", "1"], ["Packs", "typescript,react"], ["Optional checks", "2"], ["Approve? [y/N]", "y"], ["Next step", "3"]]);
  expect(accepted.code, accepted.text).toBe(0); expect(accepted.responses).toBe(5);
  expect(accepted.text.match(/Approve\? \[y\/N\]/g)).toHaveLength(1);
  expect(accepted.text).not.toContain("Custom pack path");
  expect(accepted.text.match(/Custom pack idea:/g)).toHaveLength(1);
  expect(accepted.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  expect(accepted.text).toContain("Full source/rule changes: pregate approve --preview");
  const preset = JSON.parse(p.bytes()[0]!) as Preset;
  expect(preset.sources.map(s => s.ns)).toEqual(expect.arrayContaining(["core", "typescript", "react"]));
  expect(preset.sources.some(s => s.ns === "nextjs" || s.ns === "drizzle")).toBe(false);
  expect(preset.enforcement).toBe("enforce");
  expect(preset.scope?.include).toEqual(expect.arrayContaining(["app/**", "components/**", "tests/**", "proxy.ts"]));
  expect(p.consent()).toHaveLength(1);
  expect(p.proposals()).toEqual([]);
  const view = p.cli(["guide", "--json"]);
  expect(JSON.parse(view.text).counts.unverified).toBe(64);
  expect(JSON.parse(view.text).consent).toBe(true);
  expect(p.installed().map(existsSync)).toEqual([true, true]);
  expect(readFileSync(p.installed()[0]!)).toEqual(readFileSync(binary));
  expect(JSON.parse(view.text)).toMatchObject({ state: "degraded", installation: { launcherPresent: true, enginePresent: true, harnessesConfigured: 0 } });
  expect(accepted.text).toContain("agent-edit protection remains degraded");
});

test.skipIf(process.platform === "win32" || python === null)("declining the production terminal review leaves the initial contract and local consent unapplied", () => {
  const p = project("tty decline", nextFiles);
  const rejected = terminal(p, [["Choose an action", "1"], ["Packs", "none"], ["Optional checks", "1"], ["Approve? [y/N]", "n"]]);
  expect(rejected.code, rejected.text).toBe(0);
  expect(rejected.responses).toBe(4);
  expect(p.bytes()).toEqual([null, null]);
  expect(p.consent()).toEqual([]);
  expect(p.installed().map(existsSync)).toEqual([true, true]);
  const compactDigest = rejected.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(rejected.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  expect(rejected.text).not.toContain("core/CORE-INV-048");
  expect(rejected.text).not.toContain("WARNING: this may weaken protection");
  expect(p.pendingPreset().enforcement).toBe("advisor"); // answer 1 is advisor for a new project
  const compact = p.cli(["approve", "--preview"]);
  expect(compact.text).not.toContain("core/CORE-INV-048");
  expect(compact.text).toContain("Full per-rule and file detail: pregate approve --preview --full");
  const full = p.cli(["approve", "--preview", "--full"]);
  expect(full.code, full.text).toBe(0);
  expect(full.text).toContain(`Digest: ${compactDigest}`);
  expect(full.text).toContain("core/CORE-INV-048");
  expect(p.cli(["approve", "--full"]).code).toBe(1);
});

test.skipIf(process.platform === "win32" || python === null)("a documentation-derived project pack is opt-in in the terminal guide", () => {
  const docs = { ...nextFiles, "README.md": "# Booking\n\nA booking must belong to one tenant.\n" };
  const flow = (answer: string): [string, string][] => [["Choose an action", "1"], ["Packs", "none"], ["Draft a project pack", answer], ["Optional checks", "1"], ["Approve? [y/N]", "n"]];
  const skipped = project("docs draft skipped", docs);
  const declined = terminal(skipped, flow(""));
  expect(declined.responses, declined.text).toBe(5);
  expect(declined.text).toContain("1. No, use the selected packs only");
  expect(skipped.pendingPreset().sources.some(source => source.ns.startsWith("project-"))).toBe(false);
  expect(skipped.proposals()[0]!.writes.some(write => write.path.includes("/.pregate/packs/"))).toBe(false);
  const drafted = project("docs draft chosen", docs);
  expect(terminal(drafted, flow("2")).responses).toBe(5);
  expect(drafted.pendingPreset().sources.some(source => source.ns.startsWith("project-"))).toBe(true);
});

test.skipIf(process.platform === "win32" || python === null)("terminal EOF cancels guided choices and pending human review without applying the contract", () => {
  const menu = project("tty EOF menu", nextFiles);
  const cancelled = terminal(menu, [["Choose an action", "\u0004"]]);
  expect(cancelled.code, cancelled.text).toBe(0);
  expect(menu.bytes()).toEqual([null, null]); expect(menu.consent()).toEqual([]);
  const review = project("tty EOF review", nextFiles);
  const stopped = terminal(review, [["Choose an action", "1"], ["Packs", "none"], ["Optional checks", "1"], ["Approve? [y/N]", "\u0004"]]);
  expect(stopped.code, stopped.text).toBe(0);
  expect(stopped.responses).toBe(4);
  expect(review.bytes()).toEqual([null, null]); expect(review.consent()).toEqual([]);
  expect(review.installed().map(existsSync)).toEqual([true, true]);
});

test.skipIf(process.platform === "win32" || python === null)("production multi-project review confirms once, deduplicates paths, migrates pins and leaves disabled projects disabled", () => {
  const a = project("tty bulk active"); a.init();
  const b = project("tty bulk disabled"); b.init();
  expect(a.cli(["pack", "init", "team"]).code).toBe(0);
  expect(a.cli(["pack", "add", "--path", ".pregate/packs/team", "--yes"]).code).toBe(0);
  expect(b.cli(["disable", "--yes"]).code).toBe(0);
  for (const p of [a, b]) {
    const preset = JSON.parse(p.bytes()[0]!) as Preset;
    preset.engine = "0.0.0";
    preset.scope = { include: ["app/**"], exclude: ["app/generated/**"] };
    preset.overrides = { "core/CORE-INV-004": "off" };
    writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  }
  const consent = [a.consent(), b.consent()];
  const accepted = terminal(a, [["Approve? [y/N]", "y"]], ["guide", "--projects", a.root, b.root, join(a.root, ".pregate")]);
  expect(accepted.code, accepted.text).toBe(0); expect(accepted.responses).toBe(1);
  expect(accepted.text.match(/Approve\? \[y\/N\]/g)).toHaveLength(1);
  const digests = accepted.text.match(/Digest: [0-9a-f]{64}/g)!;
  expect(digests).toHaveLength(2);
  expect(new Set(digests).size).toBe(2);
  expect(accepted.text.match(/Full source\/rule changes: pregate approve --preview/g)).toHaveLength(2);
  expect(accepted.text).toContain("2/2 reviewed contracts applied");
  for (const p of [a, b]) {
    const preset = JSON.parse(p.bytes()[0]!) as Preset;
    expect(preset.engine).toBe(VERSIONS.engine);
    expect(preset.scope).toEqual({ include: ["app/**"], exclude: ["app/generated/**"] });
    expect(preset.overrides).toEqual({ "core/CORE-INV-004": "off" });
  }
  expect(JSON.parse(a.bytes()[0]!).sources).toContainEqual({ ns: "team", kind: "path", path: ".pregate/packs/team" });
  expect([a.consent(), b.consent()]).toEqual(consent);
  const before = [a.bytes(), b.bytes()];
  const repeated = terminal(a, [], ["guide", "--projects", a.root, b.root]);
  expect(repeated.code, repeated.text).toBe(0);
  expect(repeated.text).not.toContain("Approve? [y/N]");
  expect([a.bytes(), b.bytes()]).toEqual(before);
});

test.skipIf(process.platform === "win32" || python === null)("multi-project updates offer one follow-up and label current projects truthfully with only missing methodologies", () => {
  const a = project("tty grouped old", { "src/main.ts": "export const main = 1;\n" }); a.init();
  const b = project("tty grouped current", { "src/main.ts": "export const main = 1;\n" }); b.init();
  expect(b.cli(["disable", "--yes"]).code).toBe(0);
  const preview = b.cli(["guide", "--preview", "--packs", "typescript"]);
  expect(preview.code, preview.text).toBe(0);
  expect(b.cli(["approve", "--yes", "--digest", preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!]).code).toBe(0);
  const bPreset = JSON.parse(b.bytes()[0]!) as Preset;
  bPreset.methodologies = bPreset.methodologies.filter(method => method !== "typescript/anti-evasion");
  bPreset.overrides = { ...bPreset.overrides, "core/CORE-INV-003": "off" };
  writeFileSync(join(b.root, ".pregate/preset.json"), JSON.stringify(bPreset, null, 2) + "\n");
  expect(b.cli(["preset", "compile", "--yes"]).code).toBe(0);
  const missing = JSON.parse(b.cli(["guide", "--json"]).text).discovery.suggestedAdditions.find((item: { ns: string }) => item.ns === "typescript");
  expect(missing.methodologies).toEqual(["typescript/anti-evasion"]);
  const aPreset = JSON.parse(a.bytes()[0]!) as Preset; aPreset.engine = "0.0.0";
  writeFileSync(join(a.root, ".pregate/preset.json"), JSON.stringify(aPreset, null, 2) + "\n");
  const beforeB = b.bytes(), consent = [a.consent(), b.consent()];
  const accepted = terminal(a, [["Approve? [y/N]", "y"], ["Review packs or audit for all selected projects?", "3"]], ["guide", "--projects", a.root, b.root]);
  expect(accepted.code, accepted.text).toBe(0); expect(accepted.responses).toBe(2);
  expect(accepted.text.match(/Review packs or audit for all selected projects\?/g)).toHaveLength(1);
  expect(accepted.text.match(/Approve\? \[y\/N\]/g)).toHaveLength(1);
  expect(accepted.text).toContain(`Already current: ${b.root}`);
  expect(accepted.text).not.toContain(`Updated: ${b.root}`);
  expect(accepted.text).toContain("Missing suggested methodologies: clean-code/clean-code, typescript/anti-evasion.");
  expect(b.bytes()).toEqual(beforeB); expect([a.consent(), b.consent()]).toEqual(consent);
});

test.skipIf(process.platform === "win32" || python === null)("grouped optional adoption applies all chosen additions with one review and audits without more per-project choices", () => {
  const a = project("tty grouped adoption a", { "src/main.ts": "export const main = 1;\n" }); a.init();
  const b = project("tty grouped adoption b", { "src/main.ts": "export const main = 1;\n" }); b.init();
  expect(b.cli(["disable", "--yes"]).code).toBe(0);
  const consent = [a.consent(), b.consent()];
  const accepted = terminal(a, [["Review packs or audit for all selected projects?", "1"], ["Packs [all]", "typescript"], ["Approve? [y/N]", "y"]], ["guide", "--projects", a.root, b.root]);
  expect(accepted.code, accepted.text).toBe(0); expect(accepted.responses).toBe(3);
  expect(accepted.text.match(/Approve\? \[y\/N\]/g)).toHaveLength(1);
  expect(accepted.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(2);
  expect(accepted.text).not.toContain("Next step [");
  expect(accepted.text.match(/Audit completed\. Review findings/g)).toHaveLength(2);
  for (const p of [a, b]) expect(JSON.parse(p.bytes()[0]!).methodologies).toEqual(expect.arrayContaining(["typescript/strict-types", "typescript/anti-evasion"]));
  expect([a.consent(), b.consent()]).toEqual(consent);
});

test.skipIf(process.platform === "win32" || python === null)("a contract changed during the terminal's combined review prevents every project from being applied", () => {
  const a = project("tty race first"); a.init();
  const b = project("tty race second"); b.init();
  for (const p of [a, b]) {
    const preset = JSON.parse(p.bytes()[0]!); preset.engine = "0.0.0";
    writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  }
  const before = [a.bytes(), b.bytes()], consent = [a.consent(), b.consent()];
  const changed = JSON.parse(before[1]![0]!); changed.name = "concurrent team change";
  const text = JSON.stringify(changed, null, 2) + "\n";
  const result = terminal(a, [["Approve? [y/N]", "y"]], ["guide", "--projects", a.root, b.root], [{ index: 0, path: join(b.root, ".pregate/preset.json"), text }]);
  expect(result.code, result.text).toBe(1);
  expect(result.text).toContain("Nothing applied");
  expect(a.bytes()).toEqual(before[0]!);
  expect(b.bytes()).toEqual([text, before[1]![1]!]);
  expect([a.consent(), b.consent()]).toEqual(consent);
});

test.skipIf(process.platform === "win32" || python === null || process.getuid?.() === 0)("a multi-project write failure retains the earlier success and offers only the failed project for retry", () => {
  const a = project("tty write succeeds"); a.init();
  const b = project("tty write fails"); b.init();
  for (const p of [a, b]) {
    expect(p.cli(["disable", "--yes"]).code).toBe(0);
    const preset = JSON.parse(p.bytes()[0]!); preset.engine = "0.0.0";
    writeFileSync(join(p.root, ".pregate/preset.json"), JSON.stringify(preset, null, 2) + "\n");
  }
  const before = [a.bytes(), b.bytes()], consent = [a.consent(), b.consent()];
  const directory = join(b.root, ".pregate"), mode = statSync(directory).mode & 0o777;
  const result = withCleanup(() => terminal(a, [["Approve? [y/N]", "y"]], ["guide", "--projects", a.root, b.root], [{ index: 0, path: directory, mode: 0o555 }]),
    () => chmodSync(directory, mode));
  expect(result.code, result.text).toBe(1);
  expect(result.text).toContain("1/2 reviewed contracts applied");
  expect(result.text).toContain("Earlier successes are retained");
  expect(result.text).toContain("Retry only:");
  const retry = result.text.split("Retry only:")[1]!;
  expect(retry).toContain(b.root); expect(retry).not.toContain(a.root);
  expect(JSON.parse(a.bytes()[0]!).engine).toBe(VERSIONS.engine);
  expect(a.bytes()).not.toEqual(before[0]!);
  expect(b.bytes()).toEqual(before[1]!);
  expect([a.consent(), b.consent()]).toEqual(consent);
  const retained = a.bytes();
  const retried = terminal(a, [["Approve? [y/N]", "y"]], ["guide", "--projects", b.root]);
  expect(retried.code, retried.text).toBe(0);
  expect(retried.text).toContain("1/1 reviewed contracts applied");
  expect(retried.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  expect(a.bytes()).toEqual(retained);
  expect(JSON.parse(b.bytes()[0]!).engine).toBe(VERSIONS.engine);
  expect([a.consent(), b.consent()]).toEqual(consent);
});

test.skipIf(process.platform === "win32" || python === null)("a changed contract cannot gain consent from an earlier terminal activation review", () => {
  const p = project("tty activation race"); p.init();
  expect(p.cli(["disable", "--yes"]).code).toBe(0);
  const before = p.bytes();
  const preset = JSON.parse(before[0]!); preset.name = "changed during activation review";
  const text = JSON.stringify(preset, null, 2) + "\n";
  const result = terminal(p, [["Choose an action", "1"], ["Approve? [y/N]", "y"]], ["guide"], [{ index: 1, path: join(p.root, ".pregate/preset.json"), text }]);
  expect(result.code, result.text).toBe(1);
  expect(p.bytes()).toEqual([text, before[1]!]);
  expect(p.consent()).toEqual([]);
});

test.skipIf(process.platform === "win32" || python === null)("explicit activation reviews one current digest and enables only the selected worktree", () => {
  const p = project("tty explicit activation"); p.init();
  expect(p.cli(["disable", "--yes"]).code).toBe(0);
  const before = p.bytes();
  const result = terminal(p, [["Choose an action", "1"], ["Approve? [y/N]", "y"], ["Next step", "3"]]);
  expect(result.code, result.text).toBe(0);
  expect(result.text).toContain("Approval activates this worktree");
  expect(result.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
  expect(result.text.match(/Approve\? \[y\/N\]/g)).toHaveLength(1);
  expect(p.bytes()).toEqual(before); expect(p.proposals()).toEqual([]); expect(p.consent()).toHaveLength(1);
});

test.skipIf(process.platform === "win32" || python === null)("the production onboarding audit offers concrete repairs while leaving existing application code untouched", () => {
  const code = "test.only('one path', () => {});\n";
  const p = project("tty repairs", { ...nextFiles, "tests/focused.test.ts": code });
  const result = terminal(p, [["Choose an action", "1"], ["Packs", "none"], ["Optional checks", "2"], ["Approve? [y/N]", "y"], ["Next step", "2"]]);
  expect(result.code, result.text).toBe(0);
  expect(result.text).toContain("TDD-FOCUS-001");
  expect(result.text).toContain("Verify:");
  expect(result.text).toContain("pregate audit");
  expect(readFileSync(join(p.root, "tests/focused.test.ts"), "utf8")).toBe(code);
  expect(p.consent()).toHaveLength(1);
});

test.skipIf(process.platform === "win32" || python === null)("choosing freeze preserves existing findings and makes the no-new policy explicit without certifying unverified rules", () => {
  const code = "test.only('existing defect', () => {});\n";
  const p = project("tty freeze", { ...nextFiles, "tests/focused.test.ts": code });
  const result = terminal(p, [["Choose an action", "1"], ["Packs", "none"], ["Optional checks", "2"], ["Approve? [y/N]", "y"], ["Next step", "1"]]);
  expect(result.code, result.text).toBe(0);
  expect(result.text).toContain("Done. Existing debt is the baseline; the agent is only told about new problems.");
  expect(result.text).not.toContain("ratchet --base");
  expect(JSON.parse(p.bytes()[0]!).ratchet.mode).toBe("no-new");
  expect(readFileSync(join(p.root, "tests/focused.test.ts"), "utf8")).toBe(code);
  const audit = p.cli(["audit", "--json"]);
  const report = JSON.parse(audit.text);
  expect(report.findings.some((finding: { rule: string }) => finding.rule.endsWith("TDD-FOCUS-001"))).toBe(true);
  expect(report.fitness.some((rule: { status: string }) => rule.status === "unverified")).toBe(true);
});

test.skipIf(process.platform === "win32" || python === null)("freeze in Git asks to commit the baseline only when approval could not commit it", () => {
  const code = "test.only('existing defect', () => {});\n";
  for (const commits of [true, false]) {
    const p = project(`tty freeze git ${commits}`, { ...nextFiles, "tests/focused.test.ts": code }, true);
    for (const [k, v] of [["user.name", "T"], ["user.email", "t@example.com"], ["commit.gpgsign", "false"]]) Bun.spawnSync(["git", "-C", p.root, "config", k!, v!]);
    // A refusing pre-commit hook stands for any repository that cannot commit now.
    if (!commits) { writeFileSync(join(p.root, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n"); chmodSync(join(p.root, ".git/hooks/pre-commit"), 0o755); }
    const result = terminal(p, [["Choose an action", "1"], ["Packs", "none"], ["Optional checks", "2"], ["Approve? [y/N]", "y"], ["Next step", "1"]]);
    expect(result.code, result.text).toBe(0);
    expect(result.text).toContain("Existing debt is the baseline");
    if (commits) expect(result.text).not.toContain("not committed yet");
    else expect(result.text).toContain("The contract is not committed yet: commit .pregate/preset.json and .pregate/pregate.lock.json, then CI can run pregate check --ratchet --base");
  }
});

test.skipIf(process.platform === "win32" || python === null)("a current multi-project no-op does not apply an unrelated pending pack proposal", () => {
  const p = project("tty noop pending"); p.init();
  const before = p.bytes(), consent = p.consent();
  const preview = p.cli(["guide", "--preview", "--packs", "typescript"]);
  expect(preview.code, preview.text).toBe(0);
  expect(p.pendingPreset().sources.some(source => source.ns === "typescript")).toBe(true);
  const pending = p.proposals();
  const result = terminal(p, [], ["guide", "--projects", p.root]);
  expect(result.code, result.text).toBe(0);
  expect(result.text).not.toContain("Approve? [y/N]");
  expect(p.bytes()).toEqual(before); expect(p.consent()).toEqual(consent);
  expect(p.proposals()).toEqual(pending);
  expect(p.installed().map(existsSync)).toEqual([false, false]);
});

test.skipIf(process.platform === "win32" || python === null)("an existing incompatible immutable engine prevents guided activation and retains its original bytes", () => {
  const p = project("tty incompatible engine", nextFiles);
  const engine = p.installed()[0]!;
  mkdirSync(dirname(engine), { recursive: true });
  const wrong = "#!/bin/sh\nprintf 'pregate 9.9.9 (core 0.0.0)\\n'\n";
  writeFileSync(engine, wrong); chmodSync(engine, 0o755);
  const result = terminal(p, [["Choose an action", "1"], ["Packs", "none"], ["Optional checks", "1"]]);
  expect(result.code, result.text).toBe(1);
  expect(result.text).not.toContain("Approve? [y/N]");
  expect(result.text).toMatch(/engine|Engine/);
  expect(p.bytes()).toEqual([null, null]); expect(p.consent()).toEqual([]);
  expect(readFileSync(engine, "utf8")).toBe(wrong);
});
