import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { applyReviewedProposal } from "../src/approval-command.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import type { Proposal } from "../src/proposal.ts";
import type { Lock, Preset } from "../src/types.ts";
import { engineAt } from "./compiled-engine.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { confirmOnTerminal } from "../scripts/confirm-terminal.ts";
import { removeTree } from "./remove-tree.ts";
import { arkConfig, arkFiles } from "./arkgate-fixture.ts";

// A release binary: PREGATE_TEST_ANSWER cannot approve it. POSIX types y on a pseudo-terminal.
// Windows has no /dev/tty, so the same reviewed proposal is applied in-process after a piped approve refuses.
setDefaultTimeout(180_000);
const area = mkdtempSync(join(tmpdir(), "pregate-arkgate-e2e-"));
const binary = join(area, ENGINE_FILE);

beforeAll(() => engineAt(binary, false), 180_000);
afterAll(() => removeTree(area));

function git(root: string, args: string[]): void {
  const out = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  expect(out.exitCode, `${args.join(" ")}\n${out.stderr.toString()}`).toBe(0);
}

function project(name: string, withConfig: boolean) {
  const root = canonical(join(area, name));
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(arkFiles)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  if (withConfig) writeFileSync(join(root, "ark.config.json"), `${JSON.stringify(arkConfig, null, 2)}\n`);
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "pregate-test@example.com"]);
  git(root, ["config", "user.name", "Pregate Test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "fixture"]);
  const path = process.platform === "win32" ? pathWithoutHarnesses() : "/usr/bin:/bin:/usr/sbin:/sbin";
  const env: Record<string, string | undefined> = {
    ...process.env, HOME: join(area, `${name}-home`), XDG_DATA_HOME: join(area, `${name}-data`), XDG_STATE_HOME: join(area, `${name}-state`),
    TMPDIR: area, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "Pregate Test", GIT_AUTHOR_EMAIL: "pregate-test@example.com",
    GIT_COMMITTER_NAME: "Pregate Test", GIT_COMMITTER_EMAIL: "pregate-test@example.com",
    PATH: path, ...(process.platform === "win32" ? { Path: path } : {}),
  };
  delete env.PREGATE_TESTING; delete env.PREGATE_TEST_ANSWER;
  const run = (args: string[]) => {
    const out = Bun.spawnSync([binary, ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 90_000 });
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  return { root, env, run };
}

function pending(data: string): Proposal {
  const dir = join(data, "pregate/proposals");
  const proposals = readdirSync(dir).filter(name => name.endsWith(".json") && name !== "batch.json")
    .map(name => JSON.parse(readFileSync(join(dir, name), "utf8")) as Proposal);
  expect(proposals).toHaveLength(1);
  return proposals[0]!;
}

function proposedPreset(data: string): Preset {
  const write = pending(data).writes.find(item => item.path.replaceAll("\\", "/").endsWith("/.pregate/preset.json"));
  expect(write?.after).toBeTruthy();
  return JSON.parse(write!.after!) as Preset;
}

async function approve(root: string, env: Record<string, string | undefined>, preview: string): Promise<{ code: number; text: string }> {
  const digest = /Digest: ([a-f0-9]{64})/.exec(preview)?.[1];
  const code = /pregate approve ([a-f0-9]{12})\b/.exec(preview)?.[1];
  expect(digest, preview).toMatch(/^[a-f0-9]{64}$/);
  expect(code, preview).toMatch(/^[a-f0-9]{12}$/);
  const piped = Bun.spawnSync([binary, "approve", code!], {
    cwd: root, env: { ...env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" }, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  expect(piped.exitCode).toBe(1);
  const refused = piped.stdout.toString();
  expect(refused).toContain("no terminal");
  expect(refused).toContain(`pregate approve ${code}`);
  if (process.platform !== "win32") {
    const accepted = confirmOnTerminal([binary, "approve", code!], root, env, "y");
    return { code: accepted.code, text: accepted.stdout + accepted.stderr };
  }
  const previous = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = env.XDG_DATA_HOME;
  try {
    const proposal = pending(env.XDG_DATA_HOME!);
    return await applyReviewedProposal(canonical(root), digest!, { activate: proposal.activate !== false, commit: true });
  } finally {
    if (previous === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = previous;
  }
}

test("import preview, human approval, and a rule ArkGate owns is not reported twice", async () => {
  const repo = project("governed", false);
  const guide = repo.run(["guide", "--preview", "--enforcement", "advisor", "--preset", "legacy-safe"]);
  expect(guide.code, guide.text).toBe(0);
  expect(proposedPreset(repo.env.XDG_DATA_HOME!).coexist).toBeUndefined();
  const first = await approve(repo.root, repo.env, guide.stdout);
  expect(first.code, first.text).toBe(0);
  expect(first.text).toContain("Approved contract applied");
  const preset = () => JSON.parse(readFileSync(join(repo.root, ".pregate/preset.json"), "utf8")) as Preset;
  const lock = () => JSON.parse(readFileSync(join(repo.root, ".pregate/pregate.lock.json"), "utf8")) as Lock;
  expect(preset().coexist).toBeUndefined();

  writeFileSync(join(repo.root, "ark.config.json"), `${JSON.stringify(arkConfig, null, 2)}\n`);
  const inspected = repo.run(["guide", "--json"]);
  expect(inspected.code, inspected.text).toBe(0);
  const info = JSON.parse(inspected.stdout) as { arkgate: { suggestion: string } | null };
  expect(info.arkgate?.suggestion).toContain("pregate import arkgate --preview");
  expect(info.arkgate?.suggestion).toContain("ark.config.json");

  const before = readFileSync(join(repo.root, ".pregate/preset.json"), "utf8");
  const refused = repo.run(["import", "arkgate"]);
  expect(refused.code).toBe(1);
  expect(refused.text).toContain("only prepares a review");
  expect(readFileSync(join(repo.root, ".pregate/preset.json"), "utf8")).toBe(before);

  const preview = repo.run(["import", "arkgate", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.stdout).toContain("domain-model");
  expect(preview.stdout).toContain("architecture/CA-DEP-001");
  expect(preview.stdout).toContain("src/domain/**/*.spec.ts");
  expect(preview.stdout).toContain("The 2 existing breaks stay as known debt under no-new.");
  expect(preview.stdout).toContain("code outside every layer");
  expect(preview.stdout).toContain("A new break is not reported by PREGATE; ArkGate already enforces layer direction.");
  expect(preview.stdout).not.toContain("not proposed");
  const proposed = proposedPreset(repo.env.XDG_DATA_HOME!);
  expect(proposed.layers?.["domain-model"]).toMatchObject({ kind: "core", paths: ["src/domain/**"], mayImport: ["kernel"] });
  expect(Object.keys(proposed.layers ?? {}).sort()).toEqual(["application-orchestration", "domain-model", "kernel", "persistence-adapters", "presentation-adapters"]);
  expect(proposed.coexist?.arkgate?.config).toBe("ark.config.json");
  expect(proposed.coexist?.arkgate?.ownedByArkgate).toEqual(["architecture/CA-DEP-001"]);
  expect(proposed.enforcement).toBe("advisor");

  const applied = await approve(repo.root, repo.env, preview.stdout);
  expect(applied.code, applied.text).toBe(0);
  expect(applied.text).toContain("Approved contract applied");
  expect(preset().layers?.["domain-model"]).toEqual({ paths: ["src/domain/**"], mayImport: ["kernel"], kind: "core" });
  expect(preset().coexist?.arkgate?.ownedByArkgate).toEqual(["architecture/CA-DEP-001"]);
  expect(lock().ownedByArkgate.filter(id => id === "architecture/CA-DEP-001")).toEqual(["architecture/CA-DEP-001"]);
  expect(lock().rules.some(rule => rule.id === "architecture/CA-DEP-001")).toBe(true);
  expect(preset().enforcement).toBe("advisor");

  writeFileSync(join(repo.root, "src/domain/fresh.ts"), "import { save } from \"../adapters/persistence/db\";\nexport function fresh(id: string): string { return save(id); }\n");
  const audit = repo.run(["audit", "--json"]);
  expect(audit.code, audit.text).toBe(0);
  const report = JSON.parse(audit.stdout) as {
    findings: { rule: string; check: string; path: string }[];
    skippedRules: { rule: string; check: string; reason: string }[];
    fileCoverage: { path: string }[];
  };
  expect(report.fileCoverage.map(file => file.path)).toContain("src/domain/fresh.ts");
  expect(report.findings.filter(finding => finding.rule === "architecture/CA-DEP-001" || finding.check.includes("layer-direction"))).toEqual([]);
  expect(report.skippedRules.filter(rule => rule.rule === "architecture/CA-DEP-001")).toEqual([
    expect.objectContaining({ rule: "architecture/CA-DEP-001", reason: "Owned by ArkGate; use its audit." }),
  ]);
  const explained = repo.run(["explain", "architecture/CA-DEP-001"]);
  expect(explained.code, explained.text).toBe(0);
  expect(explained.stdout).toContain("owned by ArkGate, not evaluated");
  const status = repo.run(["status"]);
  expect(status.code, status.text).toBe(0);
  expect(status.stdout).toContain("owned by ArkGate");

  const approved = readFileSync(join(repo.root, ".pregate/preset.json"), "utf8");
  const again = repo.run(["import", "arkgate", "--preview"]);
  expect(again.code, again.text).toBe(0);
  expect(again.stdout).toContain("already in this contract");
  expect(readFileSync(join(repo.root, ".pregate/preset.json"), "utf8")).toBe(approved);
});

test("guide on a new project detects ark.config.json and includes the import", () => {
  const repo = project("new-with-ark", true);
  const inspected = repo.run(["guide", "--json"]);
  expect(inspected.code, inspected.text).toBe(0);
  const info = JSON.parse(inspected.stdout) as { arkgate: { suggestion: string } | null };
  expect(info.arkgate?.suggestion).toContain("pregate import arkgate --preview");
  const preview = repo.run(["guide", "--preview"]);
  expect(preview.code, preview.text).toBe(0);
  expect(preview.stdout).toContain("domain-model");
  expect(preview.stdout).toContain("architecture/CA-DEP-001");
  expect(preview.stdout).toContain("A new break is not reported by PREGATE; ArkGate already enforces layer direction.");
  expect(preview.stdout).not.toContain("not proposed");
  const proposed = proposedPreset(repo.env.XDG_DATA_HOME!);
  expect(proposed.layers?.["domain-model"]?.kind).toBe("core");
  expect(proposed.coexist?.arkgate?.config).toBe("ark.config.json");
  expect(proposed.coexist?.arkgate?.ownedByArkgate).toContain("architecture/CA-DEP-001");
});
