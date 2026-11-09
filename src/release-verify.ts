import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { REPO } from "./product.ts";

function clip(text: string): string {
  const line = text.trim().replace(/\s+/g, " ");
  return line.length > 300 ? `${line.slice(0, 300)}…` : line;
}

function onPath(name: string): string | null {
  return Bun.which(name, { PATH: process.env.PATH ?? process.env.Path ?? "" });
}

function cosign(): string | null {
  return onPath(process.platform === "win32" ? "cosign.exe" : "cosign");
}

function verifyCosignBlob(file: string, bundle: string): string | null {
  const bin = cosign();
  if (bin === null) return "cosign is required to verify the archive signature; nothing installed";
  const key = process.env.PREGATE_COSIGN_KEY;
  const args = key !== undefined && key !== ""
    ? ["verify-blob", "--key", key, "--bundle", bundle, file]
    : ["verify-blob", "--bundle", bundle,
      "--certificate-identity-regexp", `^https://github.com/${REPO}/\\.github/workflows/release\\.yml@refs/tags/v`,
      "--certificate-oidc-issuer", "https://token.actions.githubusercontent.com",
      file];
  const result = Bun.spawnSync([bin, ...args], { env: { ...process.env, COSIGN_PASSWORD: process.env.COSIGN_PASSWORD, COSIGN_YES: "true" },
    stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (result.exitCode === 0) return null;
  return `cosign signature mismatch for ${file.split(/[/\\]/).pop()}; nothing installed (${clip(result.stderr.toString() + result.stdout.toString()) || `exit ${result.exitCode}`})`;
}

function downloadBundle(version: string, bundle: string, dest: string): boolean {
  if (existsSync(dest)) return true;
  const base = `https://github.com/${REPO}/releases/download/v${version}`;
  const curl = onPath(process.platform === "win32" ? "curl.exe" : "curl");
  if (curl !== null) {
    const result = Bun.spawnSync([curl, "-q", "--fail", "--silent", "--show-error", "--location", "--proto", "=https", "--proto-redir", "=https",
      "--tlsv1.2", "--max-redirs", "5", "--connect-timeout", "10", "--max-time", "120", "--max-filesize", "1048576", "--output", dest, `${base}/${bundle}`],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 125_000 });
    if (result.exitCode === 0 && existsSync(dest)) return true;
  }
  const ghBin = onPath("gh");
  if (ghBin === null) return false;
  const gh = Bun.spawnSync([ghBin, "release", "download", `v${version}`, "--repo", REPO, "--pattern", bundle, "--dir", dirname(dest)],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 300_000 });
  return gh.exitCode === 0 && existsSync(dest);
}

function verifyOfflineSignatures(archive: string): string | null {
  const cosignKey = process.env.PREGATE_COSIGN_KEY;
  const cosignBundle = process.env.PREGATE_COSIGN_BUNDLE;
  if (cosignKey !== undefined && cosignKey !== "" || cosignBundle !== undefined && cosignBundle !== "") {
    if (cosign() === null) return "cosign is required to verify the archive signature; nothing installed";
    const bundle = cosignBundle ?? `${archive}.bundle`;
    if (!existsSync(bundle)) return `cosign bundle missing for ${archive}; nothing installed`;
    return verifyCosignBlob(archive, bundle);
  }
  const pub = process.env.PREGATE_MINISIGN_PUB;
  if (pub === undefined || pub === "") return null;
  const minisign = onPath("minisign");
  if (minisign === null) return "minisign is required to verify the archive signature; nothing installed";
  const sig = process.env.PREGATE_MINISIGN_SIG ?? `${archive}.minisig`;
  if (!existsSync(sig)) return `minisign signature missing for ${archive}; nothing installed`;
  const result = Bun.spawnSync([minisign, "-V", "-p", pub, "-m", archive, "-x", sig], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  return result.exitCode === 0 ? null : `minisign signature mismatch for ${archive}; nothing installed`;
}

export type SignatureNotice = { kind: "notice" | "warning"; text: string };

// Sigstore bundles beside a downloaded release, or offline cosign/minisign when PREGATE_ARCHIVE is set.
export function verifyReleaseArtifacts(o: { version: string; archive: string; archiveName: string; sums: string; offline: boolean }): (string | SignatureNotice)[] {
  const requireSignature = process.env.PREGATE_REQUIRE_SIGNATURE === "1";
  const out: (string | SignatureNotice)[] = [];
  if (o.offline) {
    const failed = verifyOfflineSignatures(o.archive);
    if (failed !== null) out.push(failed);
    return out;
  }
  const cosignBin = cosign();
  if (cosignBin === null) {
    if (requireSignature) return ["cosign is required to verify the release signature; nothing installed"];
    return out;
  }
  for (const [file, bundleName] of [[o.sums, "SHA256SUMS.bundle"], [o.archive, `${o.archiveName}.bundle`]] as const) {
    const bundle = join(join(file, ".."), bundleName);
    if (!existsSync(bundle) && !downloadBundle(o.version, bundleName, bundle)) {
      if (requireSignature) return [`release v${o.version} has no ${bundleName}; nothing installed`];
      out.push({ kind: "notice", text: `release v${o.version} has no ${bundleName}; signature not verified` });
      continue;
    }
    const failed = verifyCosignBlob(file, bundle);
    if (failed !== null) return [failed];
  }
  return out;
}
