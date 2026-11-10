import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadRelease, latestRelease } from "../src/release-download.ts";
import { update } from "../src/machine.ts";
import { WINDOWS } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

const areas: string[] = [];
const savedEnv = { ...process.env };
afterEach(() => {
  mock.restore();
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
  for (const area of areas.splice(0)) removeTree(area);
});

type Run = (args: string[]) => { code: number; stdout?: string; stderr?: string };
function transport(run: Run, tools = [WINDOWS ? "curl.exe" : "curl", "gh"]) {
  const calls: string[][] = [];
  spyOn(Bun, "which").mockImplementation(name => tools.includes(name) ? name : null);
  spyOn(Bun, "spawnSync").mockImplementation(((command: string[]) => {
    calls.push([...command]); const result = run(command);
    return { exitCode: result.code, stdout: Buffer.from(result.stdout ?? ""), stderr: Buffer.from(result.stderr ?? "") };
  }) as typeof Bun.spawnSync);
  return calls;
}
function area(): string { const path = mkdtempSync(join(tmpdir(), "pregate-release-test-")); areas.push(path); return path; }
function output(args: string[]): string { return args[args.indexOf("--output") + 1]!; }
const version = "9.9.9", asset = `pregate-${version}-darwin-arm64.tar.gz`;
const manifest = `${"0".repeat(64)}  ${asset}\n`;

test("anonymous public latest lookup has bounded HTTPS-only arguments and needs no gh", () => {
  const calls = transport(args => { writeFileSync(output(args), '{"tag_name":"v9.9.9","draft":false,"prerelease":false}'); return { code: 0 }; }, [WINDOWS ? "curl.exe" : "curl"]);
  expect(latestRelease()).toBe("v9.9.9"); expect(calls).toHaveLength(1);
  expect(calls[0]!.slice(1, 10)).toEqual(["-q", "--fail", "--silent", "--show-error", "--location", "--proto", "=https", "--proto-redir", "=https"]);
  expect(calls[0]).toContain("--max-filesize"); expect(calls[0]).toContain("--max-time");
  expect(calls[0]!.at(-1)).toBe("https://api.github.com/repos/pedroknigge/pregate/releases/latest");
  expect(existsSync(output(calls[0]!))).toBe(false);
});

test.each(["{", '{"tag_name":"main"}', '{"tag_name":"v9.9.9","draft":true}', '{"tag_name":"v9.9.9","prerelease":true}', "null"])("malformed or non-release metadata is fatal without fallback: %s", body => {
  const calls = transport(args => { writeFileSync(output(args), body); return { code: 0 }; });
  expect(latestRelease()).toHaveProperty("error"); expect(calls).toHaveLength(1);
});

test.each(["HTTP 404: private repository", "offline"])("unavailable public metadata uses authenticated lookup: %s", reason => {
  const calls = transport(args => args[0] === "gh" ? { code: 0, stdout: "v9.9.9\n" } : { code: 22, stderr: reason });
  expect(latestRelease()).toBe("v9.9.9"); expect(calls[1]).toEqual(["gh", "release", "view", "--repo", "pedroknigge/pregate", "--json", "tagName", "--jq", ".tagName"]);
});

test("unavailable public access with no gh gives a private/offline recovery route", () => {
  transport(() => ({ code: 22, stderr: "HTTP 404" }), [WINDOWS ? "curl.exe" : "curl"]);
  const result = latestRelease(); expect(result).toHaveProperty("error");
  expect((result as { error: string }).error).toContain("gh auth login"); expect((result as { error: string }).error).toContain("verified local archive");
});

test("public pair acquisition pins assets and performs no authenticated process", () => {
  const directory = area(), calls = transport(args => { writeFileSync(output(args), args.at(-1)!.endsWith("SHA256SUMS") ? manifest : "archive"); return { code: 0 }; });
  expect(downloadRelease(version, asset, directory)).toBeNull(); expect(calls).toHaveLength(2);
  expect(calls[0]!.at(-1)).toEndWith(`/v${version}/SHA256SUMS`); expect(calls[1]!.at(-1)).toEndWith(`/v${version}/${asset}`);
  expect(readFileSync(join(directory, asset), "utf8")).toBe("archive");
});

test("partial public pair is removed before gh acquisition; no channels are mixed", () => {
  const directory = area();
  const calls = transport(args => {
    if (args[0] === "gh") {
      expect(existsSync(join(directory, asset))).toBe(false); expect(existsSync(join(directory, "SHA256SUMS"))).toBe(false);
      writeFileSync(join(directory, asset), "authenticated archive"); writeFileSync(join(directory, "SHA256SUMS"), manifest); return { code: 0 };
    }
    writeFileSync(output(args), args.at(-1)!.endsWith("SHA256SUMS") ? manifest : "partial"); return { code: args.at(-1)!.endsWith("SHA256SUMS") ? 0 : 22 };
  });
  expect(downloadRelease(version, asset, directory)).toBeNull(); expect(calls).toHaveLength(3);
  expect(readFileSync(join(directory, "SHA256SUMS"), "utf8")).toBe(manifest);
});

test.each(["invalid manifest\n", `${manifest}${manifest}`])("malformed or duplicate public manifest never starts an archive request or fallback", body => {
  const calls = transport(args => { writeFileSync(output(args), body); return { code: 0 }; });
  expect(downloadRelease(version, asset, area())).toContain("exactly one valid SHA-256"); expect(calls).toHaveLength(1);
});

test.each(["curl-limit", "post-limit", "empty"])("public body limit failure %s never attempts gh", mode => {
  const calls = transport(args => {
    if (mode === "curl-limit") return { code: 63, stderr: "maximum file size exceeded" };
    writeFileSync(output(args), ""); if (mode === "post-limit") truncateSync(output(args), 1024 * 1024 + 1);
    return { code: 0 };
  });
  expect(latestRelease()).toHaveProperty("error"); expect(calls).toHaveLength(1);
});

test.each(["curl-limit", "post-limit"])("public archive %s is fatal and clears the pair without fallback", mode => {
  const directory = area(), calls = transport(args => {
    if (args.at(-1)!.endsWith("SHA256SUMS")) { writeFileSync(output(args), manifest); return { code: 0 }; }
    if (mode === "curl-limit") return { code: 63, stderr: "archive size limit" };
    writeFileSync(output(args), ""); truncateSync(output(args), 256 * 1024 * 1024 + 1); return { code: 0 };
  });
  expect(downloadRelease(version, asset, directory)).toContain("size limit"); expect(calls).toHaveLength(2);
  expect(existsSync(join(directory, asset))).toBe(false); expect(existsSync(join(directory, "SHA256SUMS"))).toBe(false);
});

test("invalid release pins and path-like assets are rejected before any process", () => {
  const calls = transport(() => { throw new Error("must not run"); });
  expect(downloadRelease("main", asset, area())).toContain("Invalid release");
  expect(downloadRelease(version, "../pregate.tar.gz", area())).toContain("Invalid release"); expect(calls).toEqual([]);
});

test("machine checksum mismatch never extracts, starts a binary or changes consent/launcher", async () => {
  const directory = area(), data = join(directory, "data"), state = join(directory, "state");
  process.env.XDG_DATA_HOME = data; process.env.XDG_STATE_HOME = state; process.env.HOME = join(directory, "home");
  const base = join(data, "pregate"), launcher = join(base, "bin", WINDOWS ? "launcher.ps1" : "pregate"), consent = join(base, "consent", "fixture.json");
  mkdirSync(join(base, "bin"), { recursive: true }); mkdirSync(join(base, "consent"));
  writeFileSync(launcher, "old launcher"); writeFileSync(consent, "disabled consent");
  const target = `${WINDOWS ? "windows" : process.platform}-${process.arch}`;
  const name = `pregate-${version}-${target}.${WINDOWS ? "zip" : "tar.gz"}`;
  const calls = transport(args => { writeFileSync(output(args), args.at(-1)!.endsWith("SHA256SUMS") ? `${"0".repeat(64)}  ${name}\n` : "invalid archive"); return { code: 0 }; });
  const result = await update({ engine: version });
  expect(result.code).toBe(1); expect(result.text).toContain("differs from SHA256SUMS"); expect(calls).toHaveLength(2);
  expect(existsSync(join(base, version))).toBe(false); expect(readFileSync(launcher, "utf8")).toBe("old launcher"); expect(readFileSync(consent, "utf8")).toBe("disabled consent");
});
