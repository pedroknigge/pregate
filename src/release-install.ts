import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { ENGINE_VERSION, REPO } from "./product.ts";
import { downloadRelease } from "./release-download.ts";
import { verifyReleaseArtifacts } from "./release-verify.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { join } from "node:path";
import { PS_MODULES, psQuote } from "./windows-command.ts";

export const RELEASE_TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "windows-x64"];

function onPath(name: string): string | null {
  return Bun.which(name, { PATH: process.env.PATH ?? process.env.Path ?? "" });
}

function spawn(cmd: string[]): { exit: number | null; stdout: string; stderr: string } {
  const r = Bun.spawnSync(cmd, { env: process.env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 300_000 });
  return { exit: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

export function releaseAssetName(version: string): string | { error: string } {
  const target = `${WINDOWS ? "windows" : process.platform}-${process.arch}`;
  if (!RELEASE_TARGETS.includes(target)) return { error: `No PREGATE release for ${target}; available: ${RELEASE_TARGETS.join(", ")}.` };
  if (!ENGINE_VERSION.test(version)) return { error: `Invalid version: ${version} (expected X.Y.Z or X.Y.Z-pre).` };
  return `pregate-${version}-${target}.${WINDOWS ? "zip" : "tar.gz"}`;
}

function sha256Line(sums: string, asset: string): string | null {
  const entries = sums.split("\n").map((line) => /^([0-9a-f]{64}) [ *](.+)$/.exec(line)).filter((m) => m?.[2] === asset);
  return entries.length === 1 ? entries[0]![1]! : null;
}

function verifyArchiveDigest(archive: string, expected: string, label: string): string | null {
  const normalized = expected.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) return `The expected SHA-256 is not 64 hex digits: '${expected}'.`;
  const actual = new Bun.CryptoHasher("sha256").update(readFileSync(archive)).digest("hex");
  return actual === normalized ? null : `SHA-256 of ${label} differs from SHA256SUMS; nothing installed.`;
}

export type VerifiedExtract = { binary: string; notices: string[] };

// Download or accept a local archive, verify checksum and optional signatures, extract the engine binary.
export function verifiedEngineExtract(version: string, workDir: string): VerifiedExtract | { error: string } {
  const archivePath = process.env.PREGATE_ARCHIVE;
  const pinned = process.env.PREGATE_SHA256?.trim().toLowerCase();
  const notices: string[] = [];
  let asset: string;
  let archive: string;
  let expected: string;

  if (archivePath !== undefined && archivePath !== "") {
    if (pinned === undefined || pinned === "") return { error: "PREGATE_ARCHIVE needs PREGATE_SHA256, the archive's expected SHA-256." };
    if (!existsSync(archivePath)) return { error: `PREGATE_ARCHIVE is missing: ${archivePath}; nothing installed.` };
    asset = archivePath.split(/[/\\]/).pop() ?? "archive";
    archive = archivePath;
    expected = pinned;
    const failed = verifyArchiveDigest(archive, expected, asset);
    if (failed !== null) return { error: failed };
    for (const item of verifyReleaseArtifacts({ version, archive, archiveName: asset, sums: archive, offline: true })) {
      if (typeof item === "string") return { error: item };
      notices.push(item.text);
    }
  } else {
    const named = releaseAssetName(version);
    if (typeof named !== "object") asset = named; else return { error: named.error };
    const unavailable = downloadRelease(version, asset, workDir);
    if (unavailable !== null) return { error: `Could not download v${version} from ${REPO}: ${unavailable}` };
    const sums = join(workDir, "SHA256SUMS");
    archive = join(workDir, asset);
    if (!existsSync(sums) || !existsSync(archive)) return { error: `Release v${version} has no ${asset}, or SHA256SUMS does not list it; nothing installed.` };
    const listed = sha256Line(readFileSync(sums, "utf8"), asset);
    if (listed === null) return { error: `Release v${version} has no ${asset}, or SHA256SUMS does not list it; nothing installed.` };
    expected = pinned ?? listed;
    const failed = verifyArchiveDigest(archive, expected, asset);
    if (failed !== null) return { error: failed };
    for (const item of verifyReleaseArtifacts({ version, archive, archiveName: asset, sums, offline: false })) {
      if (typeof item === "string") {
        rmSync(sums, { force: true });
        rmSync(archive, { force: true });
        return { error: item };
      }
      notices.push(item.text);
    }
  }

  const extractDir = join(workDir, "x");
  mkdirSync(extractDir, { recursive: true });
  if (WINDOWS) {
    const extract = ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
      PS_MODULES + `Expand-Archive -LiteralPath ${psQuote(archive)} -DestinationPath ${psQuote(extractDir)}`];
    if (spawn(extract).exit !== 0) return { error: `${asset} could not be extracted; nothing installed.` };
  } else {
    const tar = onPath("tar");
    if (tar === null) return { error: "tar is required to extract the release archive; nothing installed." };
    const extracted = spawn([tar, "-xzf", archive, "-C", extractDir]);
    if (extracted.exit !== 0) {
      const detail = extracted.stderr.trim() || extracted.stdout.trim();
      return { error: `${asset} could not be extracted${detail ? ` (${detail})` : ""}; nothing installed.` };
    }
  }
  const binary = join(extractDir, ENGINE_FILE);
  if (!existsSync(binary)) return { error: "The archive has no executable engine; nothing installed." };
  return { binary, notices };
}
