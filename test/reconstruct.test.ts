import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { apply, normalize, window } from "../src/reconstruct.ts";
import type { Edit, Hunk, Reconstruction } from "../src/types.ts";

const oldnew = (old: string, neu: string, all = false): Edit => ({ form: "oldnew", old, neu, all, lines: null });
const ranged = (old: string, neu: string, lines: [number, number], all = false): Edit => ({ form: "oldnew", old, neu, all, lines });
const payload = (name: string) => JSON.parse(readFileSync(`${import.meta.dir}/payloads/${name}`, "utf8"));

describe("apply", () => {
  const cases: [string, string | null, Edit, string | null, Reconstruction][] = [
    ["write creates", null, { form: "full", content: "export const a = 1;\n" }, "export const a = 1;\n", "exact"],
    ["write replaces", "old\n", { form: "full", content: "new\n" }, "new\n", "exact"],
    ["write normalizes CRLF", null, { form: "full", content: "a\r\nb\r\n" }, "a\nb\n", "exact"],
    ["unique match", "const a = 1;\nconst b = 2;\n", oldnew("a = 1", "a = 3"), "const a = 3;\nconst b = 2;\n", "exact"],
    ["not found", "const a = 1;\n", oldnew("a = 2", "a = 3"), null, "tool-will-fail"],
    ["file missing", null, oldnew("a", "b"), null, "tool-will-fail"],
    ["not unique", "x;\nx;\n", oldnew("x;", "y;"), null, "tool-will-fail"],
    ["replace_all", "x;\nx;\n", oldnew("x;", "y;", true), "y;\ny;\n", "exact"],
    ["replace_all with one match", "x;\n", oldnew("x;", "y;", true), "y;\n", "exact"],
    ["replace_all not found", "x;\n", oldnew("z;", "y;", true), null, "tool-will-fail"],
    ["empty old (O11)", "x;\n", oldnew("", "y;"), null, "unknown"],
    ["empty old on a new file creates it (MH-13)", null, oldnew("", "y;\r\n"), "y;\n", "exact"],
    ["empty old on an empty file", "", oldnew("", "y;"), null, "unknown"],
    ["CRLF in new is normalized", "a;\n", oldnew("a;", "b;\r\nc;"), "b;\nc;\n", "exact"],
    ["append", "a\r\n", { form: "append", text: "b\n" }, "a\nb\n", "exact"],
    ["append to a missing file creates it", null, { form: "append", text: "b\n" }, "b\n", "exact"],
    ["append joins a split CRLF", "a\r", { form: "append", text: "\nb" }, "a\nb", "exact"],
    ["delete", "a\n", { form: "delete" }, null, "exact"],
    ["delete a missing file", null, { form: "delete" }, null, "exact"],
    ["MultiEdit", "x;\n", { form: "unknown", cause: "MultiEdit" }, null, "unknown"],
    ["$ in new is literal", "a;\n", oldnew("a", "$&$1$$"), "$&$1$$;\n", "exact"],
    ["deletion", "a;\nb;\n", oldnew("b;\n", ""), "a;\n", "exact"],
    ["CRLF file, LF old", "a;\r\nb;\r\n", oldnew("a;\nb;", "c;"), "c;\n", "exact"],
    ["CRLF old never matches", "a;\r\nb;\r\n", oldnew("a;\r\nb;", "c;"), null, "tool-will-fail"],
    ["BOM is dropped", "﻿a;\n", oldnew("a;", "b;"), "b;\n", "exact"],
    ["BOM cannot be matched", "﻿a;\n", oldnew("﻿a;", "b;"), null, "tool-will-fail"],
    ["overlapping occurrences count once", "aaa", oldnew("aa", "b"), "ba", "exact"],
  ];
  for (const [name, current, edit, after, status] of cases) {
    test(name, () => expect(apply(current, edit)).toEqual({ after, status }));
  }
});

describe("window", () => {
  const cases: [string, string | null, string, [number, number] | null][] = [
    ["new file is whole", null, "abc", [0, 3]],
    ["new empty file", null, "", [0, 0]],
    ["unchanged", "abc", "abc", null],
    ["middle replaced", "a1c", "a22c", [1, 3]],
    ["insertion", "ac", "abc", [1, 2]],
    ["deletion is empty at the point", "abc", "ac", [1, 1]],
    ["append", "ab", "abcd", [2, 4]],
    ["prepend", "cd", "abcd", [0, 2]],
    ["repeated text does not overlap", "aa", "aaa", [2, 3]],
    ["truncated to empty", "abc", "", [0, 0]],
    ["base is normalized like after", "a\r\nb\r\n", "a\nX\n", [2, 3]],
    ["same text under CRLF and BOM", "﻿a\r\n", "a\n", null],
  ];
  for (const [name, base, after, expected] of cases) {
    test(name, () => expect(window(base, after)).toEqual(expected));
  }

  test("the window covers exactly the text an edit introduced", () => {
    const current = "function f() {\n  return 1;\n}\n";
    const { after } = apply(current, oldnew("return 1;", "return (;"));
    const [start, end] = window(current, after!)!;
    expect(after!.slice(start, end)).toBe("(");
  });
});

test("normalize is idempotent", () => {
  const text = "﻿a\r\nb\r\n";
  expect(normalize(normalize(text))).toBe(normalize(text));
  expect(normalize(text)).toBe("a\nb\n");
});

describe("captured calls", () => {
  test("Claude Code Edit with an empty old_string creates the file (MH-13)", () => {
    const { new_string } = payload("pre-edit-empty-old.json").tool_input;
    expect(apply(null, oldnew("", new_string))).toEqual({ after: new_string, status: "exact" });
  });

  test("Grok search_replace with an empty old_string creates the file (MH-13)", () => {
    const { new_string } = payload("grok/pre-search-replace-create.json").tool_input;
    expect(apply(null, oldnew("", new_string))).toEqual({ after: new_string, status: "exact" });
  });

  test("agy write_to_file with Append adds CodeContent to the end (MH-11)", () => {
    const { CodeContent } = payload("agy/pre-write_to_file-append.json").toolCall.args;
    const edit: Edit = { form: "append", text: CodeContent };
    expect(apply("line one\nline two\nline three\n", edit).after).toBe("line one\nline two\nline three\nline four\n");
  });

  const replace = (name: string): Edit => {
    const a = payload(`agy/${name}`).toolCall.args;
    return ranged(a.TargetContent, a.ReplacementContent, [a.StartLine, a.EndLine], a.AllowMultiple);
  };

  test("agy 1.5.3 edit_file: one exact match is applied; a missing or repeated target is unknown, never a silent failure", () => {
    const edit = { form: "oldnew" as const, old: "  return a + b;", neu: "  return b + a;", all: false, lines: [1, Number.MAX_SAFE_INTEGER] as [number, number] };
    expect(apply("export function add(a: number, b: number): number {\n  return a + b;\n}\n", edit))
      .toEqual({ status: "exact", after: "export function add(a: number, b: number): number {\n  return b + a;\n}\n" });
    expect(apply("  return a + b;\n  return a + b;\n", edit)).toEqual({ status: "unknown", after: null });
    expect(apply("nothing here\n", edit)).toEqual({ status: "unknown", after: null });
    expect(apply(null, edit)).toEqual({ status: "unknown", after: null });
  });

  test("agy replace_file_content on one line", () => {
    expect(apply("line one\nline two\nline three\n", replace("pre-replace_file_content.json")))
      .toEqual({ after: "line one\nline 2\nline three\n", status: "exact" });
  });

  test("agy replace_file_content on a multi-line chunk", () => {
    expect(apply("alpha\nbeta\ngamma\ndelta\nepsilon\n", replace("pre-replace_file_content-multiline.json")))
      .toEqual({ after: "alpha\nBETA\ngamma\nDELTA\nepsilon\n", status: "exact" });
  });
});

// agy's replace_file_content (MH-11): exact only when the target is inside lines first..last and the
// result would be the same if agy searched the whole file. Otherwise unknown, never tool-will-fail,
// because agy may match fuzzily.
describe("oldnew with a line range", () => {
  const file = "x\ny\nz\n";
  const cases: [string, string | null, Edit, string | null, Reconstruction][] = [
    ["one line", file, ranged("y", "Y", [2, 2]), "x\nY\nz\n", "exact"],
    ["the whole range", file, ranged("x\ny", "w", [1, 2]), "w\nz\n", "exact"],
    ["the last line's newline is in the range", file, ranged("y\n", "Y\n", [2, 2]), "x\nY\nz\n", "exact"],
    ["a last line without newline", "x\ny", ranged("y", "Y", [2, 2]), "x\nY", "exact"],
    ["not in the range", file, ranged("x", "X", [2, 3]), null, "unknown"],
    ["crossing the end of the range", file, ranged("y\nz", "w", [2, 2]), null, "unknown"],
    ["crossing the start of the range", file, ranged("x\ny", "w", [2, 3]), null, "unknown"],
    ["also outside the range", "x\ny\nx\n", ranged("x", "X", [3, 3]), null, "unknown"],
    ["twice in the range", "x\nx\n", ranged("x", "X", [1, 2]), null, "unknown"],
    ["twice in the range with AllowMultiple", "x\nx\n", ranged("x", "X", [1, 2], true), "X\nX\n", "exact"],
    ["AllowMultiple with one outside the range", "x\nx\nx\n", ranged("x", "X", [2, 3], true), null, "unknown"],
    ["a range past the end is cut at the end", file, ranged("z\n", "Z\n", [3, 9]), "x\ny\nZ\n", "exact"],
    ["a range starting past the end", file, ranged("z", "Z", [4, 4]), null, "unknown"],
    ["line 0", file, ranged("x", "X", [0, 1]), null, "unknown"],
    ["a reversed range", file, ranged("x", "X", [2, 1]), null, "unknown"],
    ["a fractional range", file, ranged("x", "X", [1, 1.5]), null, "unknown"],
    ["an empty file", "", ranged("x", "X", [1, 1]), null, "unknown"],
    ["a missing file", null, ranged("x", "X", [1, 1]), null, "unknown"],
    ["an empty target on a missing file", null, ranged("", "X", [1, 1]), null, "unknown"],
    ["CRLF and BOM are dropped first", "﻿x\r\ny\r\n", ranged("y", "Y", [2, 2]), "x\nY\n", "exact"],
  ];
  for (const [name, current, edit, after, status] of cases) {
    test(name, () => expect(apply(current, edit)).toEqual({ after, status }));
  }
});

// Codex's apply_patch (MH-08) against what the real binary wrote. Each case states our status; an
// "exact" one must equal Codex's file. The rest are calls the exact pass does not decide: Codex
// fails them, matches them fuzzily or applies a rule we do not rely on.
describe("hunks against Codex apply_patch", () => {
  const fixture: { cases: { name: string; current: string | null; hunks: Hunk[]; codex: string | null }[] } =
    JSON.parse(readFileSync(`${import.meta.dir}/fixtures/apply-patch.json`, "utf8"));
  const expected: Record<string, Reconstruction> = {
    "hunk of the captured add-update patch": "exact",
    "hunk of the captured move patch": "exact",
    "context lines": "exact",
    "first exact occurrence wins": "exact",
    "anchor selects a later occurrence": "exact",
    "search starts after the anchor line": "exact",
    "end of file selects the last lines": "exact",
    "end of file with no match at the end": "unknown",
    "two hunks in order": "exact",
    "two hunks out of order": "unknown",
    "second hunk searches after the first": "exact",
    "adjacent hunks": "exact",
    "hunks cannot overlap": "unknown",
    "end of file before the previous hunk": "unknown",
    "anchor then end of file": "exact",
    "anchor not found": "unknown",
    "anchor found only after trimming": "unknown",
    "deletion of lines": "exact",
    "delete every line": "exact",
    "no trailing newline gains one": "exact",
    "untouched file without trailing newline gains one": "exact",
    "blank last line is kept once": "exact",
    "several blank last lines": "exact",
    "blank line in the middle": "exact",
    "pattern ending in a blank line that is not in the file": "unknown",
    "pattern ending in a blank line that is in the file": "exact",
    "trailing spaces: exact occurrence later": "exact",
    "trailing spaces only": "unknown",
    "leading spaces only": "unknown",
    "empty file": "unknown",
    "missing file": "tool-will-fail",
    "CRLF file": "unknown",
    "CRLF file, last line without newline": "exact",
    "BOM file, later line": "exact",
    "BOM file, first line": "unknown",
    "pure insertion": "unknown",
    "pure insertion after an anchor": "unknown",
    "unicode dash only after normalization": "unknown",
    "pattern longer than the file": "unknown",
    "dollar signs are literal": "exact",
  };

  test("every captured case has an expectation and every expectation a case", () => {
    expect(fixture.cases.map((c) => c.name).sort()).toEqual(Object.keys(expected).sort());
  });

  for (const c of fixture.cases) {
    test(c.name, () => {
      const status = expected[c.name];
      const after = status === "exact" && c.codex !== null ? normalize(c.codex) : null;
      expect(apply(c.current, { form: "hunks", hunks: c.hunks })).toEqual({ after, status: status! });
      if (status === "exact") expect(c.codex).not.toBeNull();
    });
  }

  test("a file with more lines than a call can take as arguments", () => {
    const current = "x\n".repeat(1_000_000);
    const hunks: Hunk[] = [{ anchor: null, old: ["x"], neu: ["y"], eof: true }];
    expect(apply(current, { form: "hunks", hunks }).after).toBe(`${"x\n".repeat(999_999)}y\n`);
  });
});
