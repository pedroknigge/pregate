import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";
import type { Lock } from "../src/types.ts";

// Release binary: a code on a pipe applies the contract, the explicit layer map and the
// compiled instruction rules together. A bare approve still refuses.
test("one terminal approval activates a new repo with layers and compiled project rules", async () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-single-pass-"));
  const previous = process.env.XDG_DATA_HOME;
  try {
    const root = join(area, "repo");
    const files: Record<string, string> = {
      "src/domain/order.ts": 'import { db } from "../infra/db";\nexport const order = db;\n',
      "src/infra/db.ts": "export const db = 1;\n",
      "src/services/checkout.ts": 'import { order } from "../domain/order";\nexport const checkout = order;\n',
      "AGENTS.md": ["# Rules", "", "- Domain must not import infra.", "- UI components must not call `fetch`.", "- Never use moment; use date-fns.", "- Do not import lodash.",
        "- Never use `any` in exported types.", ""].join("\n"),
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const map = { why: "services sit beside domain and infra; folder names do not name services.", layers: {
      domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
      infra: { paths: ["src/infra/**"], mayImport: ["domain"], kind: "adapter" },
      services: { paths: ["src/services/**"], mayImport: ["domain"], kind: "adapter" },
    } };
    writeFileSync(join(root, "layers.json"), JSON.stringify(map));
    writeFileSync(join(root, "proposals.json"), JSON.stringify({ file: "CLAUDE.md", rules: [{
      line: 12, sentence: "Never import the vendor sdk; call the ai client",
      fail: ['import Vendor from "@vendor/sdk";\nexport const client = new Vendor();'],
      pass: ['import { ask } from "./ai-client";\nexport const answer = ask;'],
    }] }));
    expect(Bun.spawnSync(["git", "init", "-q", root], { stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
    const git = (...args: string[]) => {
      const out = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
      expect(out.exitCode, out.stderr.toString()).toBe(0);
      return out.stdout.toString().trim();
    };
    git("config", "user.name", "t");
    git("config", "user.email", "t@example.com");
    git("config", "commit.gpgsign", "false");
    git("add", "-A");
    git("commit", "-qm", "base");
    const binary = join(area, ENGINE_FILE);
    engineAt(binary, false);
    const data = join(area, "data");
    const env: Record<string, string | undefined> = {
      ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"),
      TMPDIR: area, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
      GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
    };
    delete env.PREGATE_TESTING;
    delete env.PREGATE_TEST_ANSWER;
    const cli = (...args: string[]) => {
      const out = Bun.spawnSync([binary, ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000 });
      return { code: out.exitCode, text: out.stdout.toString() + out.stderr.toString() };
    };
    expect(cli("guide", "--json").code).toBe(0);
    const layers = cli("layers", "--json");
    expect(layers.code, layers.text).toBe(0);
    expect(JSON.parse(layers.text).source).toBe("derived from folder names");
    expect(JSON.parse(layers.text).layers.services).toBeUndefined();
    const template = JSON.parse(cli("compile", "AGENTS.md", "--template").text) as { rules: { statement: string }[] };
    expect(template.rules.map(rule => rule.statement)).toContain("Never use `any` in exported types.");
    const preview = cli("guide", "--preview", "--layers", "layers.json", "--compile", "proposals.json");
    expect(preview.code, preview.text).toBe(0);
    expect(preview.text.match(/Digest: [0-9a-f]{64}/g)).toHaveLength(1);
    expect(preview.text).toContain("Proposed layer map: services sit beside domain and infra; folder names do not name services.");
    const digest = preview.text.match(/Digest: ([0-9a-f]{64})/)![1]!;
    const code = digest.slice(0, 12);
    const human = { ...env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" };
    const bare = Bun.spawnSync([binary, "approve"], {
      cwd: root, env: human, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe", timeout: 30_000,
    });
    expect(bare.exitCode).toBe(1);
    expect(bare.stdout.toString()).toContain("no terminal");
    expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
    const piped = Bun.spawnSync([binary, "approve", code], {
      cwd: root, env: human, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe", timeout: 30_000,
    });
    expect(piped.exitCode, piped.stdout.toString() + piped.stderr.toString()).toBe(0);

    const lock = JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")) as Lock;
    expect(Object.keys(lock.layers).sort()).toEqual(["domain", "infra", "services"]);
    expect(lock.rules.map(rule => rule.id)).toEqual(expect.arrayContaining([
      "architecture/HEX-EDGE-001", "project/PROJECT-UI-COMPONENT-CALL-FETCH", "project/PROJECT-MOMENT",
      "project/PROJECT-IMPORT-LODASH", "project/PROJECT-IMPORT-VENDOR-SDK-CALL",
    ]));
    expect(existsSync(join(root, ".pregate/packs/project"))).toBe(true);
    const subjects = git("log", "--format=%s");
    expect(subjects.split("\n").filter(line => line.startsWith("chore: apply reviewed PREGATE contract"))).toHaveLength(1);
    const committed = git("show", "--name-only", "--format=", "HEAD");
    for (const path of [".pregate/preset.json", ".pregate/pregate.lock.json", ".pregate/packs/project"]) expect(committed).toContain(path);
    const status = cli("status");
    expect(status.text).toContain("Local consent is active");
    expect(status.text).not.toContain("pending review");
    expect(cli("approve", "--preview").text).toContain("No pending");

    const head = git("rev-parse", "HEAD");
    const again = cli("layers", "apply", "layers.json", "--preview");
    expect(again.code, again.text).toBe(0);
    const opened = { ...map, layers: { ...map.layers, services: { ...map.layers.services, mayImport: [] } } };
    writeFileSync(join(root, "layers.json"), JSON.stringify(opened));
    const changed = cli("layers", "apply", "layers.json", "--preview");
    expect(changed.code, changed.text).toBe(0);
    expect(changed.text).toContain("Digest:");
    writeFileSync(join(root, "more.json"), JSON.stringify({ file: "CLAUDE.md", rules: [{
      line: 20, sentence: "Never round money with Math.round by hand",
      fail: ["export const total = Math.round(amount * 100) / 100;"],
      pass: ["export const total = roundMoney(amount);", "export const pages = Math.round(count);"],
      pattern: { kind: "binary_expression", regex: "^Math\\.round\\(.*\\* 100\\) / 100$" },
    }] }));
    const compiled = cli("compile", "apply", "more.json", "--preview");
    expect(compiled.code, compiled.text).toBe(0);
    expect(compiled.text).toContain("Digest:");
    expect(git("rev-parse", "HEAD")).toBe(head);
  } finally {
    if (previous === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = previous;
    removeTree(area);
  }
}, 120_000);
