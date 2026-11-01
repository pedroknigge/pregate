import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { WINDOWS } from "../src/platform.ts";
import { prepareRealCosign, SIGSTORE_E2E_ENV, type Signer } from "./signing-tool.ts";

// Real keyed cosign. Contacts Sigstore (TUF, and Rekor when sign-blob uploads). GitHub Actions
// sets PREGATE_E2E_SIGSTORE=1 after installing cosign. Local `bun test` skips this file.

const enabled = process.env[SIGSTORE_E2E_ENV] === "1" && !WINDOWS;
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

if (!enabled) {
  test.skip(
    WINDOWS
      ? `real Sigstore cosign verification runs in Linux CI (${SIGSTORE_E2E_ENV}=1)`
      : `real Sigstore cosign verification is skipped; set ${SIGSTORE_E2E_ENV}=1 to contact Sigstore (GitHub Actions sets this)`,
    () => {},
  );
} else {
  setDefaultTimeout(180_000);
  const root = mkdtempSync(join(tmpdir(), "pregate-sigstore-"));
  const signer: Signer = prepareRealCosign(join(root, "signer"));
  const script = join(import.meta.dir, "../scripts/action-install.sh");
  const servers: Array<{ stop: () => void }> = [];

  afterAll(() => {
    for (const server of servers.splice(0)) server.stop();
    rmSync(root, { recursive: true, force: true });
  });

  function target(): string {
    const os = Bun.spawnSync(["uname", "-s"], { stdout: "pipe" }).stdout.toString().trim();
    const arch = Bun.spawnSync(["uname", "-m"], { stdout: "pipe" }).stdout.toString().trim();
    switch (`${os}-${arch}`) {
      case "Darwin-arm64": return "darwin-arm64";
      case "Darwin-x86_64": return "darwin-x64";
      case "Linux-x86_64": return "linux-x64";
      case "Linux-aarch64":
      case "Linux-arm64": return "linux-arm64";
      default: throw new Error(`unsupported test runner ${os}-${arch}`);
    }
  }

  function archive(dir: string, name: string): string {
    const src = join(dir, "src");
    mkdirSync(src);
    writeFileSync(join(src, "pregate"), "#!/bin/sh\nprintf 'pregate-ok\\n'\n");
    chmodSync(join(src, "pregate"), 0o755);
    const out = join(dir, name);
    const packed = Bun.spawnSync(["tar", "-czf", out, "-C", src, "pregate"], { env: { COPYFILE_DISABLE: "1" } });
    if (packed.exitCode !== 0) throw new Error(packed.stderr.toString());
    return out;
  }

  function tools(): string {
    const dir = join(root, "tools");
    if (existsSync(dir)) return dir;
    mkdirSync(dir);
    for (const name of ["bash", "curl", "tar", "gzip", "sha256sum", "shasum", "awk", "grep", "uname", "install", "mkdir", "mktemp", "rm", "cp"]) {
      const at = Bun.which(name);
      if (at) symlinkSync(at, join(dir, name));
    }
    return dir;
  }

  function serve(dir: string): string {
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        const name = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, "");
        if (name.includes("..") || name.includes("/") || name.includes("\\")) return new Response("no", { status: 400 });
        const file = join(dir, name);
        if (!existsSync(file)) return new Response("missing", { status: 404 });
        return new Response(Bun.file(file));
      },
    });
    servers.push(server);
    return `http://127.0.0.1:${server.port}`;
  }

  async function actionInstall(base: string, extra: Record<string, string>): Promise<{ code: number; text: string; home: string }> {
    const home = mkdtempSync(join(root, "home-"));
    mkdirSync(join(home, "tmp"));
    const proc = Bun.spawn(["bash", script], {
      env: {
        PATH: `${signer.binDir}:${tools()}`,
        HOME: home,
        TMPDIR: join(home, "tmp"),
        PREGATE_VERSION: pkg.version,
        PREGATE_RELEASE_BASE: base,
        ...extra,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { code, text: stdout + stderr, home };
  }

  describe("real Sigstore cosign", () => {
    test("keyed sign-blob verifies, and tampered bytes do not", () => {
      const file = join(root, "blob");
      writeFileSync(file, "signed-by-sigstore\n");
      signer.sign(file);
      const verified = signer.verify(file);
      expect(verified.ok, verified.text).toBe(true);
      const bytes = readFileSync(file);
      bytes[0] = (bytes[0] ?? 0) ^ 0xff;
      writeFileSync(file, bytes);
      expect(signer.verify(file).ok).toBe(false);
    });

    test("the action installer accepts a real bundle and rejects a mismatched one", async () => {
      const name = `pregate-${pkg.version}-${target()}.tar.gz`;
      const good = mkdtempSync(join(root, "good-"));
      const file = archive(good, name);
      writeFileSync(join(good, "SHA256SUMS"), `${sha256(file)}  ${name}\n`);
      signer.sign(file);
      signer.sign(join(good, "SHA256SUMS"));
      const installed = await actionInstall(serve(good), { PREGATE_REQUIRE_SIGNATURE: "1", ...signer.installEnv(file) });
      expect(installed.code, installed.text).toBe(0);
      expect(existsSync(join(installed.home, ".local/bin/pregate"))).toBe(true);

      const bad = mkdtempSync(join(root, "bad-"));
      const again = archive(bad, name);
      signer.sign(again);
      const bytes = readFileSync(again);
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
      writeFileSync(again, bytes);
      writeFileSync(join(bad, "SHA256SUMS"), `${sha256(again)}  ${name}\n`);
      signer.sign(join(bad, "SHA256SUMS"));
      const rejected = await actionInstall(serve(bad), signer.installEnv(again));
      expect(rejected.code).not.toBe(0);
      expect(rejected.text).toContain("cosign signature mismatch");
      expect(existsSync(join(rejected.home, ".local/bin/pregate"))).toBe(false);
    });

    test("install.sh accepts a real bundle and refuses a tampered archive", () => {
      const dir = mkdtempSync(join(root, "install-"));
      const tar = archive(dir, "archive.tar.gz");
      signer.sign(tar);
      const home = join(dir, "home");
      const tmp = join(dir, "tmp");
      mkdirSync(home);
      mkdirSync(tmp);
      const run = (archivePath: string, hash: string, signature?: string) => Bun.spawnSync(["/bin/sh", join(import.meta.dir, "../install.sh")], {
        env: {
          PATH: `${signer.binDir}:${process.env.PATH ?? ""}`,
          HOME: home,
          TMPDIR: tmp,
          PREGATE_ARCHIVE: archivePath,
          PREGATE_SHA256: hash,
          ...signer.installEnv(archivePath, signature),
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const ok = run(tar, sha256(tar));
      expect(ok.exitCode, ok.stderr.toString()).toBe(0);
      const tampered = join(dir, "tampered.tar.gz");
      const bytes = readFileSync(tar);
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
      writeFileSync(tampered, bytes);
      const bad = run(tampered, sha256(tampered), `${tar}.bundle`);
      expect(bad.exitCode).toBe(1);
      expect(bad.stderr.toString()).toContain("signature mismatch");
    });
  });
}
