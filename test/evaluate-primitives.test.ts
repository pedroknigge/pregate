import { beforeAll, expect, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import type { Check, Read } from "../src/types.ts";

beforeAll(setUpGrammars);

// The closed primitive vocabulary (types.ts Impl, schema/check.v1.json): analyze fails closed on a
// rule whose impl names a primitive outside the vocabulary, instead of silently never evaluating it.
// The name cannot reach a compiled lock (the compiler rejects it), so reaching analyze means a
// hand-edited or mistyped lock — exactly the case ARCHITECTURE §1 "rules are data over a closed
// vocabulary" turns into an error, never into "does not match".
test("analyze throws on a primitive outside the closed vocabulary", () => {
  const check: Check = { id: "x/evaluate-primitives", version: "1.0.0", area: "evaluate", cardinality: "singleton", dimension: "evaluate.primitives",
    minSeverity: null, params: {}, impl: { kind: "primitive", primitive: "metric", metric: "fn.lines" }, phase: ["pre"], feedback: { message: "" } };
  const lock = fixtureLock(check, { paths: ["src/**"] }, {});
  const rule = lock.rules[0]!;
  (rule.impl as { primitive: string }).primitive = "brand-new";
  const host = { read: (() => null) as Read, now: () => 0, hash: false };
  expect(() => analyze(lock, "pre", "src/a.ts", "const f = () => {};\n", host)).toThrow(/unknown primitive "brand-new"/);
});
