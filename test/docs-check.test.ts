import { expect, test } from "bun:test";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import core from "../catalog/source.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };

const ROOT = join(import.meta.dir, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git" || name === "vendor") continue;
    const path = join(dir, name);
    const st = lstatSync(path);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(path, out);
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
}

function historical(rel: string): boolean {
  return rel === "CHANGELOG.md" || rel.startsWith("docs/releases/");
}

function outsideFences(text: string): string {
  return text.split(/(```[\s\S]*?```)/g).map((part, i) => (i % 2 === 1 ? part.replace(/[^\n]/g, " ") : part)).join("");
}

test("relative markdown links resolve and engine/core versions match the release", () => {
  const broken: string[] = [];
  const versions: string[] = [];
  const versionRe = /(?<![\w/@.-])(engine|core)\s+(?:\*\*)?v?(\d+\.\d+\.\d+)\b/gi;
  const linkRe = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const file of walk(ROOT)) {
    const text = outsideFences(readFileSync(file, "utf8"));
    const rel = file.slice(ROOT.length + 1);
    let link: RegExpExecArray | null;
    while ((link = linkRe.exec(text))) {
      const href = link[3] ?? "";
      if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const pathPart = decodeURIComponent(href.split("#")[0] ?? "");
      if (!pathPart) continue;
      const target = resolve(dirname(file), pathPart);
      if (!existsSync(target)) {
        const line = text.slice(0, link.index).split("\n").length;
        broken.push(`${rel}:${line} -> ${href}`);
      }
    }
    // Historical notes name the version they shipped; only living docs must
    // track the current one.
    if (historical(rel)) continue;
    let version: RegExpExecArray | null;
    while ((version = versionRe.exec(text))) {
      const found = version[2] ?? "";
      const wanted = (version[1] ?? "").toLowerCase() === "core" ? core.version : pkg.version;
      if (found !== wanted) {
        const line = text.slice(0, version.index).split("\n").length;
        versions.push(`${rel}:${line} ${version[1]} ${found}`);
      }
    }
  }
  const install = readFileSync(join(ROOT, "docs/guides/installation.md"), "utf8");
  const architecture = readFileSync(join(ROOT, "docs/ARCHITECTURE.md"), "utf8");
  expect(install).not.toContain("0.2.26");
  expect(install).not.toContain("0.2.13");
  expect(install).toContain(pkg.version);
  expect(architecture).not.toContain("private macOS pilot");
  expect(architecture).toContain(`engine ${pkg.version}`);
  expect(architecture).toContain(`core ${core.version}`);
  expect(broken).toEqual([]);
  expect(versions).toEqual([]);

  const published = [join(ROOT, "README.md"), join(ROOT, "CHANGELOG.md"), ...walk(join(ROOT, "docs"))];
  const npm: string[] = [];
  const actions: string[] = [];
  for (const file of published) {
    const text = readFileSync(file, "utf8");
    const rel = file.slice(ROOT.length + 1);
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (/npx\s+pregate\b/.test(line) || /npm\s+(?:install|i|add)\b[^\n]*\bpregate\b/.test(line)) npm.push(`${rel}:${index + 1}`);
    });
    const uses = /uses:\s*pedroknigge\/pregate@(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = uses.exec(text))) {
      const ref = match[1] ?? "";
      const line = text.slice(0, match.index).split("\n").length;
      const around = `${lines[line - 2] ?? ""}\n${lines[line - 1] ?? ""}`;
      if (!/^[0-9a-f]{40}$/.test(ref) || !/#\s*v\d+\.\d+\.\d+/.test(around)) actions.push(`${rel}:${line} @${ref}`);
    }
  }
  expect(npm).toEqual([]);
  expect(actions).toEqual([]);
});

test("install commands and living docs use this release, not a pre-rename version", () => {
  const versionRe = /(?:releases\/download\/v|gh release download v|pregate-)(\d+\.\d+\.\d+)|(?:--version|-Version)\s+v?(\d+\.\d+\.\d+)/g;
  const oldLine = /(?<![\d.])0\.2\.\d+/;
  const oldCommit = /b2cec675|39ef4ebd|dc8eb434/;
  const stalePull = /github\.com\/pedroknigge\/pregate\/(?:pull|issues)\/(\d+)/g;
  const installHits: string[] = [];
  const oldHits: string[] = [];
  const pullHits: string[] = [];
  const roots = [join(ROOT, "README.md"), join(ROOT, "CONTRIBUTING.md"), join(ROOT, "SECURITY.md"), ...walk(join(ROOT, "docs")), ...walk(join(ROOT, "skills")), ...walk(join(ROOT, "assets")), ...walk(join(ROOT, "packs"))];
  for (const file of roots) {
    const rel = file.slice(ROOT.length + 1);
    if (historical(rel) || rel.includes("/fixtures/")) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (oldLine.test(line) || oldCommit.test(line)) oldHits.push(`${rel}:${index + 1}`);
    });
    let match: RegExpExecArray | null;
    while ((match = versionRe.exec(text))) {
      const found = match[1] ?? match[2] ?? "";
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineEnd = text.indexOf("\n", match.index);
      const sourceLine = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
      // The Windows guide pins Bun with the official installer. That -Version is Bun's, not Pregate's.
      if (sourceLine.includes("bun.sh/install.ps1")) continue;
      if (found !== pkg.version) {
        const line = text.slice(0, match.index).split("\n").length;
        installHits.push(`${rel}:${line} uses ${found}`);
      }
    }
    versionRe.lastIndex = 0;
    while ((match = stalePull.exec(text))) {
      const number = Number(match[1]);
      if (number < 1 || number > 14) {
        const line = text.slice(0, match.index).split("\n").length;
        pullHits.push(`${rel}:${line} #${number}`);
      }
    }
  }
  expect(installHits).toEqual([]);
  expect(oldHits).toEqual([]);
  expect(pullHits).toEqual([]);
});
