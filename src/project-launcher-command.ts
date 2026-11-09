import { chmodSync, statSync } from "node:fs";
import { join } from "node:path";
import { approvePending } from "./approval-command.ts";
import { approvalDeadline, proposeContract } from "./approval.ts";
import { ASSETS } from "./assets.ts";
import { validateContract } from "./contract.ts";
import { canonical, findRoot } from "./disk.ts";
import { dataHome } from "./consent.ts";
import { clock, grammars, LOCK, PRESET, readText, sourcesOf, VERSIONS } from "./gate.ts";
import { pendingReview } from "./pending-review.ts";
import { pinnedEngine } from "./project-updates.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { ENGINE_VERSION } from "./product.ts";
import { sha256 } from "./state.ts";
import { LAUNCHER } from "./inertia.ts";

type Result = { code: number; text: string };
const USAGE = "usage: pregate project launcher [--preview|--yes]";
const LAUNCHER_NAME = WINDOWS ? "pregate.cmd" : "pregate";
const PS1 = "project-launcher.ps1";

function runnable(path: string): boolean {
  const s = statSync(path, { throwIfNoEntry: false });
  return s !== undefined && s.isFile() && s.size > 0 && (WINDOWS || (s.mode & 0o111) !== 0);
}

function launcherFiles(root: string): { path: string; before: string | null; after: string }[] {
  const bin = join(root, ".pregate/bin");
  if (WINDOWS) {
    const ps1 = ASSETS[PS1];
    const cmd = ASSETS["project-launcher.cmd"] ?? `@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0${PS1}" %*\r\nexit /b %errorlevel%\r\n`;
    if (ps1 === undefined) throw new Error("Missing project launcher asset");
    return [
      { path: join(bin, PS1), before: readText(join(bin, PS1)), after: ps1 },
      { path: join(bin, LAUNCHER_NAME), before: readText(join(bin, LAUNCHER_NAME)), after: cmd },
    ];
  }
  const sh = ASSETS["project-launcher.sh"];
  if (sh === undefined) throw new Error("Missing project launcher asset");
  return [{ path: join(bin, LAUNCHER_NAME), before: readText(join(bin, LAUNCHER_NAME)), after: sh }];
}

export async function projectLauncher(args: string[]): Promise<Result> {
  if (args.some((a) => !["--preview", "--yes"].includes(a)) || new Set(args).size !== args.length || (args.includes("--yes") && args.includes("--preview"))) {
    return { code: 1, text: USAGE };
  }
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Run from a Git project with .pregate/pregate.lock.json." };
  const pin = pinnedEngine(root);
  if (pin === null || pin === "" || !ENGINE_VERSION.test(pin)) {
    return { code: 1, text: "This project has no valid engine pin. Inspect pregate preset diagnose --json and compile the lock first." };
  }
  const engine = join(dataHome(), pin, ENGINE_FILE);
  if (!runnable(engine)) {
    return { code: 1, text: `Engine ${pin} is not installed in the cache. Run pregate prepare (or pregate prepare --engine ${pin}) before installing the project launcher.` };
  }
  const presetText = readText(join(root, PRESET));
  if (presetText === null) return { code: 1, text: "No .pregate/preset.json; initialize or migrate the project first." };
  await grammars();
  const compiled = validateContract({ presetText, filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  if ("errors" in compiled) return { code: 1, text: compiled.errors.join("\n") };
  const writes = launcherFiles(root);
  if (writes.every((w) => w.before === w.after)) {
    return { code: 0, text: `Project launcher at ${join(root, LAUNCHER)} already matches the reviewed template; engine ${pin} is cached.` };
  }
  const baseline = sha256(presetText + (readText(join(root, LOCK)) ?? ""));
  approvalDeadline();
  const proposal = proposeContract({
    root, baseline, lockText: compiled.text, activate: false,
    writes: writes.map((w) => ({ ...w, before: w.before ?? null })),
  });
  const digest = sha256(JSON.stringify(proposal));
  const review = pendingReview(root, digest);
  const header = `Install a project-local launcher at ${join(root, LAUNCHER)}. Hooks name this path instead of the global installation. It runs engine ${pin} from the cache only (no PATH fallback).`;
  if (args.includes("--preview")) {
    return { code: 0, text: `${header}\n${review.text}\nProject unchanged until the human approves the digest.` };
  }
  const applied = await approvePending(root, args.includes("--yes"), digest);
  if (applied.code !== 0) return applied;
  for (const w of launcherFiles(root)) chmodSync(w.path, WINDOWS ? 0o644 : 0o755);
  return { code: 0, text: `${header}\n${applied.text}` };
}
