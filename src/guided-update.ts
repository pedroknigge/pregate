import { statSync } from "node:fs";
import { join } from "node:path";
import { humanApprovalInstructions } from "./approval.ts";
import { dataHome } from "./consent.ts";
import { visible } from "./contract.ts";
import { canonical, findRoot } from "./disk.ts";
import { say } from "./guided-terminal.ts";
import { launcherVersion } from "./admission.ts";
import { update } from "./machine.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { compareVersions, ENGINE_VERSION } from "./product.ts";
import { latestRelease } from "./release-download.ts";
import { VERSIONS } from "./versions.ts";

type Result = { code: number; text: string };

function installedVersion(): string | null {
  return launcherVersion(dataHome());
}

function ready(binary: string): boolean {
  const stat = statSync(binary, { throwIfNoEntry: false });
  return stat?.isFile() === true && stat.size > 0 && (WINDOWS || (stat.mode & 0o111) !== 0);
}

function recovery(text: string): Result {
  return { code: 1, text: visible(`${text}\nKeep the project contract and protection. Fix the named installation or access problem, then retry pregate guide. Project migration requires its own reviewed approval.`) };
}

async function continueInstalled(version: string): Promise<Result> {
  const binary = join(dataHome(), version, ENGINE_FILE);
  if (!ready(binary)) return recovery(`Engine ${version} is missing or is not executable. The human can run ! pregate update --engine ${version}, then pregate doctor.`);
  const probe = Bun.spawnSync([binary, "guide", "--help"], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  if (probe.exitCode === 0 && /pregate guide\b/.test(probe.stdout.toString())) {
    // The release owns its own rules and coordinator. Keep the human terminal intact.
    const result = Bun.spawnSync([binary, "guide"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    return { code: result.exitCode ?? 1, text: result.exitCode === 0 ? "Global update and guided project session finished." : "The installed engine's guide did not finish. Run pregate doctor and retry; keep the project contract." };
  }
  if (probe.exitCode !== 1 || !/^usage:/m.test(probe.stdout.toString()) || /pregate guide\b/.test(probe.stdout.toString())) {
    return recovery(`Engine ${version} could not answer guide --help (${probe.exitCode === null ? "timeout" : `exit ${probe.exitCode}`}): ${probe.stderr.toString().trim().slice(0, 2048)}. Run pregate doctor before retrying.`);
  }
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 0, text: `Engine ${version} is installed, but this release predates guided choices. Ask the agent to inspect pregate scan and prepare pregate init --preview, then review its displayed approval route. No project was activated.` };
  const preview = Bun.spawnSync([binary, "update", "--project", "--preview"], { cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 600_000 });
  const digest = /Digest: ([0-9a-f]{64})/.exec(preview.stdout.toString())?.[1];
  const text = [
    `Engine ${version} is installed, but this release predates guided choices. Prepared the supported project migration preview instead.`,
    preview.stdout.toString().trim(), preview.stderr.toString().trim(),
    ...(preview.exitCode === 0 ? digest === undefined ? ["No migration review was created; the project is already current."] : humanApprovalInstructions(`pregate approve ${digest.slice(0, 12)}`, "harness") : ["Inspect pregate preset diagnose --json, correct the named cause and repeat pregate update --project --preview."]),
    "Use the digest-bound approval command in that review. Preset, lock and consent stay unchanged until the human approves.",
  ].filter(Boolean).join("\n");
  return { code: preview.exitCode ?? 1, text: visible(text) };
}

// Query first to avoid replacing a newer installed/candidate engine with an older latest release.
// Actual installation remains machine.update: auth, archive checksums and setup have one owner.
export async function updateAndContinue(): Promise<Result> {
  try {
    const queried = latestRelease();
    if (typeof queried !== "string") return recovery(`Could not query the latest release: ${queried.error}`);
    const latest = queried.trim().replace(/^v/, "");
    if (!ENGINE_VERSION.test(latest)) return recovery(`The release returned an invalid version ${JSON.stringify(latest)}. Check the project's GitHub release; no update was started.`);
    const installed = installedVersion();
    const current = installed !== null && compareVersions(installed, VERSIONS.engine) > 0 ? installed : VERSIONS.engine;
    if (compareVersions(latest, current) < 0) {
      const text = `Published engine ${latest} is older than the current engine ${current}. Kept the newer engine; no downgrade or download was started.`;
      if (installed !== current) return { code: 0, text: `${text}\nContinue this engine's guide for project setup or migration. Global installation and project contracts were left unchanged.` };
      say(text);
      return continueInstalled(current);
    }
    const updated = await update({ version: latest });
    if (updated.code !== 0) return recovery(updated.text);
    say(updated.text);
    const version = installedVersion();
    if (version === null) return recovery("Installation finished but the launcher version cannot be read. Run pregate doctor before project migration.");
    return continueInstalled(version);
  } catch (e) { return recovery(`Update could not finish: ${(e as Error).message}`); }
}
