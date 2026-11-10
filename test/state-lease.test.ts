import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockPrune, storageActivity, withStateWrite } from "../src/state-lease.ts";
import { removeTree } from "./remove-tree.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-leases-"));
afterAll(() => removeTree(area));

test("multiple writers coexist, exclude pruning and release after failures", () => {
  const dir = join(area, "writers");
  withStateWrite(dir, () => withStateWrite(dir, () => {
    expect(storageActivity(dir)).toEqual({ writers: 2, pruning: false });
    expect(() => lockPrune(dir)).toThrow("in use");
    expect(storageActivity(dir).pruning).toBe(false);
  }));
  expect(storageActivity(dir).writers).toBe(0);
  expect(() => withStateWrite(dir, () => { throw new Error("writer failed"); })).toThrow("writer failed");
  expect(storageActivity(dir).writers).toBe(0);
});

test("an exclusive cleaner blocks writers and another cleaner without removing its marker", () => {
  const dir = join(area, "cleaner"); mkdirSync(dir);
  const release = lockPrune(dir);
  expect(() => withStateWrite(dir, () => "unsafe")).toThrow("in use");
  expect(() => lockPrune(dir)).toThrow();
  expect(storageActivity(dir)).toEqual({ writers: 0, pruning: true });
  release();
  expect(withStateWrite(dir, () => "safe")).toBe("safe");
});

test("an old cleaner's release cannot delete a successor's unique owner", () => {
  const dir = join(area, "successor"); mkdirSync(dir);
  const first = lockPrune(dir), name = readdirSync(join(dir, ".pruning"))[0];
  first();
  const second = lockPrune(dir);
  expect(readdirSync(join(dir, ".pruning"))[0]).not.toBe(name);
  expect(() => first()).toThrow();
  expect(storageActivity(dir).pruning).toBe(true);
  expect(() => withStateWrite(dir, () => "unsafe")).toThrow("in use");
  second(); expect(storageActivity(dir).pruning).toBe(false);
});
