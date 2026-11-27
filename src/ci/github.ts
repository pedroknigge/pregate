import { isObject } from "../harness/wire.ts";
import { WINDOWS } from "../platform.ts";
import { classify, type CiSignal, type RawGitHubSignal } from "./provider.ts";

const BODY_LIMIT = 1024 * 1024;
const PAGE = 100;

interface GitHubCiSource {
  api: string;
  token: string | null;
  // Tests inject a fetch. The compiled binary uses curl: its fetch does not complete an http loopback.
  fetch?: typeof fetch;
}

export class GitHubCiError extends Error {}

// Latest commit statuses and check runs for one SHA. An HTTP error, a malformed body, or a
// truncated page throws: the caller fails closed instead of treating the gap as a pass.
export async function readGitHubSignals(repository: string, sha: string, source: GitHubCiSource, actionChecks: readonly string[]): Promise<CiSignal[]> {
  const root = source.api.replace(/\/$/, "");
  const [statuses, checks] = await Promise.all([
    getJson(source, `${root}/repos/${repository}/commits/${encodeURIComponent(sha)}/statuses?per_page=${PAGE}`),
    getJson(source, `${root}/repos/${repository}/commits/${encodeURIComponent(sha)}/check-runs?per_page=${PAGE}`),
  ]);
  return [...statusSignals(statuses, actionChecks), ...checkSignals(checks, actionChecks)];
}

export function githubApiBase(value: string | undefined): string {
  if (value === undefined || value === "") return "https://api.github.com";
  const base = value.replace(/\/$/, "");
  if (!/^https?:\/\/[A-Za-z0-9._:-]+$/.test(base)) throw new GitHubCiError("PREGATE_GITHUB_API must be an http(s) origin with no path.");
  if (base.startsWith("http://") && !/^http:\/\/(127\.0\.0\.1|localhost)(:[0-9]+)?$/.test(base)) {
    throw new GitHubCiError("PREGATE_GITHUB_API may use http only on 127.0.0.1 or localhost.");
  }
  return base;
}

export function githubToken(): string | null {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  return token === "" ? null : token;
}

function statusSignals(body: unknown, actionChecks: readonly string[]): CiSignal[] {
  if (!Array.isArray(body)) throw new GitHubCiError("GitHub commit statuses were not a list.");
  if (body.length >= PAGE) throw new GitHubCiError("GitHub returned a full page of commit statuses. Refusing to ignore the rest.");
  const seen = new Set<string>();
  const signals: CiSignal[] = [];
  for (const entry of body) {
    if (!isObject(entry) || typeof entry.context !== "string" || typeof entry.state !== "string") {
      throw new GitHubCiError("A GitHub commit status is missing its context or state.");
    }
    if (seen.has(entry.context)) continue;
    seen.add(entry.context);
    const raw: RawGitHubSignal = {
      kind: "commit-status",
      name: entry.context,
      state: entry.state,
      status: "",
      description: typeof entry.description === "string" ? entry.description : "",
      url: typeof entry.target_url === "string" ? entry.target_url : null,
      appSlug: null,
    };
    const signal = classify(raw, actionChecks);
    if (signal) signals.push(signal);
  }
  return signals;
}

function checkSignals(body: unknown, actionChecks: readonly string[]): CiSignal[] {
  if (!isObject(body) || !Array.isArray(body.check_runs) || typeof body.total_count !== "number") {
    throw new GitHubCiError("GitHub check runs were not a check-run list.");
  }
  if (body.total_count > body.check_runs.length) {
    throw new GitHubCiError("GitHub returned an incomplete check-run page. Refusing to treat the missing runs as passed.");
  }
  const seen = new Set<string>();
  const signals: CiSignal[] = [];
  for (const entry of body.check_runs) {
    if (!isObject(entry) || typeof entry.name !== "string") throw new GitHubCiError("A GitHub check run is missing its name.");
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    const output = isObject(entry.output) ? entry.output : null;
    const description = [output?.title, output?.summary].filter((part) => typeof part === "string").join(" ");
    const app = isObject(entry.app) && typeof entry.app.slug === "string" ? entry.app.slug : null;
    const raw: RawGitHubSignal = {
      kind: "check-run",
      name: entry.name,
      state: typeof entry.conclusion === "string" ? entry.conclusion : "",
      status: typeof entry.status === "string" ? entry.status : "",
      description,
      url: typeof entry.html_url === "string" ? entry.html_url : null,
      appSlug: app,
    };
    const signal = classify(raw, actionChecks);
    if (signal) signals.push(signal);
  }
  return signals;
}

async function getJson(source: GitHubCiSource, url: string): Promise<unknown> {
  const loaded = source.fetch ? await fetchJson(source.fetch, url, source.token) : await curlJson(url, source.token, source.api.startsWith("http://"));
  if (loaded.body.length > BODY_LIMIT) throw new GitHubCiError("GitHub response exceeds 1 MiB. Refusing to judge CI from it.");
  if (loaded.status < 200 || loaded.status >= 300) throw new GitHubCiError(`GitHub returned ${loaded.status}.`);
  try { return JSON.parse(loaded.body) as unknown; }
  catch { throw new GitHubCiError("GitHub returned malformed JSON."); }
}

async function fetchJson(fetchImpl: typeof fetch, url: string, token: string | null): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pregate",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new GitHubCiError(`GitHub request failed: ${(error as Error).message}`);
  }
  return { status: response.status, body: new TextDecoder().decode(new Uint8Array(await response.arrayBuffer())) };
}

// curl, not fetch: a compiled binary's fetch does not finish an http request to 127.0.0.1, which
// is how the end-to-end test serves GitHub. https://api.github.com uses the same path.
async function curlJson(url: string, token: string | null, allowHttp: boolean): Promise<{ status: number; body: string }> {
  const curlName = WINDOWS ? "curl.exe" : "curl";
  const curl = Bun.which(curlName);
  if (curl === null) throw new GitHubCiError(`${curlName} is not installed.`);
  const proto = allowHttp ? "=http,https" : "=https";
  const args = [curl, "-q", "--silent", "--show-error", "--location", "--max-redirs", "0",
    "--connect-timeout", "10", "--max-time", "20", "--max-filesize", String(BODY_LIMIT),
    "--proto", proto, "--proto-redir", proto,
    "-H", "Accept: application/vnd.github+json",
    "-H", "User-Agent: pregate",
    "-H", "X-GitHub-Api-Version: 2022-11-28",
    "-w", "\n%{http_code}"];
  if (token) args.push("-H", `Authorization: Bearer ${token}`);
  args.push(url);
  const proc = Bun.spawn(args, { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), 25_000);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  clearTimeout(timer);
  if (code === null) throw new GitHubCiError("GitHub request timed out.");
  const split = stdout.lastIndexOf("\n");
  const body = split < 0 ? stdout : stdout.slice(0, split);
  const status = Number(split < 0 ? "" : stdout.slice(split + 1).trim());
  if (!Number.isInteger(status) || status === 0) {
    const detail = stderr.trim().replace(/\s+/g, " ").slice(0, 300);
    throw new GitHubCiError(`GitHub request failed${detail ? `: ${detail}` : ""}.`);
  }
  return { status, body };
}
