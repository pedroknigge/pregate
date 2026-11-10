import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accompanyEngine } from "../src/machine.ts";
import { removeTree } from "./remove-tree.ts";

const PHRASES = [
  "GNU LIBRARY GENERAL PUBLIC LICENSE", "Version 2, June 1991",
  "numbered 2 because it goes with version 2 of the ordinary GPL",
  "GNU LESSER GENERAL PUBLIC LICENSE", "Version 2.1, February 1999",
  "successor of the GNU Library Public License, version 2",
  "d6375c72affe0f70222cdcb45012b10f0bf3a9d5",
  "https://github.com/oven-sh/bun/tree/bun-v1.4.4",
  "https://github.com/oven-sh/bun/archive/refs/tags/bun-v1.4.4.tar.gz",
  "https://github.com/oven-sh/WebKit/tree/d6375c72affe0f70222cdcb45012b10f0bf3a9d5",
  "https://github.com/oven-sh/WebKit/archive/d6375c72affe0f70222cdcb45012b10f0bf3a9d5.tar.gz",
  "05f0fafaa3be31e31d7b4b5c17dc60f62c991171",
  "https://github.com/oven-sh/tinycc/tree/05f0fafaa3be31e31d7b4b5c17dc60f62c991171",
  "https://github.com/oven-sh/tinycc/archive/05f0fafaa3be31e31d7b4b5c17dc60f62c991171.tar.gz",
  "https://github.com/oven-sh/bun/blob/bun-v1.4.4/patches/tinycc/tcc.h.patch",
  "bun sync-webkit-source",
];

function expectSourceLinks(text: string) {
  for (const phrase of PHRASES) expect(text).toContain(phrase);
  expect(text.match(/END OF TERMS AND CONDITIONS/g)).toHaveLength(2);
  expect(text.match(/written offer/gi)).toHaveLength(2);
  expect(text).not.toContain("will give any recipient");
  expect(text).not.toContain("section 6(b)");
}

test("a release archive contains the JavaScriptCore and tinycc license texts", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-notices-"));
  try {
    const src = join(dir, "src");
    mkdirSync(src);
    writeFileSync(join(src, "pregate"), "#!/bin/sh\n");
    writeFileSync(join(src, "LICENSE"), readFileSync("LICENSE"));
    writeFileSync(join(src, "THIRD_PARTY_NOTICES"), readFileSync("THIRD_PARTY_NOTICES"));
    const archive = join(dir, "pregate.tar.gz");
    const packed = Bun.spawnSync(["tar", "-czf", archive, "-C", src, "pregate", "LICENSE", "THIRD_PARTY_NOTICES"], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
    expect(packed.exitCode, packed.stderr.toString()).toBe(0);
    const notice = Bun.spawnSync(["tar", "-xOzf", archive, "THIRD_PARTY_NOTICES"], { stdout: "pipe", stderr: "pipe" });
    expect(notice.exitCode, notice.stderr.toString()).toBe(0);
    expectSourceLinks(notice.stdout.toString());
    const engine = join(dir, "engine");
    mkdirSync(engine);
    accompanyEngine(join(src, "pregate"), engine);
    expectSourceLinks(readFileSync(join(engine, "THIRD_PARTY_NOTICES"), "utf8"));
    expect(readFileSync(join(engine, "LICENSE"), "utf8").length).toBeGreaterThan(0);
  } finally {
    removeTree(dir);
  }
});
