import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";

// Offline signing for the default suite. The shim is a script at a fixed path in this
// repository. Tests must not download cosign and must not copy a cosign binary into a fresh
// temp directory: that new path is a different program to a host firewall, and the real
// cosign contacts tuf-repo-cdn.sigstore.dev even for a keyed signature.
export const FAKE_COSIGN = join(import.meta.dir, "shims", "cosign");

// Set only in GitHub Actions. Local `bun test` leaves it unset and skips test/signing.e2e.test.ts.
export const SIGSTORE_E2E_ENV = "PREGATE_E2E_SIGSTORE";

export interface Signer {
  kind: "cosign";
  /** Directory to prepend to PATH so installers find this cosign. Never a fresh temp copy. */
  binDir: string;
  /** Absolute cosign path. The default suite always points at FAKE_COSIGN. */
  bin: string;
  sign(file: string): void;
  verify(file: string): { ok: boolean; text: string };
  /** Installer env. `signature` selects a bundle that is not the sidecar of `archive`. */
  installEnv(archive: string, signature?: string): Record<string, string>;
}

function run(bin: string, args: string[]): { ok: boolean; text: string } {
  const result = Bun.spawnSync([bin, ...args], {
    env: { ...process.env, COSIGN_PASSWORD: "pregate-test", COSIGN_YES: "true" },
    stdout: "pipe",
    stderr: "pipe",
  });
  return { ok: result.exitCode === 0, text: result.stdout.toString() + result.stderr.toString() };
}

function keyedSigner(dir: string, bin: string): Signer {
  const keyDir = join(dir, "keys");
  mkdirSync(keyDir, { recursive: true });
  const pub = join(keyDir, "cosign.pub");
  const key = join(keyDir, "cosign.key");
  const made = run(bin, ["generate-key-pair", "--output-key-prefix", join(keyDir, "cosign")]);
  if (!made.ok) throw new Error(made.text);
  // A probe catches a shim or cosign that cannot sign at all. The offline shim never leaves the machine.
  const probe = join(keyDir, "probe");
  writeFileSync(probe, "probe\n");
  const probed = run(bin, ["sign-blob", "--yes", "--key", key, "--bundle", `${probe}.bundle`, probe]);
  if (!probed.ok) throw new Error(probed.text);
  return {
    kind: "cosign",
    binDir: dirname(bin),
    bin,
    sign(file) {
      const signed = run(bin, ["sign-blob", "--yes", "--key", key, "--bundle", `${file}.bundle`, file]);
      if (!signed.ok) throw new Error(signed.text);
    },
    verify(file) {
      return run(bin, ["verify-blob", "--key", pub, "--bundle", `${file}.bundle`, file]);
    },
    installEnv(archive, signature) {
      return { PREGATE_COSIGN_KEY: pub, PREGATE_COSIGN_BUNDLE: signature ?? `${archive}.bundle` };
    },
  };
}

/** Offline signer. Ignores any cosign on PATH. The same shim path is used for every test run. */
export function prepareSigner(dir: string): Signer {
  if (!existsSync(FAKE_COSIGN)) throw new Error(`offline cosign shim missing: ${FAKE_COSIGN}`);
  return keyedSigner(dir, FAKE_COSIGN);
}

export function sigstoreE2EEnabled(): boolean {
  return process.env[SIGSTORE_E2E_ENV] === "1";
}

function realCosignOnPath(): string {
  const shim = realpathSync(FAKE_COSIGN);
  const tempRoot = realpathSync(tmpdir());
  for (const dir of (process.env.PATH ?? "").split(sep === "\\" ? ";" : ":")) {
    if (!dir) continue;
    const candidate = join(dir, "cosign");
    if (!existsSync(candidate)) continue;
    let resolved: string;
    try {
      resolved = realpathSync(candidate);
    } catch {
      continue;
    }
    if (resolved === shim) continue;
    // A binary under the temp dir is a per-run copy. Refuse it so tests cannot download one there.
    if (resolved === tempRoot || resolved.startsWith(tempRoot + sep)) {
      throw new Error(`refusing to run a cosign from a temp directory (${resolved}); install cosign on PATH`);
    }
    return candidate;
  }
  throw new Error(`${SIGSTORE_E2E_ENV}=1 but no real cosign is on PATH. Install cosign 3.x (the offline shim does not count).`);
}

/**
 * Keyed cosign from its installed path. Contacts Sigstore. Call only from the opt-in end-to-end
 * test. Does not download cosign and does not copy the binary.
 */
export function prepareRealCosign(dir: string): Signer {
  if (!sigstoreE2EEnabled()) {
    throw new Error(`prepareRealCosign refused: set ${SIGSTORE_E2E_ENV}=1 to contact Sigstore`);
  }
  return keyedSigner(dir, realCosignOnPath());
}
