import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { ASSETS } from "./assets.ts";
import { writeAtomic } from "./disk.ts";
import pkg from "../package.json" with { type: "json" };
import { homeDir } from "./platform.ts";

export function skillText(): string {
  return ASSETS["pregate/SKILL.md"]!.replaceAll("@ENGINE_VERSION@", pkg.version);
}

export function skillFiles(): string[] {
  const home = homeDir();
  return [...new Set([
    join(home, ".agents/skills/pregate/SKILL.md"), join(home, ".claude/skills/pregate/SKILL.md"),
    join(process.env.CODEX_HOME || join(home, ".codex"), "skills/pregate/SKILL.md"),
    join(home, ".cursor/skills/pregate/SKILL.md"), join(process.env.GROK_HOME || join(home, ".grok"), "skills/pregate/SKILL.md"),
    join(home, ".gemini/antigravity-cli/skills/pregate/SKILL.md"),
    join(process.env.OPENCODE_CONFIG_DIR || join(home, ".config/opencode"), "skills/pregate/SKILL.md"),
  ])];
}

export function installSkill(): void {
  const text = skillText();
  for (const file of skillFiles()) {
    if (existsSync(file) && readFileSync(file, "utf8") === text) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeAtomic(file, text);
  }
}

export function removeSkill(): void {
  for (const file of skillFiles()) {
    if (existsSync(file) && readFileSync(file, "utf8").includes("name: pregate\n")) rmSync(dirname(file), { recursive: true, force: true });
  }
}

export function skillProblems(): string[] {
  return skillFiles().flatMap((file) => !existsSync(file) ? [`Missing /pregate skill at ${file}; run pregate setup.`]
    : readFileSync(file, "utf8") !== skillText() ? [`Stale /pregate skill at ${file}; run pregate setup.`] : []);
}
