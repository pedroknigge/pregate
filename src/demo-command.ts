import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DEMO_LANGUAGES, demoSample, type DemoLanguage } from "./demo-samples.ts";
import { demoCase, type DemoContext, type DemoReceipt } from "./demo-run.ts";
import { removeReleased } from "./disk.ts";
import { sha256 } from "./state.ts";
import { VERSIONS } from "./versions.ts";

const USAGE = "usage: pregate demo [--language python|go|rust|all] [--json]";
interface DemoReport {
  schemaVersion: number; mode: string; engine: typeof VERSIONS; cleanup: boolean;
  binarySha256?: string; samples?: ReturnType<typeof demoCase>[]; limits?: string[]; error?: string;
  attempts?: { language: DemoLanguage; receipts: DemoReceipt[] }[];
}
type DemoRun = Pick<DemoContext, "area" | "binary" | "git" | "native"> & { languages: DemoLanguage[]; attempts: NonNullable<DemoReport["attempts"]> };

// Only generated samples receive automated consent. No inherited environment or project path
// reaches setup/approval. The installed launcher runs the actual pre-write hook protocol.
export async function demo(args: string[], executable = process.execPath): Promise<{ code: number; text: string }> {
  const options = demoOptions(args);
  if (options === null) return { code: 1, text: USAGE };
  const binary = resolve(executable), git = Bun.which("git");
  if (git === null || !existsSync(binary)) return { code: 1, text: "Demo requires Git and a compiled PREGATE binary. Build the binary, then run pregate demo." };
  const native = { python: nativeTool("python3"), go: nativeTool("go"), rust: nativeTool("rustc") };
  const area = mkdtempSync(join(tmpdir(), "pregate-owned-demo-"));
  const result = demoRun({ languages: options.languages, area, binary, git, native, attempts: [] });
  return { code: result.code, text: options.json ? JSON.stringify(result.report, null, 2) : demoText(result.report) };
}

function demoRun(run: DemoRun): { code: number; report: DemoReport } {
  try {
    mkdirSync(join(run.area, "empty-template"));
    const samples = run.languages.map(language => {
      const root = join(run.area, language), machine = join(run.area, language + "-machine");
      // An empty Claude home is a detected harness, so isolated setup can wire it and exit 0.
      // The demo machine has no host CLIs; with no home at all, setup exits 1 before the sample hook runs.
      mkdirSync(root); mkdirSync(join(machine, "home", ".claude"), { recursive: true });
      const env = demoEnvironment(machine, run.git);
      const launcher = join(env.XDG_DATA_HOME!, "pregate/bin", process.platform === "win32" ? "pregate.cmd" : "pregate");
      const c: DemoContext = { area: run.area, root, env, binary: run.binary, launcher, git: run.git, native: run.native, receipts: [] };
      run.attempts.push({ language, receipts: c.receipts });
      return demoCase(c, demoSample(language));
    });
    return { code: 0, report: { schemaVersion: 1, mode: "isolated-owned-sample-automation", engine: VERSIONS,
      binarySha256: sha256(readFileSync(run.binary)), samples, cleanup: true, limits: [
        "Automated approval is limited to generated toy repositories; this does not test human approval or a live model UI.",
        "Static architecture checks do not certify the unverified core fitness requirements.",
        "Native tooling is reported only when actually available and executed; no tools or dependencies are downloaded.",
      ] } };
  } catch (e) {
    return { code: 1, report: { schemaVersion: 1, mode: "isolated-owned-sample-automation", engine: VERSIONS,
      cleanup: true, attempts: run.attempts, error: String((e as Error).message).replaceAll(run.area, "<owned-demo>") } };
  } finally {
    // A just-compiled Go test binary can stay locked by an on-access scanner longer than the
    // usual rename wait. The directory still has to disappear; only the wait is longer on Windows.
    removeReleased(run.area, process.platform === "win32" ? 60_000 : 15_000);
  }
}

function demoOptions(args: string[]): { languages: DemoLanguage[]; json: boolean } | null {
  let language = "all", selected = false, json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json" && !json) json = true;
    else if (args[i] === "--language" && !selected) { language = args[++i] ?? ""; selected = true; }
    else return null;
  }
  if (language !== "all" && !DEMO_LANGUAGES.includes(language as DemoLanguage)) return null;
  return { languages: language === "all" ? [...DEMO_LANGUAGES] : [language as DemoLanguage], json };
}

function demoEnvironment(machine: string, git: string): Record<string, string> {
  const home = join(machine, "home"), system: Record<string, string> = process.platform === "win32" ? {
    SystemRoot: process.env.SystemRoot ?? "C:\\Windows", WINDIR: process.env.WINDIR ?? "C:\\Windows",
    COMSPEC: process.env.COMSPEC ?? "C:\\Windows\\System32\\cmd.exe", PATHEXT: ".COM;.EXE;.BAT;.CMD",
  } : {};
  return { ...system, PATH: [dirname(git), ...(process.platform === "win32" ? [join(system.SystemRoot!, "System32"), join(system.SystemRoot!, "System32/WindowsPowerShell/v1.0")] : ["/usr/bin", "/bin", "/usr/sbin", "/sbin"])].join(process.platform === "win32" ? ";" : ":"),
    HOME: home, USERPROFILE: home, LOCALAPPDATA: join(machine, "local"), XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"),
    CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"), CLAUDE_CONFIG_DIR: join(machine, "claude"),
    TMPDIR: machine, TMP: machine, TEMP: machine, CGO_ENABLED: "0",
    // Owned samples only. This lets the throwaway directory print its digest and apply
    // `approve --yes`. It is not a switch a script may set to consent a consumer project.
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", LANG: "C.UTF-8", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(machine, "gitconfig"),
    GIT_CONFIG_SYSTEM: process.platform === "win32" ? "NUL" : "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_TEMPLATE_DIR: join(machine, "template"), PYTHONDONTWRITEBYTECODE: "1", PYTHONPATH: "src",
    GOPROXY: "off", GOSUMDB: "off", GOTOOLCHAIN: "local", GOCACHE: join(machine, "go-cache"), GOPATH: join(machine, "go"),
    CARGO_HOME: join(machine, "cargo"), RUSTUP_HOME: join(machine, "rustup") };
}

function nativeTool(name: string): string | null {
  const path = Bun.which(name);
  if (path === null) return null;
  const binary = realpathSync(path);
  if (name !== "rustc") return binary;
  // A rustup proxy named rustc.exe still needs RUSTUP_HOME. The isolated demo points that
  // variable at an empty directory, so use an already installed compiler and never install one.
  const proxy = basename(binary).replace(/\.exe$/, "") === "rustup"
    || (process.platform === "win32" && existsSync(join(dirname(binary), "rustup.exe")));
  if (!proxy) return binary;
  const installed = join(process.env.RUSTUP_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".rustup"), "toolchains");
  if (!existsSync(installed)) return null;
  return readdirSync(installed).sort((a, b) => Number(b.startsWith("stable")) - Number(a.startsWith("stable")) || a.localeCompare(b))
    .map(toolchain => join(installed, toolchain, "bin", process.platform === "win32" ? "rustc.exe" : "rustc")).find(existsSync) ?? null;
}

function demoText(report: DemoReport): string {
  if (report.error) return `PREGATE demo failed: ${report.error}\nGenerated samples cleaned up.`;
  return ["PREGATE demo: isolated sample automation; your projects and global settings are unchanged.",
    ...(report.samples ?? []).flatMap(s => [
      `${s.language}: existing debt ${s.baseline.debt}; no-new accepts it. ${s.rule} rejects the new dependency before writing.`,
      `  Native behavior of rejected proposal (separate copy): ${s.native.proposedInSeparateCopy.status}. Architecture adds a separate constraint.`,
      "  Valid repair accepted; existing debt repaired; final static architecture findings: 0.",
      `  Core fitness obligations still UNVERIFIED: ${s.final.unverified}. Native checks: ${s.native.repaired.status}${"reason" in s.native.repaired ? ` (${s.native.repaired.reason})` : ""}.`,
    ]), "Generated samples, installation and consent cleaned up. Try pregate guide in your project to review its own rules."] .join("\n");
}
