import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { VERSIONS } from "../src/versions.ts";
import { hostTarget } from "../scripts/build.ts";
import { prepareSigner } from "./signing-tool.ts";
import { removeTree } from "./remove-tree.ts";

// The distribution (MULTI-HARNESS MH-31, MH-32): install.sh against fake gh, uname and xattr on a
// PATH that holds only the tools it needs, so the release mode and both targets run on any host and
// nothing is downloaded; then the release that scripts/build.ts writes, through the literal bootstrap
// of MH-32. HOME and TMPDIR point into one temporary folder.

setDefaultTimeout(60_000);

const ROOT = join(import.meta.dir, "..");
const INSTALL = join(ROOT, "install.sh");
const DIST = join(ROOT, "dist");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-dist-")));
const FAKES = join(TMP, "fakes");
// What install.sh and the fakes run from the host; gzip is GNU tar's, sh the bootstrap's.
const TOOLS = ["sh", "mktemp", "tar", "gzip", "shasum", "sha256sum", "awk", "grep", "tr", "rm", "mkdir", "cp", "wc"];
const SHELLS = ["/bin/sh", "/bin/dash", "/bin/bash", "/bin/zsh"].filter(existsSync);

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

function script(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

beforeAll(() => {
  mkdirSync(FAKES);
  script(join(FAKES, "uname"), 'case $1 in -s) echo "$FAKE_OS" ;; -m) echo "$FAKE_ARCH" ;; esac');
  script(join(FAKES, "xattr"), 'printf \'xattr %s\\n\' "$*" >> "$LOG"');
  // `gh release download <tag> --repo R --pattern P… --dir D`, served from $RELEASE.
  script(join(FAKES, "gh"), [
    'printf \'gh %s\\n\' "$*" >> "$LOG"',
    '[ "${GH_EXIT:-0}" = 0 ] || exit "$GH_EXIT"',
    "dir=. pats=",
    'while [ $# -gt 0 ]; do case $1 in --dir) dir=$2; shift 2 ;; --pattern) pats="$pats $2"; shift 2 ;; *) shift ;; esac; done',
    'for p in $pats; do [ -f "$RELEASE/$p" ] && cp "$RELEASE/$p" "$dir/"; done',
    "exit 0",
  ].join("\n"));
});

afterAll(() => removeTree(TMP));

// A PATH with the fakes and the host tools, minus `without`: nothing else on the host is reachable.
function path(without = ""): string {
  const dir = join(TMP, `path-${without}`);
  if (existsSync(dir)) return dir;
  mkdirSync(dir);
  for (const t of TOOLS) {
    const at = Bun.which(t);
    if (at !== null && t !== without) symlinkSync(at, join(dir, t));
  }
  for (const f of readdirSync(FAKES)) if (f !== without) symlinkSync(join(FAKES, f), join(dir, f));
  return dir;
}

interface Run { code: number; stderr: string; log: string[]; leftovers: string[] }

// One isolated machine per call: its own HOME, TMPDIR and log.
function machine(): { dir: string; env: Record<string, string> } {
  const dir = mkdtempSync(join(TMP, "m-"));
  for (const d of ["home", "tmp", "release"]) mkdirSync(join(dir, d));
  // The real binary exits 1 when it wires nothing. An empty Claude home is one harness it can wire,
  // so a verified archive still finishes. The stub archives do not read this directory.
  mkdirSync(join(dir, "home", ".claude"));
  return {
    dir,
    env: {
      PATH: path(), HOME: join(dir, "home"), TMPDIR: join(dir, "tmp"), LOG: join(dir, "log"),
      XDG_DATA_HOME: join(dir, "data"), XDG_STATE_HOME: join(dir, "state"), CODEX_HOME: join(dir, "codex"), GROK_HOME: join(dir, "grok"),
      RELEASE: join(dir, "release"), FAKE_OS: "Darwin", FAKE_ARCH: "arm64",
    },
  };
}

function run(argv: string[], env: Record<string, string>): Run {
  const r = Bun.spawnSync(argv, { cwd: join(env.HOME!, ".."), env, stdout: "pipe", stderr: "pipe" });
  const log = existsSync(env.LOG!) ? readFileSync(env.LOG!, "utf8").split("\n").filter(Boolean) : [];
  return { code: r.exitCode, stderr: r.stderr.toString(), log, leftovers: readdirSync(env.TMPDIR!) };
}

// An archive whose pregate only records how install.sh called it and exits with $SETUP_EXIT.
function archive(dir: string, name: string, mode = 0o755): string {
  const src = join(dir, `src-${name}`);
  mkdirSync(src);
  script(join(src, "pregate"), 'printf \'pregate %s\\n\' "$*" >> "$LOG"\nexit "${SETUP_EXIT:-0}"');
  chmodSync(join(src, "pregate"), mode);
  writeFileSync(join(src, "LICENSE"), "MIT\n");
  const out = join(dir, name);
  const r = Bun.spawnSync(["tar", "-czf", out, "-C", src, "pregate", "LICENSE"], { env: { COPYFILE_DISABLE: "1" } });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return out;
}

const install = (env: Record<string, string>, ...args: string[]): Run => run(["/bin/sh", INSTALL, ...args], env);

describe("install.sh with PREGATE_ARCHIVE and PREGATE_SHA256", () => {
  test.each(SHELLS)("%s: verifies, extracts, runs `pregate setup` and removes the extraction", (sh) => {
    const m = machine();
    const tar = archive(m.dir, "a.tar.gz");
    const r = run([sh, INSTALL], { ...m.env, PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(tar) });
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    expect(r.log).toEqual([expect.stringMatching(/^xattr -d com\.apple\.quarantine \/.*\/pregate$/), "pregate setup"]);
    expect(r.leftovers).toEqual([]);
  });

  test("setup's exit code is install.sh's, and the extraction is removed anyway", () => {
    const m = machine();
    const tar = archive(m.dir, "a.tar.gz");
    const r = install({ ...m.env, PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(tar), SETUP_EXIT: "1" });
    expect(r.code).toBe(1);
    expect(r.log.at(-1)).toBe("pregate setup");
    expect(r.leftovers).toEqual([]);
  });

  test("the hash is compared without case, and on Linux there is no xattr", () => {
    const m = machine();
    const tar = archive(m.dir, "a.tar.gz");
    const r = install({ ...m.env, FAKE_OS: "Linux", PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(tar).toUpperCase() });
    expect(r.code).toBe(0);
    expect(r.log).toEqual(["pregate setup"]);
  });

  test.skipIf(Bun.which("sha256sum") === null)("without shasum, sha256sum verifies", () => {
    const m = machine();
    const tar = archive(m.dir, "a.tar.gz");
    expect(install({ ...m.env, PATH: path("shasum"), PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(tar) }).code).toBe(0);
    expect(install({ ...m.env, PATH: path("shasum"), PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(INSTALL) }).code).toBe(1);
  });

  test("a mismatch stops before anything runs", () => {
    const m = machine();
    const tar = archive(m.dir, "a.tar.gz");
    const r = install({ ...m.env, PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(INSTALL) });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("SHA-256 mismatch");
    expect(r.log).toEqual([]);
    expect(r.leftovers).toEqual([]);
  });

  test.each([
    ["no hash", {}, "PREGATE_ARCHIVE needs PREGATE_SHA256"],
    ["a hash that is not one", { PREGATE_SHA256: "abc" }, "not 64 hex digits"],
    ["a hash with a non-hex digit", { PREGATE_SHA256: "g".repeat(64) }, "not 64 hex digits"],
  ])("%s is refused", (_, extra, message) => {
    const m = machine();
    const r = install({ ...m.env, PREGATE_ARCHIVE: archive(m.dir, "a.tar.gz"), ...extra });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(message);
    expect(r.log).toEqual([]);
  });

  test("an archive whose pregate is not executable is refused", () => {
    const m = machine();
    const tar = archive(m.dir, "a.tar.gz", 0o644);
    const r = install({ ...m.env, PREGATE_ARCHIVE: tar, PREGATE_SHA256: sha256(tar) });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("no executable pregate");
    expect(r.log).toEqual([]);
  });
});

describe("install.sh from the release", () => {
  // The release of `version` for `target`, with a SHA256SUMS line for its tar unless told otherwise.
  function release(m: ReturnType<typeof machine>, version: string, target: string, sums?: string): string {
    const name = `pregate-${version}-${target}.tar.gz`;
    const tar = archive(join(m.env.RELEASE!), name);
    writeFileSync(join(m.env.RELEASE!, "SHA256SUMS"), sums ?? `${sha256(tar)}  ${name}\n${sha256(INSTALL)}  install.sh\n`);
    return name;
  }

  function publicTransport(m: ReturnType<typeof machine>, mode = "public"): Record<string, string> {
    const tools = join(m.dir, "public-tools"); mkdirSync(tools);
    for (const file of readdirSync(path())) if (file !== "gh" || mode !== "public") symlinkSync(join(path(), file), join(tools, file));
    script(join(tools, "curl"), [
      'printf \'curl %s\\n\' "$*" >> "$LOG"',
      'out=; url=; prev=; for arg; do [ "$prev" = --output ] && out=$arg; prev=$arg; url=$arg; done',
      mode === "oversize" ? 'exit 63' : mode === "partial" ? 'case $url in */SHA256SUMS) cp "$RELEASE/SHA256SUMS" "$out"; exit 0 ;; *) echo partial >"$out"; exit 22 ;; esac' : 'cp "$RELEASE/${url##*/}" "$out"',
    ].join("\n"));
    if (mode === "partial") {
      rmSync(join(tools, "gh"));
      script(join(tools, "gh"), [
        'out=; prev=; for arg; do [ "$prev" = --dir ] && out=$arg; prev=$arg; done',
        'prev=; for arg; do [ "$prev" != --pattern ] || [ ! -e "$out/$arg" ] || exit 91; prev=$arg; done',
        `exec '${join(FAKES, "gh")}' "$@"`,
      ].join("\n"));
    }
    return { ...m.env, PATH: tools };
  }

  test("anonymous HTTPS installs without gh and pins both downloads to the requested release", () => {
    const m = machine(), name = release(m, pkg.version, "darwin-arm64");
    const r = install(publicTransport(m));
    expect(r.code, r.stderr).toBe(0);
    expect(r.log.filter(line => line.startsWith("gh "))).toEqual([]);
    const downloads = r.log.filter(line => line.startsWith("curl "));
    expect(downloads).toHaveLength(2);
    for (const line of downloads) expect(line).toContain("curl -q --fail --silent --show-error --location --proto =https --proto-redir =https");
    expect(downloads[0]).toEndWith(`/v${pkg.version}/SHA256SUMS`);
    expect(downloads[1]).toEndWith(`/v${pkg.version}/${name}`);
    expect(r.log.at(-1)).toBe("pregate setup"); expect(r.leftovers).toEqual([]);
  });

  test("partial anonymous acquisition is removed before the authenticated pair is downloaded", () => {
    const m = machine(); release(m, pkg.version, "darwin-arm64");
    const r = install(publicTransport(m, "partial"));
    expect(r.code, r.stderr).toBe(0);
    expect(r.log.filter(line => line.startsWith("gh "))).toHaveLength(1);
    expect(r.log.at(-1)).toBe("pregate setup"); expect(r.leftovers).toEqual([]);
  });

  test.each(["mismatch", "malformed", "oversize"])("public %s is fatal without authenticated fallback or setup", mode => {
    const m = machine(); release(m, pkg.version, "darwin-arm64", mode === "mismatch" ? `${"0".repeat(64)}  pregate-${pkg.version}-darwin-arm64.tar.gz\n` : mode === "malformed" ? "not-a-manifest\n" : undefined);
    const r = install(publicTransport(m, mode === "oversize" ? mode : "guard"));
    expect(r.code).toBe(1); expect(r.log.some(line => line.startsWith("gh ") || line === "pregate setup")).toBe(false);
    expect(r.leftovers).toEqual([]);
  });

  test("without --version: package.json's version for darwin-arm64, verified against SHA256SUMS", () => {
    const m = machine();
    const name = release(m, pkg.version, "darwin-arm64");
    const r = install(m.env);
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    expect(r.log[0]).toMatch(new RegExp(
      `^gh release download v${pkg.version} --repo pedroknigge/pregate --pattern ${name} --pattern SHA256SUMS --dir /`));
    expect(r.log.slice(1)).toEqual([expect.stringMatching(/^xattr -d com\.apple\.quarantine \/.*\/pregate$/), "pregate setup"]);
    expect(r.leftovers).toEqual([]);
  });

  test("--version vX.Y.Z-pre on linux-x64", () => {
    const m = machine();
    const name = release(m, "0.2.0-rc.1", "linux-x64");
    const r = install({ ...m.env, FAKE_OS: "Linux", FAKE_ARCH: "x86_64" }, "--version", "v0.2.0-rc.1");
    expect(r.code).toBe(0);
    expect(r.log[0]).toStartWith(`gh release download v0.2.0-rc.1 --repo pedroknigge/pregate --pattern ${name} `);
    expect(r.log.slice(1)).toEqual(["pregate setup"]);
  });

  test.each(["main", "HEAD", "1.2", "0.2.0-", "v", "0.2.0\n0.1.0", "0.2.0 --repo x/y"])("--version %j is refused before any download", (v) => {
    const m = machine();
    const r = install(m.env, "--version", v);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("invalid version");
    expect(r.log).toEqual([]);
  });

  test.each(["aarch64", "arm64"])("Linux %s selects the ARM64 archive", (arch) => {
    const m = machine();
    const name = release(m, pkg.version, "linux-arm64");
    const r = install({ ...m.env, FAKE_OS: "Linux", FAKE_ARCH: arch });
    expect(r.code).toBe(0);
    expect(r.log[0]).toStartWith(`gh release download v${pkg.version} --repo pedroknigge/pregate --pattern ${name} `);
    expect(r.log.slice(1)).toEqual(["pregate setup"]);
    expect(r.leftovers).toEqual([]);
  });

  test("Darwin x86_64 selects the darwin-x64 archive", () => {
    const m = machine();
    const name = release(m, pkg.version, "darwin-x64");
    const r = install({ ...m.env, FAKE_OS: "Darwin", FAKE_ARCH: "x86_64" });
    expect(r.code).toBe(0);
    expect(r.log[0]).toStartWith(`gh release download v${pkg.version} --repo pedroknigge/pregate --pattern ${name} `);
    expect(r.log.slice(1)).toEqual([expect.stringMatching(/^xattr -d com\.apple\.quarantine \/.*\/pregate$/), "pregate setup"]);
    expect(r.leftovers).toEqual([]);
  });

  test.each([["Linux", "riscv64"], ["Darwin", "ppc64"], ["FreeBSD", "amd64"]])("%s %s has no release", (os, arch) => {
    const m = machine();
    const r = install({ ...m.env, FAKE_OS: os, FAKE_ARCH: arch });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("no release for");
    expect(r.log).toEqual([]);
  });

  test("a tar that does not match its SHA256SUMS line never runs", () => {
    const m = machine();
    const name = release(m, pkg.version, "darwin-arm64", `${sha256(INSTALL)}  pregate-${pkg.version}-darwin-arm64.tar.gz\n`);
    const r = install(m.env);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("SHA-256 mismatch");
    expect(r.log).toEqual([expect.stringContaining(name)]);
  });

  test("a SHA256SUMS without a line for the tar is refused", () => {
    const m = machine();
    release(m, pkg.version, "darwin-arm64", `${sha256(INSTALL)}  install.sh\n`);
    const r = install(m.env);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("has no line for");
    expect(r.log.length).toBe(1);
  });

  test("PREGATE_SHA256 pins the hash over SHA256SUMS", () => {
    const m = machine();
    release(m, pkg.version, "darwin-arm64");
    const r = install({ ...m.env, PREGATE_SHA256: sha256(INSTALL) });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("SHA-256 mismatch");
    expect(r.log.length).toBe(1);
  });

  test("a release without the tar is refused", () => {
    const m = machine();
    writeFileSync(join(m.env.RELEASE!, "SHA256SUMS"), `${sha256(INSTALL)}  install.sh\n`);
    const r = install(m.env);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("has no pregate-");
  });

  test("a failed gh download names gh auth", () => {
    const m = machine();
    const r = install({ ...m.env, GH_EXIT: "1" });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("gh auth status");
  });

  test("without gh it says where to get it", () => {
    const m = machine();
    const r = install({ ...m.env, PATH: path("gh") });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("gh is required");
    expect(r.stderr).toContain("https://cli.github.com");
  });

  test("an unknown argument is refused", () => {
    const m = machine();
    const r = install(m.env, "--global");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("usage: install.sh [--version vX.Y.Z]");
    expect(r.log).toEqual([]);
  });
});

// The release that scripts/build.ts writes for this host, installed through the literal bootstrap of
// MH-32 with gh serving dist/.
describe("the built release", () => {
  const target = hostTarget();
  const tar = `pregate-${pkg.version}-${target}.tar.gz`;
  const BOOTSTRAP = 'd=$(mktemp -d) && gh release download --repo pedroknigge/pregate --pattern install.sh --pattern SHA256SUMS --dir "$d" \\\n' +
    '  && (cd "$d" && shasum -a 256 -c --ignore-missing SHA256SUMS) && sh "$d/install.sh"';

  beforeAll(() => {
    // Packaging validates the entire bundled fixture corpus before compiling.
    // Give that build its own bounded setup budget; interactive hook budgets stay unchanged.
    const r = Bun.spawnSync([process.execPath, "run", "scripts/build.ts", target], { cwd: ROOT, stdout: "pipe", stderr: "pipe", timeout: 120_000 });
    if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  }, 150_000);

  test("SHA256SUMS covers the tar and install.sh, which is the repository's", () => {
    expect(readFileSync(join(DIST, "SHA256SUMS"), "utf8")).toBe(`${sha256(join(DIST, tar))}  ${tar}\n${sha256(INSTALL)}  install.sh\n${sha256(join(ROOT, "install.ps1"))}  install.ps1\n`);
    expect(readFileSync(join(DIST, "install.sh"), "utf8")).toBe(readFileSync(INSTALL, "utf8"));
    const listed = Bun.spawnSync(["tar", "-tzf", join(DIST, tar)]).stdout.toString().split("\n").filter(Boolean);
    expect(listed).toEqual(["pregate", "LICENSE", "THIRD_PARTY_NOTICES", "skills/pregate/SKILL.md"]);
    const notice = Bun.spawnSync(["tar", "-xOzf", join(DIST, tar), "THIRD_PARTY_NOTICES"], { stdout: "pipe", stderr: "pipe" });
    expect(notice.exitCode, notice.stderr.toString()).toBe(0);
    const text = notice.stdout.toString();
    for (const phrase of [
      "GNU LIBRARY GENERAL PUBLIC LICENSE", "Version 2, June 1991",
      "numbered 2 because it goes with version 2 of the ordinary GPL",
      "GNU LESSER GENERAL PUBLIC LICENSE", "Version 2.1, February 1999",
      "successor of the GNU Library Public License, version 2",
      "d6375c72affe0f70222cdcb45012b10f0bf3a9d5",
      "https://github.com/oven-sh/bun/archive/refs/tags/bun-v1.4.4.tar.gz",
      "https://github.com/oven-sh/WebKit/archive/d6375c72affe0f70222cdcb45012b10f0bf3a9d5.tar.gz",
      "https://github.com/oven-sh/tinycc/archive/05f0fafaa3be31e31d7b4b5c17dc60f62c991171.tar.gz",
      "bun sync-webkit-source",
    ]) expect(text).toContain(phrase);
    expect(text.match(/END OF TERMS AND CONDITIONS/g)).toHaveLength(2);
    expect(text.match(/written offer/gi)).toHaveLength(2);
    expect(text).not.toContain("will give any recipient");
    expect(text).not.toContain("section 6(b)");
  });

  test("the bootstrap verifies install.sh and the tar and hands over to the binary", () => {
    const m = machine();
    const env = { ...m.env, RELEASE: DIST, FAKE_OS: process.platform === "linux" ? "Linux" : "Darwin",
      FAKE_ARCH: process.arch === "x64" ? "x86_64" : "arm64" };
    const r = run(["/bin/sh", "-c", BOOTSTRAP], env);
    expect(r.code).toBe(0);
    expect(r.log.filter((l) => l.startsWith("gh "))).toEqual([
      expect.stringMatching(/^gh release download --repo pedroknigge\/pregate --pattern install\.sh --pattern SHA256SUMS --dir \//),
      expect.stringMatching(new RegExp(`^gh release download v${pkg.version} --repo pedroknigge/pregate --pattern ${tar} `)),
    ]);
    expect(r.stderr).not.toContain("install.sh:");
    expect(r.stderr).not.toContain("FAILED");
    const version = Bun.spawnSync(["/bin/sh", "-c", "pregate --version"], {
      cwd: m.dir, env: { ...env, PATH: `${m.env.HOME}/.local/bin:${m.env.PATH}` }, stdout: "pipe", stderr: "pipe",
    });
    expect(version.exitCode).toBe(0);
    expect(version.stdout.toString()).toBe(`pregate ${pkg.version} (core ${VERSIONS.core})\n`);
    expect(version.stderr.toString()).toBe("");
  });

  test("release binaries cannot use a test answer as human approval", () => {
    const m = machine();
    expect(Bun.spawnSync(["git", "init", "-q", m.dir]).exitCode).toBe(0);
    const binary = join(DIST, `pregate-${pkg.version}-${target}`, "pregate");
    const result = Bun.spawnSync([binary, "init"], { cwd: m.dir,
      env: { ...m.env, PATH: "/usr/bin:/bin", CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" }, stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toContain("Human approval unavailable");
    expect(existsSync(join(m.dir, ".pregate/preset.json"))).toBe(false);
  });

  // Host build from the parent beforeAll, signed with the offline cosign shim. The checksum of
  // the tampered bytes is updated so only the signature check can fail. Real Sigstore is
  // test/signing.e2e.test.ts and does not run here.
  describe("signed release artifacts", () => {
    const work = join(TMP, "signing");
    mkdirSync(work, { recursive: true });
    const signer = prepareSigner(work);

    beforeAll(() => {
      signer.sign(join(DIST, tar));
      signer.sign(join(DIST, "SHA256SUMS"));
      const archive = signer.verify(join(DIST, tar));
      const sums = signer.verify(join(DIST, "SHA256SUMS"));
      if (!archive.ok || !sums.ok) throw new Error(`${archive.text}\n${sums.text}`);
    }, 180_000);

    test("install.sh accepts the signed archive", () => {
      const m = machine();
      const archivePath = join(DIST, tar);
      const installed = install({
        ...m.env,
        PATH: `${signer.binDir}:${m.env.PATH}`,
        FAKE_OS: process.platform === "linux" ? "Linux" : "Darwin",
        FAKE_ARCH: process.arch === "x64" ? "x86_64" : "arm64",
        PREGATE_ARCHIVE: archivePath,
        PREGATE_SHA256: sha256(archivePath),
        ...signer.installEnv(archivePath),
      });
      expect(installed.code, installed.stderr).toBe(0);
    }, 120_000);

    test("install.sh refuses a tampered archive whose checksum was recomputed", () => {
      const m = machine();
      const archivePath = join(DIST, tar);
      const tampered = join(m.dir, "tampered.tar.gz");
      const bytes = readFileSync(archivePath);
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
      writeFileSync(tampered, bytes);
      const signature = `${archivePath}.bundle`;
      const installed = install({
        ...m.env,
        PATH: `${signer.binDir}:${m.env.PATH}`,
        PREGATE_ARCHIVE: tampered,
        PREGATE_SHA256: sha256(tampered),
        ...signer.installEnv(tampered, signature),
      });
      expect(installed.code).toBe(1);
      expect(installed.stderr).toContain("signature mismatch");
      expect(installed.log).not.toContain("pregate setup");
      expect(installed.leftovers).toEqual([]);
    });
  });
});
