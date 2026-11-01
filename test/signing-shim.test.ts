import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { WINDOWS } from "../src/platform.ts";
import { FAKE_COSIGN, prepareSigner } from "./signing-tool.ts";

// Default-suite signing. The shim is a repository file. Nothing here may contact Sigstore.

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

function archive(dir: string): string {
  const src = join(dir, "src");
  mkdirSync(src);
  writeFileSync(join(src, "pregate"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(src, "pregate"), 0o755);
  const out = join(dir, "pregate.tar.gz");
  const packed = Bun.spawnSync(["tar", "-czf", out, "-C", src, "pregate"], { env: { COPYFILE_DISABLE: "1" } });
  if (packed.exitCode !== 0) throw new Error(packed.stderr.toString());
  return out;
}

if (WINDOWS) {
  test.skip("offline cosign shim is POSIX (install.sh and the shim are shell)", () => {});
} else describe("offline cosign shim", () => {
  test("the shim is the fixed in-repo script and has no network client", () => {
    const source = readFileSync(FAKE_COSIGN, "utf8");
    expect(source.startsWith("#!/bin/sh\n")).toBe(true);
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\b(curl|wget|nc|ncat)\b/);
    expect(statSync(FAKE_COSIGN).mode & 0o111).not.toBe(0);
    const dir = mkdtempSync(join(tmpdir(), "pregate-shim-"));
    try {
      const signer = prepareSigner(dir);
      expect(signer.bin).toBe(FAKE_COSIGN);
      expect(signer.binDir).toBe(dirname(FAKE_COSIGN));
      expect(signer.kind).toBe("cosign");
      const file = join(dir, "payload");
      writeFileSync(file, "payload\n");
      signer.sign(file);
      expect(signer.verify(file).ok).toBe(true);
      const bytes = readFileSync(file);
      bytes[0] = (bytes[0] ?? 0) ^ 0xff;
      writeFileSync(file, bytes);
      expect(signer.verify(file).ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the offline signer does not spawn curl or a cosign from PATH", () => {
    const result = Bun.spawnSync([process.execPath, join(import.meta.dir, "signing-decoy-check.ts")], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
  });

  test("install.sh accepts a shim signature and refuses a tampered archive", () => {
    const dir = mkdtempSync(join(tmpdir(), "pregate-shim-install-"));
    try {
      const signer = prepareSigner(dir);
      const tar = archive(dir);
      signer.sign(tar);
      const home = join(dir, "home");
      const tmp = join(dir, "tmp");
      mkdirSync(home);
      mkdirSync(tmp);
      const run = (archivePath: string, hash: string, signature?: string) => Bun.spawnSync(["/bin/sh", join(import.meta.dir, "../install.sh")], {
        env: {
          ...process.env,
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
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
