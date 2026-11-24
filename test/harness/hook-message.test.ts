import { expect, test } from "bun:test";
import { budgeted, type HookMessage } from "../../src/harness/wire.ts";

const GROK = { chars: 256, lines: 1 } as const;
const TEXT = { chars: 4000, lines: 4000 } as const;

test("a budgeted message leads with the repair and stays inside the line and character budget", () => {
  const led = budgeted(GROK, "use Write", "the tool wrote a file");
  expect(led.startsWith("use Write ")).toBe(true);
  expect(led.includes("\n")).toBe(false);
  expect(led.length).toBeLessThanOrEqual(256);
  const clipped = budgeted(GROK, "fix", "x".repeat(400));
  expect(clipped.length).toBe(256);
  expect(String(budgeted(GROK, "Fix: already inside", "PREGATE DENY a\nb\r\nc"))).toBe("PREGATE DENY a b c");
  expect(String(budgeted(TEXT, "", ""))).toBe("");
});

test("an unbudgeted string is not a hook message of the Grok budget", () => {
  const wide: HookMessage<4000, 4000> = budgeted(TEXT, "fix", "PREGATE DENY ok");
  const narrow: HookMessage<256, 1> = budgeted(GROK, "fix", "PREGATE DENY ok");
  const accept = (message: HookMessage<256, 1>): HookMessage<256, 1> => message;
  accept(narrow);
  // @ts-expect-error a plain string has no character or line budget
  accept("PREGATE DENY ok");
  // @ts-expect-error a 4000-character message is not a 256-character one-line message
  accept(wide);
});
