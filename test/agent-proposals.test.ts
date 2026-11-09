import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeReleased } from "./remove-tree.ts";

// The agent proposes, the engine reports evidence, the human approves one digest: a layer map
// (`layers`) and an instruction file's statements (`compile`).
setDefaultTimeout(60_000);

const area = mkdtempSync(join(tmpdir(), "pregate-proposals-"));
const binary = join(area, ENGINE_FILE);
beforeAll(() => compileBinary(hostTarget(), binary, true), 120_000);
afterAll(() => removeReleased(area), 20_000);

const SOURCES: Record<string, string> = {
  "package.json": '{"name":"shop","type":"module"}\n',
  "src/domain/order.ts": 'import { saveOrder } from "../infra/db.ts";\nexport const place = saveOrder;\n',
  "src/infra/db.ts": "export function saveOrder(): void {}\n",
  "src/services/checkout.ts": 'import { place } from "../domain/order.ts";\nexport const checkout = place;\n',
  "src/ui/cart.ts": 'import { checkout } from "../services/checkout.ts";\nimport { saveOrder } from "../infra/db.ts";\nexport const cart = [checkout, saveOrder];\n',
  "src/components/button.ts": "export const Button = () => 1;\n",
  "AGENTS.md": ["# Agent rules", "", "- Domain must not import infra.", "- UI components must not call `fetch`.", "- Never use moment; use date-fns.", "- Do not import lodash.",
    "- Never use `any` in exported types.", "- Write clear code and prefer small functions.", "- Always run the tests before you finish.", ""].join("\n"),
};

function repo(name: string, setup = true) {
  const root = join(area, name), machine = join(area, `${name}-machine`);
  for (const [rel, text] of Object.entries(SOURCES)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
  const env = { ...process.env, HOME: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"), XDG_DATA_HOME: join(machine, "data"),
    XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const run = (command: string[], input?: string) => {
    const result = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 30_000, ...(input === undefined ? {} : { stdin: Buffer.from(input) }) });
    return { code: result.exitCode, text: result.stdout.toString() + result.stderr.toString() };
  };
  const cli = (...args: string[]) => run([binary, ...args]);
  const git = (...args: string[]) => run(["git", ...args]).text.trim();
  git("init", "-q"); git("config", "user.name", "t"); git("config", "user.email", "t@example.com"); git("config", "commit.gpgsign", "false");
  if (setup) { expect(cli("init", "--yes", "--preset", "integrity-only").code).toBe(0); git("add", "-A"); git("commit", "-qm", "base"); }
  const approve = (review: string) => cli("approve", "--yes", "--digest", review.match(/Digest: ([0-9a-f]{64})/)![1]!);
  const lock = () => JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")) as { layers: Record<string, unknown>; rules: { id: string }[] };
  // The integrity-only recipe starts in shadow, where the agent format stays quiet; SARIF results list every finding.
  const check = (path: string, text: string): string[] => {
    const sarif = JSON.parse(run([binary, "check", "--stdin", "--path", path, "--format", "sarif"], text).text) as { runs: { results: { ruleId: string }[] }[] };
    return sarif.runs[0]!.results.map((result) => result.ruleId);
  };
  return { root, cli, approve, lock, check };
}

const MAP = { why: "ui calls services, services call the domain; only infra adapts storage.", layers: {
  domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" }, infra: { paths: ["src/infra/**"], mayImport: ["domain"], kind: "adapter" },
  services: { paths: ["src/services/**"], mayImport: ["domain"], kind: "adapter" }, ui: { paths: ["src/ui/**"], mayImport: ["services", "domain"], kind: "adapter" } } };

test("layers shows the derived map with its evidence, and an agent's map becomes one reviewed change that a layer rule reads", () => {
  const p = repo("layers");
  const shown = p.cli("layers");
  expect(shown.code, shown.text).toBe(0);
  expect(shown.text).toContain("Layers (derived from folder names): domain [src/domain/**] (core; imports no other layer); infra [src/infra/**] (adapter; may import domain).");
  expect(shown.text).toContain("Layer domain (1 file): 1 existing import of infra, which it may not import. Example: src/domain/order.ts imports src/infra/db.ts.");
  expect(shown.text).toContain("Not in any layer, so imports there are unrestricted: src/components (1 file); src/services (1 file; imports domain); src/ui (1 file; imports infra, src/services).");
  const json = JSON.parse(p.cli("layers", "--json").text);
  expect(json.source).toBe("derived from folder names");
  expect(json.evidence.unplaced.map((folder: { dir: string }) => folder.dir)).toEqual(["src/components", "src/services", "src/ui"]);

  writeFileSync(join(p.root, "layers.json"), JSON.stringify(MAP));
  expect(p.cli("layers", "apply", "layers.json")).toMatchObject({ code: 1, text: expect.stringContaining("layers apply only prepares a review") });
  const review = p.cli("layers", "apply", "layers.json", "--preview");
  expect(review.code, review.text).toBe(0);
  expect(review.text).toContain("Proposed layer map: ui calls services, services call the domain; only infra adapts storage.");
  expect(review.text).toContain("Added architecture/clean-architecture so a rule reads this map.");
  expect(review.text).toContain("Layer ui (1 file): 1 existing import of infra, which it may not import. Example: src/ui/cart.ts imports src/infra/db.ts.");
  expect(review.text).toContain("The 2 existing breaks stay as known debt under no-new.");
  expect(Object.keys(p.lock().layers)).toEqual([]);
  expect(p.approve(review.text).code).toBe(0);
  expect(Object.keys(p.lock().layers).sort()).toEqual(["domain", "infra", "services", "ui"]);
  expect(p.cli("layers").text).toContain("Layers (contract): domain");
  const broken = p.check("src/services/checkout.ts", 'import { saveOrder } from "../infra/db.ts";\nexport const checkout = saveOrder;\n');
  expect(broken).toContain("architecture/CA-DEP-001");
});

test("layers apply refuses a map whose shape or paths cannot be checked, and changes nothing", () => {
  const p = repo("layers-bad");
  const attempt = (value: unknown) => { writeFileSync(join(p.root, "layers.json"), typeof value === "string" ? value : JSON.stringify(value)); return p.cli("layers", "apply", "layers.json", "--preview"); };
  expect(attempt("{")).toMatchObject({ code: 1, text: expect.stringContaining("not JSON") });
  expect(attempt({ layers: MAP.layers })).toMatchObject({ code: 1, text: expect.stringContaining("needs a why") });
  expect(attempt({ why: "x", layers: { ui: { paths: ["src/ui/**"], mayImport: ["nowhere"], kind: "adapter" } } })).toMatchObject({ code: 1, text: expect.stringContaining("Layer ui needs mayImport") });
  expect(attempt({ why: "x", layers: { ui: { paths: ["src/ui/**"], mayImport: [], kind: "outer" } } })).toMatchObject({ code: 1, text: expect.stringContaining("Layer ui needs kind") });
  expect(attempt({ why: "x", layers: { domain: { paths: ["src/nope/**"], mayImport: [], kind: "core" } } })).toMatchObject({ code: 1, text: expect.stringContaining("Layer paths matching no file: domain (src/nope/**)") });
  expect(p.cli("approve", "--preview").text).not.toContain("Digest:");
  expect(repo("layers-new", false).cli("layers")).toMatchObject({ code: 1, text: expect.stringContaining("Set up PREGATE first") });
});

test("compile sorts an instruction file into rules, statements that need an example and guidance, then stages the rules as one review", () => {
  const p = repo("compile");
  const report = p.cli("compile", "AGENTS.md");
  expect(report.code, report.text).toBe(0);
  expect(report.text).toContain("Compile AGENTS.md: 7 statements.");
  expect(report.text).toContain('L3 "Domain must not import infra." -> bundled rule architecture/HEX-EDGE-001');
  expect(report.text).toContain('L4 "UI components must not call `fetch`." -> project rule: no call to fetch in **/components/**; cases generated');
  expect(report.text).toContain('L5 "Never use moment; use date-fns." -> project rule: no call to moment; cases generated');
  expect(report.text).toContain('L6 "Do not import lodash." -> project rule: no import of the package lodash; cases generated');
  expect(report.text).toContain('L7 "Never use `any` in exported types." -> pregate rules add "Never use any in exported types." --fail "<bad code>" --pass "<good code>"');
  expect(report.text).toContain('L9 "Always run the tests before you finish." -> guidance or an agent action');
  expect(report.text).toContain("4 of 7 statements run as rules. Once they are approved, lines 3, 4, 5, 6 can leave AGENTS.md");
  const json = JSON.parse(p.cli("compile", "AGENTS.md", "--json").text);
  expect(json.counts).toEqual({ statements: 7, rules: 4, needExample: 1, stay: 2 });
  expect(json.removableLines).toEqual([3, 4, 5, 6]);
  expect(json.tokens.compilable).toBeLessThan(json.tokens.file);

  const review = p.cli("compile", "AGENTS.md", "--preview");
  expect(review.code, review.text).toBe(0);
  expect(p.lock().rules.some((rule) => rule.id.startsWith("project/"))).toBe(false);
  expect(p.approve(review.text).code).toBe(0);
  const ids = p.lock().rules.map((rule) => rule.id);
  expect(ids).toEqual(expect.arrayContaining(["architecture/HEX-EDGE-001", "project/PROJECT-UI-COMPONENT-CALL-FETCH", "project/PROJECT-MOMENT", "project/PROJECT-IMPORT-LODASH"]));
  expect(p.cli("rules", "test", ".pregate/packs/project")).toMatchObject({ code: 0 });
  const found = p.check("src/services/dates.ts", 'import _ from "lodash";\nexport const noop = _.noop;\n');
  expect(found).toEqual(["project/PROJECT-IMPORT-LODASH"]);
  expect(p.check("src/services/dates.ts", 'export const name = "lodash";\n')).toEqual([]);

  const again = p.cli("compile", "AGENTS.md", "--preview");
  expect(again.text).toContain('L6 "Do not import lodash." -> already a project rule');
  expect(again.text).toContain('L3 "Domain must not import infra." -> already in the contract');
  expect(again.text).toContain("They are in the contract, so lines 3, 4, 5, 6 can leave AGENTS.md");
  expect(again.text).toContain("Nothing new to stage.");
  expect(readFileSync(join(p.root, "AGENTS.md"), "utf8")).toBe(SOURCES["AGENTS.md"]!);
});

test("compile reports without a contract and needs one only to stage", () => {
  const p = repo("compile-new", false);
  expect(p.cli("compile", "AGENTS.md")).toMatchObject({ code: 0, text: expect.stringContaining("4 of 7 statements run as rules.") });
  expect(p.cli("compile", "AGENTS.md", "--preview")).toMatchObject({ code: 1, text: expect.stringContaining("Set up PREGATE first") });
  expect(p.cli("compile", "MISSING.md")).toMatchObject({ code: 1, text: expect.stringContaining("No file MISSING.md") });
  expect(p.cli("compile")).toMatchObject({ code: 1, text: expect.stringContaining("usage: pregate compile") });
});
