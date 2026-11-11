import { isAbsolute, join, relative, win32 } from "node:path";
import type { Lock, LockRule } from "./types.ts";

// A26: the only path comparison in the engine. Bun.Glob is case-sensitive, so glob and path are
// both lowered: the same verdict on a case-insensitive APFS and on a case-sensitive CI runner.
export function slash(path: string): string {
  const plain = path.replace(/^\\\\\?\\UNC\\/i, "//").replace(/^\\\\\?\\/, "").replaceAll("\\", "/");
  return /^[a-z]:\//i.test(plain) || plain.startsWith("//") ? win32.normalize(plain).replaceAll("\\", "/") : plain;
}

export function pathKey(path: string): string {
  const plain = slash(path);
  return (/^[a-z]:\//i.test(plain) || plain.startsWith("//") ? plain.replace(/[ .]+(?=\/|$)/g, "") : plain).toLowerCase();
}

export function relativePath(from: string, to: string): string {
  return slash(relative(from, to));
}

export function absolutePath(path: string): boolean {
  return isAbsolute(path) || win32.isAbsolute(path);
}

const GLOBS = new Map<string, Bun.Glob>();

function compiledGlob(glob: string): Bun.Glob {
  const key = glob.toLowerCase();
  let compiled = GLOBS.get(key);
  if (!compiled) {
    compiled = new Bun.Glob(key);
    GLOBS.set(key, compiled);
  }
  return compiled;
}

// A path written out literally also matches itself: Bun.Glob reads `[view]` and `{a,b}` as glob
// syntax, so a Next.js segment like `[[...rest]]` would otherwise never match its own file (#66).
// The fallback only adds matches; `protects` keeps exact Bun.Glob semantics (its globs are escaped).
// It compares the raw glob, not `pathKey(glob)`: a `\` stays an escape and `..` stays unresolved.
export function matches(glob: string, rel: string): boolean {
  const key = pathKey(rel);
  return compiledGlob(glob).match(key) || glob.toLowerCase() === key;
}

// Agent-writable despite `**/.pregate/**`, but only through the edit tools and only when the file
// validates against request.v1: the gate checks this glob (relative to the root) before `protects`.
export const REQUESTS = ".pregate/requests/*.json";

// Absolute paths become literal glob prefixes, so their own metacharacters must not match.
function literal(path: string): string {
  return pathKey(path).replace(/[*?[\]{}\\]/g, "\\$&");
}

// `X/**` does not match X itself, and replacing or deleting X replaces everything under it.
function tree(glob: string): string[] {
  return [glob, `${glob}/**`];
}

// The hook registrations and configs of the six harnesses, in any folder (MH-30): the user's and
// a project's own. Each can switch off or bypass the gate.
const AGENTS = "{.agents,.agent,_agents,_agent}";
const HARNESS_FILES = [
  "**/.claude/settings*.json", "**/.codex/hooks.json", "**/.codex/config.toml", "**/.cursor/hooks.json",
  "**/.cursor/cli-config.json", "**/.grok/config.toml", `**/${AGENTS}/{hooks,plugins}.json`,
  "**/opencode.json", "**/opencode.jsonc",
];
const HARNESS_TREES = ["**/.cursor/managed", "**/.grok/hooks", `**/${AGENTS}/plugins`, "**/.opencode/plugins"];

// Only fixed configuration files are inspection inputs; never a harness directory or wildcard.
export function harnessConfigFiles(home: string, env: { codexHome: string; grokHome: string; opencodeHome: string; claudeConfig: string | null }, root: string | null): string[] {
  const claude = [join(home, ".claude"), ...(env.claudeConfig === null ? [] : [env.claudeConfig])];
  const global = [
    ...claude.flatMap(dir => ["settings.json", "settings.local.json"].map(file => join(dir, file))),
    ...["hooks.json", "config.toml", "requirements.toml"].map(file => join(env.codexHome, file)),
    ...["config.toml", "hooks-paths", "managed_config.toml", "requirements.toml"].map(file => join(env.grokHome, file)),
    ...["hooks.json", "cli-config.json"].map(file => join(home, ".cursor", file)),
    ...["hooks.json", "config.json"].map(file => join(home, ".gemini/config", file)),
    ...["settings.json", "antigravity-cli/settings.json", "antigravity/settings.json"].map(file => join(home, ".gemini", file)),
    ...["opencode.json", "opencode.jsonc"].map(file => join(env.opencodeHome, file)),
    ...[".agents", ".agent", "_agents", "_agent"].flatMap(dir => ["hooks.json", "plugins.json"].map(file => join(home, dir, file))),
  ];
  const local = root === null ? [] : [
    ".claude/settings.json", ".claude/settings.local.json", ".codex/hooks.json", ".codex/config.toml",
    ".cursor/hooks.json", ".cursor/cli-config.json", ".grok/config.toml",
    "opencode.json", "opencode.jsonc", ".opencode/plugins",
    ...[".agents", ".agent", "_agents", "_agent"].flatMap(dir => ["hooks.json", "plugins.json"].map(file => `${dir}/${file}`)),
  ].map(file => join(root, file));
  return [...new Set([...global, ...local])];
}

// The folder and file names the globs above and machineGlobs protect: a glob in a command that can
// expand to one of them is read as naming it (shell.ts). `_agents` and `_agent` are left out: a bare
// `*` would reach them, and `ls src/*/*` would deny. `opencode.json(c)` is left out for the same
// reason: OpenCode's config is a bare name at a project root, so a bare `*` in any folder would match
// it and `ls src/*` would deny. A literal path is still denied by the glob in HARNESS_FILES.
export const PROTECTED_NAMES = [
  ".pregate", ".git", ".claude", ".codex", ".cursor", ".grok", ".gemini", ".agents", ".agent", ".local", ".opencode",
  "pregate", "settings.json", "settings.local.json", "hooks.json", "plugins.json", "config.toml", "config.json",
  "cli-config.json", "requirements.toml", "managed_config.toml", "hooks-paths", "hooks", "plugins", "managed", "config",
];

// §4.1 step 5: fixed protections apply with or without a lock. `root` resolves the `path` sources,
// which may live outside .pregate/. All inputs are canonical absolute paths (disk.canonical).
export function protectedGlobs(root: string | null, sourceDirs: string[], dirs: { home: string; data: string; engine: string }): string[] {
  const sources = root === null ? [] : sourceDirs.map((dir) => literal(slash(absolutePath(dir) ? dir : join(root, dir)).replace(/\/+$/, "")));
  // A command names the default data folders through `~` or `$HOME`, which the shell guard cannot
  // expand: their path below home matches at any depth, as `.claude/settings*.json` does.
  const home = slash(dirs.home);
  const belowHome = [dirs.data, dirs.engine].map(slash).filter((dir) => pathKey(dir).startsWith(`${pathKey(home)}/`)).map((dir) => `**/${literal(dir.slice(home.length + 1))}`);
  return [
    ...tree("**/.pregate"),
    ...tree("**/.git"),
    ...HARNESS_FILES,
    ...HARNESS_TREES.flatMap(tree),
    ...[dirs.data, dirs.engine].map(literal).flatMap(tree),
    ...belowHome.flatMap(tree),
    ...sources.flatMap(tree),
  ];
}

// A protected folder: `spelled` is how a command names it without knowing home or the variable's
// value, which is how the shell guard reads `~/.codex`, `$HOME/.codex` and `$CODEX_HOME` alike.
interface Spot { dir: string; spelled: string; files: string[]; trees: string[] }

// Where this machine keeps the harness homes and PREGATE's own data and state.
interface MachineDirs { codexHome: string; grokHome: string; opencodeHome: string; claudeConfig: string | null; data: string; state: string }

// MH-17: the machine's own protections, with or without a root: the harness registrations, the
// PREGATE installation and `**/.pregate/**` (the agent does not create roots, A20). Each holds under
// its realpath too (`real`): with dotfiles in symlinks, the gate sees the canonical target. Only
// the user's files: a project's `.claude/settings.json` needs a root (protectedGlobs).
export function machineGlobs(home: string, env: MachineDirs, real: (p: string) => string): string[] {
  const settings = ["settings.json", "settings.local.json"];
  const spots: Spot[] = [
    { dir: join(home, ".claude"), spelled: "~/.claude", files: settings, trees: ["skills/pregate"] },
    ...(env.claudeConfig === null ? [] : [{ dir: env.claudeConfig, spelled: "~/.claude", files: settings, trees: [] }]),
    { dir: env.codexHome, spelled: "~/.codex", files: ["hooks.json", "config.toml", "requirements.toml"], trees: ["skills/pregate"] },
    { dir: env.grokHome, spelled: "~/.grok", files: ["config.toml", "hooks-paths", "managed_config.toml", "requirements.toml"], trees: ["hooks", "skills/pregate"] },
    { dir: join(home, ".agents"), spelled: "~/.agents", files: ["hooks.json", "plugins.json"], trees: ["skills/pregate", "plugins"] },
    ...[".gemini/antigravity-cli", ".gemini/antigravity"].map((d) => ({ dir: join(home, d), spelled: `~/${d}`, files: ["settings.json"], trees: ["skills/pregate"] })),
    { dir: join(home, ".gemini"), spelled: "~/.gemini", files: ["settings.json"], trees: [] },
    { dir: join(home, ".cursor"), spelled: "~/.cursor", files: ["hooks.json", "cli-config.json"], trees: ["skills/pregate", "managed"] },
    { dir: join(home, ".gemini/config"), spelled: "~/.gemini/config", files: ["hooks.json", "config.json"], trees: ["plugins/pregate", "plugins/pregate-global"] },
    // The plugin folder and the config that lists it: either can switch the gate off.
    { dir: env.opencodeHome, spelled: "~/.config/opencode", files: ["opencode.json", "opencode.jsonc"], trees: ["pregate", "plugins"] },
    { dir: env.data, spelled: "~/.local/share/pregate", files: [], trees: [""] },
    { dir: env.state, spelled: "~/.local/state/pregate", files: [], trees: [""] },
    { dir: join(home, ".local/bin"), spelled: "~/.local/bin", files: ["pregate", "pregate.cmd", "pregate.exe"], trees: [] },
    { dir: join(home, "AppData/Local/pregate"), spelled: "%LOCALAPPDATA%/pregate", files: [], trees: [""] },
    { dir: join(home, "AppData/Local/State/pregate"), spelled: "%LOCALAPPDATA%/State/pregate", files: [], trees: [""] },
  ];
  const tilde = (dir: string): string[] => (pathKey(dir).startsWith(`${pathKey(home)}/`) ? [`~/${slash(dir).slice(slash(home).length + 1)}`] : []);
  const globs = spots.flatMap(({ dir, spelled, files, trees }) => {
    const folders = [...new Set([...[dir, real(dir)].map(literal), ...[spelled, ...tilde(dir)].map((s) => `**/${literal(s)}`)])];
    return [
      ...folders.flatMap((d) => [...files.map((f) => `${d}/${f}`), ...trees.flatMap((t) => tree(t === "" ? d : `${d}/${t}`))]),
      // A file or folder that is itself a symlink resolves elsewhere than its parent does.
      ...files.map((f) => literal(real(join(dir, f)))),
      ...trees.filter((t) => t !== "").flatMap((t) => tree(literal(real(join(dir, t))))),
    ];
  });
  return [...new Set([...tree("**/.pregate"), ...globs])];
}

export function protects(abs: string, globs: string[]): boolean {
  const path = pathKey(abs);
  return globs.some((glob) => compiledGlob(glob).match(path));
}

export function inScope(lock: Lock | null, rel: string): boolean {
  if (lock === null) return true;
  return lock.scope.include.some((glob) => matches(glob, rel)) && !lock.scope.exclude.some((glob) => matches(glob, rel));
}

// Optional ownership scopes narrow existing rule paths; they never replace a pack's file restriction.
export function ruleApplies(rule: Pick<LockRule, "params">, rel: string): boolean {
  const paths = rule.params.paths as string[];
  const exclude = rule.params.exclude as string[];
  const within = rule.params.within as string[] | undefined;
  return paths.some(glob => matches(glob, rel)) && !exclude.some(glob => matches(glob, rel))
    && (within === undefined || within.some(glob => matches(glob, rel)));
}

// A directory written whole (`git checkout -- .`, `cp -r x .`) writes whatever lies below it: true
// when an in-scope path can be `rel`, lie below it, or lie below a folder of `rel` that an include
// glob reaches through a wildcard. "" is the root. Excludes are ignored: the answer may only err
// towards true.
export function scopeUnder(lock: Lock | null, rel: string): boolean {
  if (lock === null || inScope(lock, rel)) return true;
  const dir = rel.toLowerCase();
  return lock.scope.include.some((glob) => {
    const segments = glob.toLowerCase().split("/");
    const wild = segments.findIndex((s) => /[*?[{]/.test(s));
    const prefix = segments.slice(0, wild < 0 ? segments.length : wild).join("/");
    return dir === "" || prefix === "" || prefix === dir || prefix.startsWith(`${dir}/`) || (wild >= 0 && dir.startsWith(`${prefix}/`));
  });
}

// The most specific glob wins: the one with more literal characters. A tie keeps the layer
// declared first, because only a strictly higher score replaces the current best.
export function layerOf(lock: Lock, rel: string): string | null {
  let best: string | null = null;
  let score = -1;
  for (const [name, layer] of Object.entries(lock.layers)) {
    for (const glob of layer.paths) {
      const literals = glob.replace(/[*?]/g, "").length;
      if (literals > score && matches(glob, rel)) {
        best = name;
        score = literals;
      }
    }
  }
  return best;
}
