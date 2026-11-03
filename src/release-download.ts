import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENGINE_VERSION, REPO } from "./product.ts";
import { WINDOWS } from "./platform.ts";

const METADATA_LIMIT = 1024 * 1024;
const ARCHIVE_LIMIT = 256 * 1024 * 1024;
const curlName = WINDOWS ? "curl.exe" : "curl";
type Answer = string | { error: string };
type Failure = { error: string; fatal: boolean };
function detail(text: string): string { return text.trim().replace(/\s+/g, " ").slice(0, 1024); }

function publicFile(url: string, file: string, limit: number): Failure | null {
  const curl = Bun.which(curlName);
  if (curl === null) return { error: `${curlName} is not installed`, fatal: false };
  const result = Bun.spawnSync([curl, "-q", "--fail", "--silent", "--show-error", "--location", "--proto", "=https", "--proto-redir", "=https",
    "--tlsv1.2", "--max-redirs", "5", "--connect-timeout", "10", "--max-time", "120", "--max-filesize", String(limit),
    "--header", "Accept: application/vnd.github+json", "--output", file, url], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 125_000 });
  if (result.exitCode !== 0) return { error: detail(result.stderr.toString()) || `${curlName} exited ${result.exitCode}`, fatal: result.exitCode === 63 };
  const size = statSync(file, { throwIfNoEntry: false })?.size;
  return size === undefined || size === 0 || size > limit ? { error: "Download is missing, empty or exceeds its size limit; nothing installed.", fatal: true } : null;
}

function authenticated(args: string[], publicError: string): Answer {
  if (Bun.which("gh") === null) return { error: `Public release access is unavailable (${publicError}). Install gh (https://cli.github.com), run gh auth login, and confirm it can read ${REPO}. Or use the verified local archive installer.` };
  const result = Bun.spawnSync(["gh", ...args], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 300_000 });
  return result.exitCode === 0 ? result.stdout.toString() : { error: `Public release access failed (${publicError}); authenticated gh failed: ${detail(result.stderr.toString()) || `exit ${result.exitCode}`}. Check the network, gh auth status and read access to ${REPO}.` };
}

function checkedVersion(tag: string): Answer {
  return ENGINE_VERSION.test(tag.trim().replace(/^v/, "")) ? tag.trim() : { error: "Latest release has no valid version; no update was started." };
}

function manifestProblem(file: string, asset: string): string | null {
  const entries = readFileSync(file, "utf8").split(/\r?\n/).map(line => /^([0-9a-f]{64}) [ *](.+)$/.exec(line)).filter(match => match?.[2] === asset);
  return entries.length === 1 ? null : `SHA256SUMS must list exactly one valid SHA-256 for ${asset}; nothing installed.`;
}

// Management commands only. Public releases need no account. gh auth is the fallback when anonymous metadata is unavailable.
export function latestRelease(): Answer {
  return releaseIn(mkdtempSync(join(tmpdir(), "pregate-release-")));
}

function releaseIn(directory: string): Answer {
  try { return releaseVersion(join(directory, "latest.json")); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function releaseVersion(file: string): Answer {
  const unavailable = publicFile(`https://api.github.com/repos/${REPO}/releases/latest`, file, METADATA_LIMIT);
  if (unavailable !== null) {
    if (unavailable.fatal) return { error: unavailable.error };
    const answer = authenticated(["release", "view", "--repo", REPO, "--json", "tagName", "--jq", ".tagName"], unavailable.error);
    return typeof answer === "string" ? checkedVersion(answer) : answer;
  }
  const release = releaseMetadata(file);
  if (release === undefined) return { error: "Public release metadata is not valid JSON; no update was started." };
  if (release === null || typeof release !== "object" || typeof release.tag_name !== "string" || release.draft === true || release.prerelease === true) return { error: "Public latest release metadata has no valid stable version; no update was started." };
  return checkedVersion(release.tag_name);
}

// JSON.parse never yields undefined, so undefined means the metadata is not JSON.
function releaseMetadata(file: string): { tag_name?: unknown; draft?: unknown; prerelease?: unknown } | undefined {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return undefined; }
}

// Acquire the manifest and archive through ONE channel. The caller verifies before extraction.
export function downloadRelease(version: string, asset: string, directory: string): string | null {
  if (!ENGINE_VERSION.test(version) || !/^pregate-[0-9A-Za-z.-]+\.(tar\.gz|zip)$/.test(asset)) return "Invalid release version or asset; nothing downloaded.";
  const base = `https://github.com/${REPO}/releases/download/v${version}`;
  const sums = join(directory, "SHA256SUMS"), archive = join(directory, asset);
  let unavailable = publicFile(`${base}/SHA256SUMS`, sums, METADATA_LIMIT);
  if (unavailable === null) {
    const malformed = manifestProblem(sums, asset);
    if (malformed !== null) return malformed;
    unavailable = publicFile(`${base}/${asset}`, archive, ARCHIVE_LIMIT);
  }
  if (unavailable === null) return null;
  rmSync(sums, { force: true }); rmSync(archive, { force: true });
  if (unavailable.fatal) return unavailable.error;
  const downloaded = authenticated(["release", "download", `v${version}`, "--repo", REPO, "--pattern", asset, "--pattern", "SHA256SUMS", "--dir", directory], unavailable.error);
  if (typeof downloaded !== "string") return downloaded.error;
  if (!existsSync(sums) || !existsSync(archive)) return `Release v${version} has no ${asset} or SHA256SUMS; nothing installed.`;
  if (statSync(sums).size > METADATA_LIMIT || statSync(archive).size > ARCHIVE_LIMIT) return "Release exceeds its download size limit; nothing installed.";
  return manifestProblem(sums, asset);
}
