import { beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyPreset, applyReviewedProposal, approvePending, pendingReview, validateReviewedProposal } from "../src/approval-command.ts";
import { BUILTIN } from "../src/assets.ts";
import { canonical } from "../src/disk.ts";
import { disable, enabled } from "../src/consent.ts";
import { grammars, LOCK, PRESET, VERSIONS } from "../src/gate.ts";
import { init } from "../src/init.ts";
import { onboardingPreset } from "../src/onboard.ts";
import { composePackPlan, projectUpdate } from "../src/pack-command.ts";
import { packTemplate } from "../src/pack-template.ts";
import { PENDING_MS, readProposal } from "../src/proposal.ts";
import { scan } from "../src/scan-command.ts";
import { H, sha256 } from "../src/state.ts";
import type { Preset } from "../src/types.ts";

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

setDefaultTimeout(30_000);
beforeAll(() => grammars());

async function project(run: (root: string, area: string) => Promise<void>) {
  const area = mkdtempSync(join(tmpdir(), "pregate-setup-api-"));
  const root = canonical(join(area, "project with spaces"));
  mkdirSync(root);
  const values = { HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"),
    CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  await withCleanupAsync(() => run(root, area), () => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(area, { recursive: true, force: true });
  });
}

function localPack(root: string) {
  const path = "team rules";
  for (const [rel, text] of Object.entries(packTemplate("team"))) {
    const file = join(root, path, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return path;
}

function proposal(root: string) {
  const pending = readProposal(root)!;
  expect(pending).not.toBeNull();
  return { pending, digest: sha256(JSON.stringify(pending)) };
}

test("object-based pack composition preserves the input policy and diagnoses unknown or empty choices without contract writes", async () => {
  await project(async root => {
    const preset = onboardingPreset("integrity-only", BUILTIN, VERSIONS)!;
    preset.scope = { include: ["app/**"], exclude: ["app/generated/**"] };
    preset.overrides = { "core/CORE-INV-001": "off" };
    const before = structuredClone(preset);
    const composed = composePackPlan(root, preset, { sources: [{ kind: "library", ns: "typescript" }, { kind: "library", ns: "testing" }],
      methodologies: ["typescript/strict-types", "testing/tdd"] });
    expect(composed).not.toHaveProperty("errors");
    expect(preset).toEqual(before);
    expect(composed).toMatchObject({ scope: before.scope, overrides: before.overrides });
    expect((composed as Preset).methodologies).toContain("core/pregate-integrity");
    expect((composed as Preset).methodologies).toContain("testing/tdd");
    expect(existsSync(join(root, PRESET))).toBe(false);
    for (const plan of [
      { sources: [], methodologies: [] },
      { sources: [{ kind: "library", ns: "" }], methodologies: ["testing/tdd"] },
      { sources: [{ kind: "library", ns: "missing" }], methodologies: ["missing/policy"] },
      { sources: [], methodologies: ["unknown/policy"] },
      { sources: [], methodologies: ["testing/tdd"], permission: "yes" },
    ]) expect(composePackPlan(root, preset, plan)).toHaveProperty("errors");
    expect(existsSync(join(root, LOCK))).toBe(false);
    expect(enabled(root)).toBe(false);
  });
});

test("a reviewed plan may declare layers for a layered methodology; invalid layers are rejected", async () => {
  await project(async root => {
    const preset = onboardingPreset("integrity-only", BUILTIN, VERSIONS)!;
    const layers = { domain: { paths: ["source/domain/**"], mayImport: [], kind: "core" }, infra: { paths: ["source/infra/**"], mayImport: ["domain"], kind: "adapter" } };
    const plan = { sources: [{ kind: "library", ns: "architecture" }], methodologies: ["architecture/clean-architecture"], layers };
    const composed = composePackPlan(root, preset, plan);
    expect(composed).not.toHaveProperty("errors");
    expect((composed as Preset).layers).toEqual(layers as Preset["layers"]);
    expect((composed as Preset).methodologies).toContain("architecture/clean-architecture");
    expect(composePackPlan(root, preset, { ...plan, layers: { domain: { ...layers.domain, kind: "x" } } })).toHaveProperty("errors");
    expect(composePackPlan(root, preset, { sources: [], methodologies: [], layers })).toMatchObject({ layers });
    expect(existsSync(join(root, PRESET))).toBe(false);
  });
});

test("initial setup combines five chosen packs, exact methodologies, custom rules and scope into one digest-bound proposal", async () => {
  await project(async root => {
    expect(Bun.spawnSync(["git", "init", "-q", root]).exitCode).toBe(0);
    mkdirSync(join(root, "app"));
    writeFileSync(join(root, "app/page.tsx"), "export default function Page() { return <main>Hello</main>; }\n");
    const custom = localPack(root);
    const selection = { packs: ["typescript", "react", "nextjs", "authjs", "drizzle"], customPacks: [custom],
      methodologies: ["typescript/strict-types", "react/hooks", "nextjs/rendering", "authjs/session", "drizzle/queries"],
      enforcement: "enforce" as const, scope: { include: ["app/**"], exclude: ["app/generated/**"] } };
    const cwd = process.cwd();
    const result = await init(["--preview", "--preset", "integrity-only"], selection, join(root, "app"));
    expect(result.code, result.text).toBe(0);
    expect(process.cwd()).toBe(cwd);
    const { pending, digest } = proposal(root);
    expect(result.text.match(/Digest: /g)).toHaveLength(1);
    expect(pending.writes).toHaveLength(1);
    const candidate = JSON.parse(pending.writes[0]!.after!) as Preset;
    expect(candidate.scope).toEqual(selection.scope);
    expect(candidate.enforcement).toBe("enforce");
    expect(candidate.sources.map(source => source.ns).sort()).toEqual(["core", ...selection.packs, "team"].sort());
    expect(candidate.methodologies.sort()).toEqual(["core/pregate-integrity", ...selection.methodologies, "team/team"].sort());
    expect(candidate.methodologies).not.toContain("react/components");
    expect(existsSync(join(root, PRESET))).toBe(false);
    expect(enabled(root)).toBe(false);
    expect((await validateReviewedProposal(root, digest)).code).toBe(0);
    expect(readProposal(root)).toEqual(pending);
    expect(existsSync(join(root, PRESET))).toBe(false);
    const wrongDigest = await applyReviewedProposal(root, "0".repeat(64), { activate: true });
    expect(wrongDigest.code).toBe(1);
    expect(wrongDigest.text).toContain("supplied digest does not match");
    expect(wrongDigest.text).toContain("pregate approve --preview");
    expect(wrongDigest.text).not.toContain("changed since review");
    expect(readProposal(root)).toEqual(pending);
    expect(existsSync(join(root, LOCK))).toBe(false);
    expect((await approvePending(root, true, digest)).code).toBe(0);
    expect(readFileSync(join(root, LOCK), "utf8")).toBe(pending.lockText);
    expect(enabled(root)).toBe(true);
    expect(readProposal(root)).toBeNull();
  });
});

test("standalone initialization retains recipe policies with empty additions and detects scope; invalid selections preserve its pending review", async () => {
  await project(async root => {
    mkdirSync(join(root, "components"));
    writeFileSync(join(root, "components/button.tsx"), "export const Button = () => <button>Save</button>;\n");
    const result = await init(["--preview", "--preset", "legacy-safe"], { packs: [], customPacks: [] }, root);
    expect(result.code, result.text).toBe(0);
    const before = proposal(root).pending;
    const candidate = JSON.parse(before.writes[0]!.after!) as Preset;
    expect(candidate.methodologies).toContain("clean-code/clean-code");
    expect(candidate.methodologies).toContain("testing/tdd");
    expect(candidate.scope?.include).toContain("components/**");
    for (const selection of [{ packs: [""] }, { packs: ["unknown"] }, { customPacks: [""] }, { methodologies: [""] }]) {
      expect((await init(["--preview", "--preset", "legacy-safe"], selection, root)).code).toBe(1);
      expect(readProposal(root)).toEqual(before);
      expect(existsSync(join(root, PRESET))).toBe(false);
    }
  });
});

test("preview recovery distinguishes missing reviews, wrong digests and changed project contracts", async () => {
  await project(async root => {
    expect(() => pendingReview(root)).toThrow("pregate guide --preview");
    expect((await init(["--yes", "--preset", "integrity-only"], {}, root)).code).toBe(0);
    const path = join(root, PRESET), before = readFileSync(path, "utf8");
    const next = { ...JSON.parse(before), name: "proposed" };
    expect((await applyPreset(root, JSON.stringify(next), { preview: true })).code).toBe(0);
    const reviewed = proposal(root);
    expect(() => pendingReview(root, "0".repeat(64))).toThrow("supplied digest does not match");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(before), name: "changed" }));
    expect(() => pendingReview(root)).toThrow("contract or proposed files changed");
    expect(() => pendingReview(root)).toThrow("pregate guide --preview");
    expect(readProposal(root)).toEqual(reviewed.pending);
  });
});

test("a preview whose preset excludes an unescaped [view] folder names the dead glob and its escaped form (#66)", async () => {
  await project(async root => {
    expect((await init(["--yes", "--preset", "integrity-only"], {}, root)).code).toBe(0);
    mkdirSync(join(root, "src/app/[view]"), { recursive: true });
    writeFileSync(join(root, "src/app/[view]/page.ts"), "export const page = 1;\n");
    const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset;
    const dead = { ...preset, scope: { ...preset.scope, exclude: [...preset.scope?.exclude ?? [], "src/app/[view]/**"] } };
    const preview = await applyPreset(root, JSON.stringify(dead, null, 2) + "\n", { preview: true });
    expect(preview.text).toContain('Globs matching no project file: src/app/[view]/** (in JSON: "src/app/\\\\[view\\\\]/**")');
    expect(pendingReview(root).text).toContain("matching no project file");
    // The PreToolUse gate's approval prompt never lists the project for this advisory.
    expect(pendingReview(root, undefined, false, false).text).not.toContain("matching no project file");
    const fixed = { ...preset, scope: { ...preset.scope, exclude: [...preset.scope?.exclude ?? [], "src/app/\\[view\\]/**"] } };
    expect((await applyPreset(root, JSON.stringify(fixed, null, 2) + "\n", { preview: true })).text).not.toContain("matching no project file");
  });
});

test("reviewed application preserves inactive consent and rejects replaced, expired or changed-source proposals", async () => {
  await project(async (root, area) => {
    const custom = localPack(root);
    expect((await init(["--preview", "--preset", "integrity-only"], { customPacks: [custom] }, root)).code).toBe(0);
    const initial = proposal(root);
    expect((await applyReviewedProposal(root, initial.digest, { activate: false })).code).toBe(1);
    expect((await applyReviewedProposal(root, initial.digest, { activate: true })).code).toBe(0);
    expect(enabled(root)).toBe(true);
    disable(root);
    const paths = [join(root, PRESET), join(root, LOCK)];
    const before = paths.map(path => readFileSync(path, "utf8"));
    const preset = JSON.parse(before[0]!) as Preset;
    preset.name = "reviewed-change";
    expect((await applyPreset(root, JSON.stringify(preset, null, 2) + "\n", { preview: true })).code).toBe(0);
    const first = proposal(root);
    preset.name = "replacement";
    expect((await applyPreset(root, JSON.stringify(preset, null, 2) + "\n", { preview: true })).code).toBe(0);
    expect((await applyReviewedProposal(root, first.digest, { activate: false })).code).toBe(1);
    expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
    const current = proposal(root);
    const fixture = join(root, custom, "checks/complexity/fn-max-params/fixtures/pass/two/files/src/a.ts");
    writeFileSync(fixture, "export function invalid(a, b, c) {}\n");
    const invalid = await validateReviewedProposal(root, current.digest);
    expect(invalid.code).toBe(1);
    expect(invalid.text).toContain("FAIL team/complexity/fn-max-params");
    expect(readProposal(root)).toEqual(current.pending);
    expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
    const stale = await applyReviewedProposal(root, current.digest, { activate: false });
    expect(stale.code).toBe(1);
    expect(stale.text).toContain("stale or invalid");
    expect(stale.text).toContain("source or contract no longer matches");
    expect(stale.text).toContain("pregate guide --preview");
    expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
    expect(enabled(root)).toBe(false);
    writeFileSync(fixture, packTemplate("team")["checks/complexity/fn-max-params/fixtures/pass/two/files/src/a.ts"]!);
    expect((await applyPreset(root, JSON.stringify(preset, null, 2) + "\n", { preview: true })).code).toBe(0);
    const expires = proposal(root);
    writeFileSync(join(area, "data/pregate/proposals", `${H(root)}.json`), JSON.stringify({ ...expires.pending, at: Date.now() - PENDING_MS - 1 }));
    expect((await applyReviewedProposal(root, expires.digest, { activate: false })).code).toBe(1);
    expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
    expect(readProposal(root)).toBeNull();
  });
});

test("digest approval preserves disabled update and adoption consent while binding explicit activation intent", async () => {
  await project(async root => {
    expect((await init(["--yes", "--preset", "integrity-only"], {}, root)).code).toBe(0);
    expect(enabled(root)).toBe(true);
    disable(root);
    const path = join(root, PRESET);
    const stale = JSON.parse(readFileSync(path, "utf8")) as Preset;
    stale.engine = "0.0.0";
    writeFileSync(path, JSON.stringify(stale, null, 2) + "\n");
    const update = await projectUpdate(["--preview"], root);
    expect(update.code, update.text).toBe(0);
    expect(update.text).toContain("Local consent is preserved");
    const migration = proposal(root);
    expect(migration.pending.activate).toBe(false);
    expect((await approvePending(root, true, migration.digest)).code).toBe(0);
    expect(enabled(root)).toBe(false);
    const preset = JSON.parse(readFileSync(path, "utf8")) as Preset;
    const candidate = composePackPlan(root, preset, { sources: [{ kind: "library", ns: "testing" }], methodologies: ["testing/tdd"] });
    expect(candidate).not.toHaveProperty("errors");
    expect((await applyPreset(root, JSON.stringify(candidate, null, 2) + "\n", { preview: true })).code).toBe(0);
    const adoption = proposal(root);
    const proposalFile = join(process.env.XDG_DATA_HOME!, "pregate/proposals", `${H(root)}.json`);
    writeFileSync(proposalFile, JSON.stringify({ ...adoption.pending, activate: true }));
    expect((await approvePending(root, true, adoption.digest)).code).toBe(1);
    expect(enabled(root)).toBe(false);
    expect(readFileSync(path, "utf8")).toBe(JSON.stringify(preset, null, 2) + "\n");
    writeFileSync(proposalFile, JSON.stringify(adoption.pending));
    expect((await applyReviewedProposal(root, adoption.digest, { activate: true })).code).toBe(1);
    expect(enabled(root)).toBe(false);
    expect((await approvePending(root, true, adoption.digest)).code).toBe(0);
    expect(enabled(root)).toBe(false);
    const activation = await applyPreset(root, readFileSync(path, "utf8"), { preview: true, activate: true });
    expect(activation.code).toBe(0);
    expect(activation.text).toContain("enables local worktree consent");
    expect(activation.text).toContain("Working engine, launcher and hooks are required");
    const reviewed = proposal(root);
    expect(reviewed.pending.activate).toBe(true);
    expect((await approvePending(root, true, reviewed.digest)).code).toBe(0);
    expect(enabled(root)).toBe(true);
  });
});

test("scan inventories an explicit project without changing cwd, adding a contract or activating consent", async () => {
  await project(async root => {
    mkdirSync(join(root, "app"));
    writeFileSync(join(root, "app/page.tsx"), "export const page = 1;\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { next: "16.0.0", react: "19.0.0", "drizzle-orm": "1.0.0" } }));
    const cwd = process.cwd();
    const result = await scan(["--json"], root);
    expect(result.code, result.text).toBe(0);
    expect(JSON.parse(result.text).root).toBe(root);
    expect(JSON.parse(result.text).recommendations.map((item: { ns: string }) => item.ns)).toEqual(["drizzle", "nextjs", "react", "typescript"]);
    expect(process.cwd()).toBe(cwd);
    expect(existsSync(join(root, PRESET))).toBe(false);
    expect(enabled(root)).toBe(false);
  });
});
