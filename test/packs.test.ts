import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { canonical, packCatalog } from "../src/compile.ts";
import { packTemplate } from "../src/pack-template.ts";
import { cachedPack, fetchPack, testPack } from "../src/packs.ts";
import { clock, grammars } from "../src/gate.ts";
import { sha256 } from "../src/state.ts";
import { ENGINE_FILE } from "../src/platform.ts";

test("a data-only scaffold has real pass, fail and trap coverage", async () => {
  await grammars();
  expect(testPack(packTemplate("acme"), clock)).toEqual([]);
});

test("local Git packs pin commit and content, never auto-update, reject corruption and require human activation", async () => {
  await grammars();
  const area = mkdtempSync(join(tmpdir(), "pregate-packs-"));
  const saved = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = join(area, "data");
  await restoredAfter(area, saved, async () => {
    const remote = join(area, "remote");
    for (const [path, text] of Object.entries(packTemplate("acme"))) {
      mkdirSync(dirname(join(remote, path)), { recursive: true });
      writeFileSync(join(remote, path), text);
    }
    const git = (...args: string[]) => {
      const out = Bun.spawnSync(["git", "-c", "user.name=Pack", "-c", "user.email=pack@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: remote, stderr: "pipe", stdout: "pipe" });
      if (out.exitCode !== 0) throw new Error(out.stderr.toString());
      return out.stdout.toString().trim();
    };
    git("init", "-q"); git("add", "."); git("commit", "-qm", "pack v1");
    const first = fetchPack(remote, "HEAD", clock);
    expect(fetchPack("ext::untrusted-command", "HEAD", clock)).toHaveProperty("errors");
    expect(fetchPack("helper::untrusted-command", "HEAD", clock)).toHaveProperty("errors");
    if ("errors" in first) throw new Error(first.errors.join("\n"));
    const tree = cachedPack(first)!;
    expect(tree["README.md"]).toContain("Data only");
    expect(first.ref).toBe(git("rev-parse", "HEAD"));
    writeFileSync(join(remote, "README.md"), tree["README.md"] + "\nNew documentation.\n");
    git("add", "."); git("commit", "-qm", "pack v2");
    expect(cachedPack(first)).toEqual(tree);
    const second = fetchPack(remote, "HEAD", clock);
    if ("errors" in second) throw new Error(second.errors.join("\n"));
    expect(second.ref).not.toBe(first.ref);
    const hash = sha256(canonical(tree));
    const cache = join(area, "data/pregate/packs/objects", hash, "source.json");
    writeFileSync(cache, "{}");
    expect(cachedPack(first)).toBeNull();
    writeFileSync(cache, tree["source.json"]!);
    expect(cachedPack({ ...first, hash: "a".repeat(64) })).toBeNull();
    const binary = join(area, ENGINE_FILE);
    compileBinary(hostTarget(), binary, true);
    const root = join(area, "repo");
    mkdirSync(root);
    Bun.spawnSync(["git", "init", "-q", root]);
    const env = { ...process.env, HOME: join(area, "home"), CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok"), TMPDIR: area,
      XDG_STATE_HOME: join(area, "state"), CI: "1" };
    const cli = (...args: string[]) => {
      const child = spawnSync(binary, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], timeout: 10_000, maxBuffer: 16 * 1024 * 1024 });
      const stdout = child.stdout.toString(), stderr = child.stderr.toString();
      expect({ args, error: child.error, signal: child.signal, stdout, stderr }).toEqual({ args, error: undefined, signal: null, stdout, stderr });
      return { exitCode: child.status, stdout, stderr };
    };
    expect((await cli("init", "--yes", "--preset", "integrity-only")).exitCode).toBe(0);
    expect((await cli("pack", "add", `${remote}@${first.ref}`)).exitCode).toBe(1);
    expect(JSON.parse(readFileSync(join(root, ".pregate/preset.json"), "utf8")).sources).toHaveLength(1);
    expect((await cli("pack", "add", `${remote}@${first.ref}`, "--yes")).exitCode).toBe(0);
    const locked = () => JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8"));
    expect(locked().gitSources[0].ref).toBe(first.ref);
    expect(locked().gitSources[0].hash).toBe(hash);
    expect((await cli("rules", "test")).exitCode).toBe(0);
    expect((await cli("pack", "update", "acme", "--yes")).exitCode).toBe(0);
    expect(locked().gitSources[0].ref).toBe(second.ref);
    expect((await cli("pack", "init", "local")).exitCode).toBe(0);
    expect((await cli("rules", "test", ".pregate/packs/local")).exitCode).toBe(0);
    expect((await cli("pack", "init", "local")).exitCode).toBe(1);
    expect((await cli("pack", "enable", "acme/team", "--yes")).exitCode).toBe(0);
    const local = join(root, ".pregate/packs/local/methodologies/team.json");
    const manifest = JSON.parse(readFileSync(local, "utf8"));
    manifest.invariants.push({ ...manifest.invariants[0], id: "TEAM-OTHER-002", severity: "warn" });
    writeFileSync(local, JSON.stringify(manifest));
    const before = readFileSync(join(root, ".pregate/preset.json"), "utf8");
    const oldLock = readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8");
    const inspected = await cli("pack", "show", "--path", ".pregate/packs/local", "--json");
    expect(inspected.exitCode).toBe(0);
    expect(JSON.parse(inspected.stdout).packs[0].methodologies[0].invariants).toHaveLength(2);
    const preview = await cli("pack", "add", "--path", ".pregate/packs/local", "--preview");
    expect(preview.exitCode).toBe(0);
    expect(readFileSync(join(root, ".pregate/preset.json"), "utf8")).toBe(before);
    expect(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")).toBe(oldLock);
    const digest = preview.stdout.match(/Digest: ([0-9a-f]{64})/)![1]!;
    expect(preview.stdout).toContain(`pregate approve ${digest.slice(0, 12)}`);
    expect((await cli("approve", "--yes", "--digest", "0".repeat(64))).exitCode).toBe(1);
    expect((await cli("approve", "--yes", "--digest", digest)).exitCode).toBe(0);
    const listed = await cli("pack", "list", "--json");
    expect(listed.exitCode).toBe(0);
    expect(JSON.parse(listed.stdout).packs.find((p: { ns: string }) => p.ns === "local").methodologies[0].selected).toBe(false);
    expect((await cli("pack", "enable", "local/team", "--preview")).stdout).toContain("conflict");
    expect((await cli("pack", "enable", "local/team", "--only", "unknown", "--preview")).exitCode).toBe(1);
    const selection = await cli("pack", "enable", "local/team", "--only", "TEAM-PARAMS-001", "--preview");
    expect(selection.exitCode).toBe(0);
    const selectedDigest = selection.stdout.match(/Digest: ([0-9a-f]{64})/)![1]!;
    manifest.invariants[0].why += " Changed after preview.";
    writeFileSync(local, JSON.stringify(manifest));
    expect((await cli("approve", "--yes", "--digest", selectedDigest)).exitCode).toBe(1);
    expect(locked().rules.some((r: { id: string }) => r.id.startsWith("local/"))).toBe(false);
    expect((await cli("pack", "enable", "local/team", "--only", "local/TEAM-PARAMS-001", "--yes")).exitCode).toBe(0);
    expect(locked().rules.filter((r: { id: string }) => r.id.startsWith("local/")).map((r: { id: string }) => r.id)).toEqual(["local/TEAM-PARAMS-001"]);
    expect((await cli("pack", "disable", "local/team", "--yes")).exitCode).toBe(0);
    expect(locked().rules.some((r: { id: string }) => r.id.startsWith("local/"))).toBe(false);
    expect((await cli("pack", "enable", "local/team", "--only", "TEAM-OTHER-002", "--yes")).exitCode).toBe(0);
    expect(locked().rules.find((r: { id: string }) => r.id.startsWith("local/")).severity).toBe("warn");
    expect((await cli("pack", "remove", "local", "--yes")).exitCode).toBe(0);
    expect(locked().rules.some((r: { id: string }) => r.id.startsWith("acme/"))).toBe(true);
    expect(locked().rules.some((r: { id: string }) => r.id.startsWith("local/"))).toBe(false);
    expect(JSON.parse(readFileSync(join(root, ".pregate/preset.json"), "utf8")).sources.map((s: { ns: string }) => s.ns)).toEqual(["core", "acme"]);
    expect(readFileSync(local, "utf8")).toContain("TEAM-OTHER-002"); // removing the source preserves authored files
    expect((await cli("pack", "disable", "core/pregate-integrity", "--yes")).exitCode).toBe(0);
    expect(locked().rules.some((r: { id: string }) => r.id === "core/EVA-SUP-001")).toBe(false);
    for (const args of [["remove", "core", "--yes"], ["list", "--yes"],
      ["add", "--path", ".", "--path", "."], ["enable", "acme/team", "--preview", "--yes"], ["show", "--path"]]) {
      expect((await cli("pack", ...args)).exitCode).toBe(1);
    }
  });
}, 60_000);

async function restoredAfter(area: string, saved: string | undefined, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } finally {
    if (saved === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = saved;
    // All synchronous children have exited. Retry transient Windows EBUSY/EPERM,
    // but retain the cleanup failure if the directory remains busy.
    rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test("pack discovery rejects malformed definitions instead of listing unenforceable guidance", () => {
  const files = packTemplate("acme");
  expect(packCatalog(files)).toHaveProperty("ns", "acme");
  files["checks/complexity/fn-max-params/check.json"] = "{}";
  expect(packCatalog(files)).toHaveProperty("errors");
});
