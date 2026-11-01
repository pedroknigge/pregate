import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Pinned to the cosign release the release workflow installs (cosign-installer v4.1.1 → cosign 3.x).
const COSIGN_VERSION = "v3.1.4";
const COSIGN_SHA256: Record<string, string> = {
  "linux-amd64": "424e2c97d0b45fd7a6b608a87f090f35633f4c23ece5f092d48bba11aaf4bbfa",
  "linux-arm64": "ade83b7aac62e131cacfe96d958948b2150cc9efec46a570a2649b8e27dedad2",
  "darwin-amd64": "9d1e4abe2b6be279ed0d2ff706fde1ccd738747c834e3e6d44039c238867334f",
  "darwin-arm64": "9f9b8cd557cf2e5b3df3373a00baa005a86b02391e3e06dd0ce37b3a1533d3a4",
};

export interface Signer {
  kind: "cosign" | "minisign";
  binDir: string;
  sign(file: string): void;
  verify(file: string): { ok: boolean; text: string };
  /** Installer env. `signature` selects a bundle or .minisig that is not the sidecar of `archive`. */
  installEnv(archive: string, signature?: string): Record<string, string>;
}

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

function run(bin: string, args: string[]): { ok: boolean; text: string } {
  const result = Bun.spawnSync([bin, ...args], {
    env: { ...process.env, COSIGN_PASSWORD: "pregate-test", COSIGN_YES: "true" },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { ok: result.exitCode === 0, text: result.stdout.toString() + result.stderr.toString() };
}

function place(bin: string, dir: string, name: string): string {
  const dest = join(dir, name);
  writeFileSync(dest, readFileSync(bin));
  chmodSync(dest, 0o755);
  return dest;
}

function downloadCosign(dir: string): string | null {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : "";
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "amd64" : "";
  const sum = COSIGN_SHA256[`${os}-${arch}`];
  if (!os || !sum) return null;
  const dest = join(dir, "cosign");
  const asset = `cosign-${os}-${arch}`;
  // Short timeouts: offline, the suite skips the signature tests instead of hanging.
  const result = Bun.spawnSync(["curl", "-fsSL", "--connect-timeout", "5", "--max-time", "60", "-o", dest, `https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/${asset}`], {
    stdout: "pipe", stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;
  if (sha256(dest) !== sum) throw new Error(`cosign ${asset} checksum mismatch`);
  chmodSync(dest, 0o755);
  return dest;
}

/** A cosign on PATH is used as is. Otherwise the pinned release is downloaded, unless
 * PREGATE_TEST_OFFLINE=1. Returns null when no signer can be obtained: the callers skip. */
export function prepareSigner(dir: string, kind: "cosign" | "any" = "any"): Signer | null {
  const binDir = join(dir, "signer-bin");
  mkdirSync(binDir, { recursive: true });
  const existing = Bun.which("cosign");
  const offline = process.env.PREGATE_TEST_OFFLINE === "1";
  const cosign = existing ? place(existing, binDir, "cosign") : offline ? null : downloadCosign(binDir);
  if (cosign) {
    const keyDir = join(dir, "keys");
    mkdirSync(keyDir, { recursive: true });
    const made = run(cosign, ["generate-key-pair", "--output-key-prefix", join(keyDir, "cosign")]);
    if (!made.ok) throw new Error(made.text);
    const pub = join(keyDir, "cosign.pub");
    const key = join(keyDir, "cosign.key");
    // cosign 3 fetches its signing config from the Sigstore TUF repository even for a keyed
    // sign-blob. A probe signature tells an unreachable Sigstore apart from a broken cosign.
    const probe = join(keyDir, "probe");
    writeFileSync(probe, "probe\n");
    const probed = run(cosign, ["sign-blob", "--yes", "--key", key, "--bundle", `${probe}.bundle`, probe]);
    if (!probed.ok) {
      if (/TUF|i\/o timeout|dial tcp|no such host|connection refused|context deadline/i.test(probed.text)) {
        console.warn(`signing-tool: Sigstore is unreachable, cosign tests skip: ${probed.text.trim().split("\n")[0]}`);
        return kind === "cosign" ? null : minisign(dir, binDir);
      }
      throw new Error(probed.text);
    }
    return {
      kind: "cosign",
      binDir,
      sign(file) {
        const signed = run(cosign, ["sign-blob", "--yes", "--key", key, "--bundle", `${file}.bundle`, file]);
        if (!signed.ok) throw new Error(signed.text);
      },
      verify(file) {
        return run(cosign, ["verify-blob", "--key", pub, "--bundle", `${file}.bundle`, file]);
      },
      installEnv(archive, signature) {
        return { PREGATE_COSIGN_KEY: pub, PREGATE_COSIGN_BUNDLE: signature ?? `${archive}.bundle` };
      },
    };
  }
  if (kind === "cosign") return null;
  return minisign(dir, binDir);
}

function minisign(dir: string, binDir: string): Signer | null {
  const mini = Bun.which("minisign");
  if (!mini) return null;
  const bin = place(mini, binDir, "minisign");
  const pub = join(dir, "minisign.pub");
  const sec = join(dir, "minisign.key");
  const made = run(bin, ["-G", "-p", pub, "-s", sec, "-W"]);
  if (!made.ok) throw new Error(made.text);
  return {
    kind: "minisign",
    binDir,
    sign(file) {
      const signed = run(bin, ["-S", "-s", sec, "-m", file, "-x", `${file}.minisig`]);
      if (!signed.ok) throw new Error(signed.text);
    },
    verify(file) {
      return run(bin, ["-V", "-p", pub, "-m", file, "-x", `${file}.minisig`]);
    },
    installEnv(archive, signature) {
      return { PREGATE_MINISIGN_PUB: pub, PREGATE_MINISIGN_SIG: signature ?? `${archive}.minisig` };
    },
  };
}
