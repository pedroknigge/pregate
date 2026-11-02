// Verify the packaged candidate offline on its native host before publication.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hostTarget } from "./build.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { VERSIONS } from "../src/versions.ts";

const args = process.argv.slice(2), target = hostTarget();
if (args.length > 2 || (args[1] !== undefined && args[1] !== target)) throw new Error("usage: smoke-native.ts [artifact directory] [expected native target]; current target: " + target);
const dist = resolve(args[0] ?? join(import.meta.dir, "../dist"));
const root = resolve(import.meta.dir, "..");
const manifest = readFileSync(join(dist, "SHA256SUMS"), "utf8").split(/\r?\n/);
function verified(name: string): string {
  const entries = manifest.filter((line) => line.slice(66) === name && /^[a-f0-9]{64}  /.test(line));
  const actual = createHash("sha256").update(readFileSync(join(dist, name))).digest("hex");
  if (entries.length !== 1 || entries[0]!.slice(0, 64) !== actual) throw new Error("Candidate SHA-256 mismatch or missing/ambiguous entry: " + name);
  return actual;
}
const archive = join(dist, `pregate-${VERSIONS.engine}-${target}.${WINDOWS ? "zip" : "tar.gz"}`);
const digest = verified(archive.slice(dist.length + 1));
const installer = WINDOWS ? "install.ps1" : "install.sh";
verified(installer);
const area = mkdtempSync(join(tmpdir(), "pregate-candidate-native-"));
// PREGATE_NO_MODIFY_PATH: the Windows installer must not write the tester's user PATH.
const env: Record<string, string | undefined> = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PREGATE_ARCHIVE: archive, PREGATE_SHA256: digest, PREGATE_NO_MODIFY_PATH: "1", CLAUDE_CONFIG_DIR: join(area, "home/.claude") };
for (const [name, folder] of Object.entries({ HOME: "home", USERPROFILE: "home", LOCALAPPDATA: "data", APPDATA: "config", XDG_DATA_HOME: "data", XDG_STATE_HOME: "state", XDG_CONFIG_HOME: "config", TMPDIR: "tmp", TMP: "tmp", TEMP: "tmp", CODEX_HOME: "codex", GROK_HOME: "grok" })) {
  const path = join(area, folder); mkdirSync(path, { recursive: true }); env[name] = path;
}
// Windows PowerShell finds no AppData\Local under the isolated USERPROFILE and writes its module
// analysis cache relative to its working directory: the checkout. Keep that cache in the isolated area.
env.PSModuleAnalysisCachePath = join(area, "powershell-module-analysis-cache");
async function run(command: string[]): Promise<string> {
  const proc = Bun.spawn(command, { cwd: root, env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 120000 });
  const [code, out, err] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`${command[0]} failed (exit ${code}):\n${out}${err}`);
  return out;
}
try {
  console.log("Verify candidate " + target + ": offline bootstrap of checked archive/installer");
  await run(WINDOWS ? ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(dist, installer), "-Version", VERSIONS.engine]
    : ["sh", join(dist, installer), "--version", VERSIONS.engine]);
  const binary = join(area, "data/pregate", VERSIONS.engine, ENGINE_FILE);
  const expected = `pregate ${VERSIONS.engine} (core ${VERSIONS.core})`;
  if ((await run([binary, "--version"])).trim() !== expected) throw new Error("Installed candidate version differs from source version");
  for (const feature of ["stop", "storage", "feedback", "languages", "fitness"]) {
    console.log("Verify candidate " + target + ": " + feature);
    console.log((await run([process.execPath, join(import.meta.dir, `smoke-${feature}.ts`), binary])).trim());
  }
  console.log((await run([binary, "rules", "test", "docs/examples/docs-to-pack"])).trim());
  console.log(JSON.stringify({ target, archiveSha256: digest, bootstrap: "verified candidate archive and installer", checks: "Stop/repair, storage/recovery, feedback, languages, bounded project fitness and documentation pack", interaction: "native production protocol; actual harness UI not certified", publication: "none" }));
} finally { rmSync(area, { recursive: true, force: true }); }
