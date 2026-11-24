import { expect, test } from "bun:test";
import { quickFixProblems, quickFixSites, repositoryQuickFixProblems, type AllowEntry } from "../scripts/quick-fix.ts";

const REASON = "This is a reviewed deadline that aborts the operation. It does not retry a failed call.";

const wait = `export function poll(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}
`;

const retry = `export function again(): void {
  for (let attempt = 0; attempt < 5; attempt++) work();
}
function work(): void {}
`;

const quiet = `export const mentioned = "setTimeout(resolve, 25) for (let attempt = 0; attempt < 5; attempt++)";
export function f(timer: ReturnType<typeof setTimeout>): number {
  let total = 0;
  for (let i = 0; i < 3; i++) total += i;
  return total + (timer === undefined ? 0 : 1);
}
`;

function reviewed(file: string, source: string): AllowEntry[] {
  return quickFixSites(file, source).map((hit) => ({ file: hit.file, site: hit.site, reason: REASON }));
}

test("src waits and counted retries are the reviewed allowlist", () => {
  expect(repositoryQuickFixProblems()).toEqual([]);
});

test("an injected wait fails and tells the author to fix the cause", () => {
  const problems = quickFixProblems([{ file: "src/new.ts", source: wait }], []);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("src/new.ts");
  expect(problems[0]).toContain("wait");
  expect(problems[0]).toContain("Fix the cause");
  expect(problems[0]).toContain("leaves the failure in place");
});

test("the same wait passes when the allowlist names that file and site", () => {
  expect(quickFixSites("src/new.ts", wait)).toHaveLength(1);
  expect(quickFixProblems([{ file: "src/new.ts", source: wait }], reviewed("src/new.ts", wait))).toEqual([]);
});

test("an injected counted retry fails until that site is reviewed", () => {
  const bare = quickFixProblems([{ file: "src/new.ts", source: retry }], []);
  expect(bare).toHaveLength(1);
  expect(bare[0]).toContain("retry");
  expect(bare[0]).toContain("Fix the cause");
  expect(quickFixProblems([{ file: "src/new.ts", source: retry }], reviewed("src/new.ts", retry))).toEqual([]);
});

test("a string, a type position, and a counted loop that is not a retry are quiet", () => {
  expect(quickFixSites("src/new.ts", quiet)).toEqual([]);
});

test("an allowlist row for a site that is not there fails", () => {
  const problems = quickFixProblems([{ file: "src/new.ts", source: quiet }], [{
    file: "src/new.ts", site: "poll: setTimeout(25)", reason: REASON,
  }]);
  expect(problems).toEqual([
    "src/new.ts site poll: setTimeout(25) matches no wait or counted retry. Remove the stale review.",
  ]);
});

test("a one-word reason does not review the site", () => {
  const [hit] = quickFixSites("src/new.ts", wait);
  const problems = quickFixProblems([{ file: "src/new.ts", source: wait }], [{
    file: "src/new.ts", site: hit!.site, reason: "ok",
  }]);
  expect(problems.join("\n")).toContain("needs a reason");
  expect(problems.join("\n")).toContain("Fix the cause");
  expect(problems.join("\n")).not.toContain("matches no wait");
});
