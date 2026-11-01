import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { WINDOWS } from "../src/platform.ts";
import { prepareSigner } from "./signing-tool.ts";

// The composite action's installer (scripts/action-install.sh) must refuse a tampered archive
// before it copies a binary onto PATH. The local server stands in for the GitHub release.

if (!WINDOWS) describe("GitHub Action install script", () => {
  setDefaultTimeout(60_000);
  const root = mkdtempSync(join(tmpdir(), "pregate-action-"));
  const tools = join(root, "tools");
  const script = join(import.meta.dir, "../scripts/action-install.sh");
  const servers: Array<{ stop: () => void }> = [];
  mkdirSync(tools);
  for (const name of ["bash", "curl", "tar", "gzip", "sha256sum", "shasum", "awk", "grep", "uname", "install", "mkdir", "mktemp", "rm", "cp"]) {
    const at = Bun.which(name);
    if (at) symlinkSync(at, join(tools, name));
  }

  afterEach(() => {
    for (const server of servers.splice(0)) server.stop();
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

  function gh(body: string): string {
    const dir = mkdtempSync(join(root, "gh-"));
    writeFileSync(join(dir, "gh"), `#!/bin/sh\n${body}\n`);
    chmodSync(join(dir, "gh"), 0o755);
    return dir;
  }

  async function run(base: string, extra: Record<string, string> = {}, pathPrefix = ""): Promise<{ code: number; text: string; home: string }> {
    const home = mkdtempSync(join(root, "home-"));
    mkdirSync(join(home, "tmp"));
    // Async so the in-process release server can answer while curl runs.
    const proc = Bun.spawn(["bash", script], {
      env: {
        PATH: pathPrefix ? `${pathPrefix}:${tools}` : tools,
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

  test("a matching checksum installs the archive binary", async () => {
    const dir = mkdtempSync(join(root, "good-"));
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const file = archive(dir, name);
    writeFileSync(join(dir, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    const installed = await run(serve(dir));
    expect(installed.code, installed.text).toBe(0);
    const binary = join(installed.home, ".local/bin/pregate");
    expect(existsSync(binary)).toBe(true);
    const ran = Bun.spawnSync([binary], { stdout: "pipe", stderr: "pipe" });
    expect(ran.stdout.toString()).toBe("pregate-ok\n");
  });

  test("a tampered archive fails closed and installs nothing", async () => {
    const dir = mkdtempSync(join(root, "tampered-"));
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const file = archive(dir, name);
    const original = createHash("sha256").update(readFileSync(file)).digest("hex");
    const bytes = readFileSync(file);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    writeFileSync(file, bytes);
    writeFileSync(join(dir, "SHA256SUMS"), `${original}  ${name}\n`);
    const installed = await run(serve(dir));
    expect(installed.code).not.toBe(0);
    expect(installed.text).toContain("SHA-256 mismatch");
    expect(installed.text).toContain("nothing installed");
    expect(existsSync(join(installed.home, ".local/bin/pregate"))).toBe(false);
  });

  test("a missing checksum manifest fails closed", async () => {
    const dir = mkdtempSync(join(root, "nosums-"));
    archive(dir, `pregate-${pkg.version}-${target()}.tar.gz`);
    const installed = await run(serve(dir));
    expect(installed.code).not.toBe(0);
    expect(installed.text).toContain("no SHA256SUMS");
    expect(existsSync(join(installed.home, ".local/bin/pregate"))).toBe(false);
  });

  // The action verifies Sigstore bundles. The default suite uses the offline cosign shim at
  // test/shims/cosign (a fixed path, no network). Real cosign runs in test/signing.e2e.test.ts.
  const signer = prepareSigner(join(root, "signer"));

  test("without cosign a required signature fails closed; an optional one prints a notice", async () => {
    const dir = mkdtempSync(join(root, "no-cosign-"));
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const file = archive(dir, name);
    writeFileSync(join(dir, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    const required = await run(serve(dir), { PREGATE_REQUIRE_SIGNATURE: "1" });
    expect(required.code).not.toBe(0);
    expect(required.text).toContain("cosign is required");
    expect(required.text).toContain("nothing installed");
    expect(existsSync(join(required.home, ".local/bin/pregate"))).toBe(false);

    const optional = await run(serve(dir), { PREGATE_REQUIRE_SIGNATURE: "" });
    expect(optional.code, optional.text).toBe(0);
    expect(optional.text).toContain("cosign is not installed");
    expect(existsSync(join(optional.home, ".local/bin/pregate"))).toBe(true);
  });

  test("with cosign a release without bundles fails closed when the signature is required", async () => {
    const dir = mkdtempSync(join(root, "no-bundle-"));
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const file = archive(dir, name);
    writeFileSync(join(dir, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    const required = await run(serve(dir), { PREGATE_REQUIRE_SIGNATURE: "1" }, signer.binDir);
    expect(required.code).not.toBe(0);
    expect(required.text).toContain("release has no SHA256SUMS.bundle");
    expect(existsSync(join(required.home, ".local/bin/pregate"))).toBe(false);

    const optional = await run(serve(dir), { PREGATE_REQUIRE_SIGNATURE: "" }, signer.binDir);
    expect(optional.code, optional.text).toBe(0);
    expect(optional.text).toContain("release has no SHA256SUMS.bundle");
    expect(existsSync(join(optional.home, ".local/bin/pregate"))).toBe(true);
  });

  test("with cosign a signed release installs when the signature is required", async () => {
    const dir = mkdtempSync(join(root, "signed-"));
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const file = archive(dir, name);
    writeFileSync(join(dir, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    signer.sign(file);
    signer.sign(join(dir, "SHA256SUMS"));
    const installed = await run(serve(dir), { PREGATE_REQUIRE_SIGNATURE: "1", ...signer.installEnv(file) }, signer.binDir);
    expect(installed.code, installed.text).toBe(0);
    expect(existsSync(join(installed.home, ".local/bin/pregate"))).toBe(true);
  });

  test("a checksum-valid archive with a bad cosign bundle fails closed", async () => {
    const dir = mkdtempSync(join(root, "bad-sig-"));
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const file = archive(dir, name);
    signer.sign(file);
    const bytes = readFileSync(file);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    writeFileSync(file, bytes);
    writeFileSync(join(dir, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    // SHA256SUMS is signed correctly: only the archive bundle can fail.
    signer.sign(join(dir, "SHA256SUMS"));
    const installed = await run(serve(dir), signer.installEnv(file), signer.binDir);
    expect(installed.code).not.toBe(0);
    expect(installed.text).toContain("cosign signature mismatch");
    expect(existsSync(join(installed.home, ".local/bin/pregate"))).toBe(false);
  });

  test("an attestation mismatch fails closed and a missing attestation does not", async () => {
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const good = mkdtempSync(join(root, "attest-ok-"));
    const file = archive(good, name);
    writeFileSync(join(good, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    const absent = await run(serve(good), { GH_TOKEN: "t" }, gh("echo 'Error: HTTP 404: Not Found' >&2\nexit 1"));
    expect(absent.code, absent.text).toBe(0);
    expect(absent.text).toContain("no artifact attestation found");
    expect(existsSync(join(absent.home, ".local/bin/pregate"))).toBe(true);

    const bad = mkdtempSync(join(root, "attest-bad-"));
    const again = archive(bad, name);
    writeFileSync(join(bad, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(again)).digest("hex")}  ${name}\n`);
    const rejected = await run(serve(bad), { GH_TOKEN: "t" }, gh("echo 'verification failed: certificate identity mismatch' >&2\nexit 1"));
    expect(rejected.code).not.toBe(0);
    expect(rejected.text).toContain("artifact attestation mismatch");
    expect(existsSync(join(rejected.home, ".local/bin/pregate"))).toBe(false);
  });

  // gh on a hosted runner without GH_TOKEN prints this and exits 4. That is "attestation
  // unavailable", not a mismatch; the action passes github.token so it does not happen there.
  test("gh without a token is attestation-unavailable, not a mismatch", async () => {
    const name = `pregate-${pkg.version}-${target()}.tar.gz`;
    const noToken = "echo 'To get started with GitHub CLI, please run:  gh auth login' >&2\necho 'Alternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.' >&2\nexit 4";
    const dir = mkdtempSync(join(root, "attest-notoken-"));
    const file = archive(dir, name);
    writeFileSync(join(dir, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${name}\n`);
    const unset = await run(serve(dir), {}, gh(noToken));
    expect(unset.code, unset.text).toBe(0);
    expect(unset.text).toContain("GH_TOKEN is not set");
    expect(existsSync(join(unset.home, ".local/bin/pregate"))).toBe(true);

    // A token that gh still rejects as absent (e.g. an empty secret): the message decides.
    const other = mkdtempSync(join(root, "attest-badtoken-"));
    const again = archive(other, name);
    writeFileSync(join(other, "SHA256SUMS"), `${createHash("sha256").update(readFileSync(again)).digest("hex")}  ${name}\n`);
    const tokened = await run(serve(other), { GH_TOKEN: "t" }, gh(noToken));
    expect(tokened.code, tokened.text).toBe(0);
    expect(tokened.text).toContain("gh has no usable token");
    expect(existsSync(join(tokened.home, ".local/bin/pregate"))).toBe(true);
  });
});
