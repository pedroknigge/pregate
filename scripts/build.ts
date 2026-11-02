import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { librarySources } from "../src/library.ts";
import { PS_MODULES } from "../src/windows-command.ts";

// The release (MULTI-HARNESS MH-32): the catalog must pass `rules test`, then one binary per target,
// each in a tar with its notices, plus install.sh and one SHA256SUMS that covers all of them: the
// release's only checksum file.
// Usage: bun run scripts/build.ts [target…]   (default: every target)

const TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "windows-x64"] as const;
export type Target = (typeof TARGETS)[number];

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");

const isTarget = (t: string): t is Target => (TARGETS as readonly string[]).includes(t);

// The bundler resolves the embedded catalog/ and assets/ against its cwd, so it always runs from the
// repo root, where a compile can leave its `.*.bun-build` scratch files behind. A compiled Bun binary
// otherwise loads bunfig.toml (whose `preload` runs code) and .env from the directory it runs in: the
// repo it judges, which the agent can write (O32).
export function compileBinary(target: Target, outfile: string, testApproval = false): void {
  // Bun owns its scratch files. Sweeping ROOT here can delete another concurrent
  // compilation's executable before Bun renames it into that build's output.
  // Bun 1.3.14's Windows bytecode executable crashes before setup can run (O67).
  run([process.execPath, "build", "src/main.ts", "--compile", "--minify", ...(target === "windows-x64" ? [] : ["--bytecode"]), "--no-compile-autoload-bunfig",
    "--no-compile-autoload-dotenv", `--define=PREGATE_TEST_BUILD=${testApproval}`, `--target=bun-${target}`, `--outfile=${outfile}`]);
}

export function hostTarget(): Target {
  const t = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
  if (!isTarget(t)) throw new Error(`no build target for ${t}`);
  return t;
}

// dist/pregate-<version>-<target>.tar.gz: the name install.sh and the CI template download.
function release(target: Target): string {
  const name = `pregate-${pkg.version}-${target}`;
  const dir = join(DIST, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const windows = target === "windows-x64";
  compileBinary(target, join(dir, windows ? "pregate.exe" : "pregate"));
  const files = [windows ? "pregate.exe" : "pregate", "LICENSE", "THIRD_PARTY_NOTICES"];
  for (const f of files.slice(1)) copyFileSync(join(ROOT, f), join(dir, f));
  mkdirSync(join(dir, "skills/pregate"), { recursive: true });
  writeFileSync(join(dir, "skills/pregate/SKILL.md"), readFileSync(join(ROOT, "assets/pregate/SKILL.md"), "utf8").replaceAll("@ENGINE_VERSION@", pkg.version));
  files.push("skills/pregate/SKILL.md");
  const tar = `${name}.${windows ? "zip" : "tar.gz"}`;
  // COPYFILE_DISABLE: macOS tar would otherwise add AppleDouble (._*) entries. tar runs inside the
  // folder with relative names: Git for Windows' GNU tar reads "C:\..." as a remote host.
  if (windows && process.platform === "win32") {
    run(["powershell.exe", "-NoProfile", "-Command", PS_MODULES + `Compress-Archive -Path '${dir.replaceAll("'", "''")}/*' -DestinationPath '${join(DIST, tar).replaceAll("'", "''")}' -Force`]);
  } else if (windows) {
    rmSync(join(DIST, tar), { force: true });
    run(["zip", "-q", join(DIST, tar), ...files], {}, dir);
  } else run(["tar", "-czf", `../${tar}`, ...files], { COPYFILE_DISABLE: "1" }, dir);
  return tar;
}

function run(cmd: string[], env: Record<string, string> = {}, cwd = ROOT): void {
  const r = Bun.spawnSync(cmd, { cwd, stdout: "inherit", stderr: "inherit", env: { ...process.env, ...env } });
  if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")} exited ${r.exitCode}`);
}

// install.sh, install.ps1 and the Action download the release named here. Published under another
// version, the bootstrap of MH-32 would install the previous release, and the Action's default
// would ask for bundles that tag never published.
export function assertReleaseVersions(root = ROOT): void {
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;
  const pinned = /^DEFAULT_VERSION=(.*)$/m.exec(readFileSync(join(root, "install.sh"), "utf8"))?.[1];
  if (pinned !== version) throw new Error(`install.sh DEFAULT_VERSION=${pinned} differs from package.json ${version}`);
  const psPinned = /^\$DEFAULT_VERSION = '(.+)'$/m.exec(readFileSync(join(root, "install.ps1"), "utf8"))?.[1];
  if (psPinned !== version) throw new Error(`install.ps1 DEFAULT_VERSION=${psPinned} differs from package.json ${version}`);
  const actionPinned = /^  version:\n(?:    .*\n)*?    default: "([^"]*)"/m.exec(readFileSync(join(root, "action.yml"), "utf8"))?.[1];
  if (actionPinned !== version) throw new Error(`action.yml version default=${actionPinned ?? "missing"} differs from package.json ${version}`);
}

if (import.meta.main) {
  const asked = process.argv.slice(2);
  const unknown = asked.filter((t) => !isTarget(t));
  if (unknown.length > 0) throw new Error(`unknown target ${unknown.join(", ")}; known: ${TARGETS.join(", ")}`);
  assertReleaseVersions();
  run([process.execPath, "scripts/core-invariants.ts", "--check"]);
  run([process.execPath, "scripts/readiness-packs.ts", "--check"]);
  run([process.execPath, "scripts/dcouplr-delivery-rules.ts", "--check"]);
  run([process.execPath, "scripts/source-invariants.ts", "--check"]);
  run([process.execPath, "scripts/invariant-coverage.ts", "--check"]);
  run([process.execPath, "scripts/docs-reference.ts", "--check"]);
  run([process.execPath, "src/main.ts", "rules", "test", "catalog"]);
  for (const source of librarySources()) run([process.execPath, "src/main.ts", "rules", "test", "--library", source.ns]);
  const targets = asked.length > 0 ? (asked as Target[]) : TARGETS;
  const assets = [...targets.map(release), "install.sh", "install.ps1"];
  copyFileSync(join(ROOT, "install.sh"), join(DIST, "install.sh"));
  copyFileSync(join(ROOT, "install.ps1"), join(DIST, "install.ps1"));
  const sum = (f: string): string => createHash("sha256").update(readFileSync(join(DIST, f))).digest("hex");
  writeFileSync(join(DIST, "SHA256SUMS"), assets.map((f) => `${sum(f)}  ${f}\n`).join(""));
  for (const f of [...assets, "SHA256SUMS"]) console.log(`dist/${f}`);
}
