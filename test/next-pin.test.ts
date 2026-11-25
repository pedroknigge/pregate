import { expect, test } from "bun:test";
import { dependencyPinHit, pinWindows } from "../src/package-version.ts";

const ranges = [
  { introduced: "0.0.0", fixed: "15.5.29" },
  { introduced: "16.0.0", fixed: "16.4.5" },
];

function line(spec: string): number | null {
  const text = `{\n  "dependencies": {\n    "next": "${spec}"\n  }\n}\n`;
  return dependencyPinHit("package.json", text, "next", ranges);
}

test("NEXT-PIN-001 windows flag <=15.5.28 and 16.0.0 through 16.4.4", () => {
  expect(line("15.5.28")).toBe(3);
  expect(line("14.2.5")).toBe(3);
  expect(line("16.0.0")).toBe(3);
  expect(line("16.4.4")).toBe(3);
  expect(line("^16.0.0")).toBe(3);
  expect(line(">=15.5.29")).toBe(3);
  expect(line("15.5.29")).toBeNull();
  expect(line("^15.5.29")).toBeNull();
  expect(line("16.4.5")).toBeNull();
  expect(line("^16.4.5")).toBeNull();
  expect(line("15.5.29 || 16.4.5")).toBeNull();
  expect(line("*")).toBeNull();
  const other = `{\n  "dependencies": {\n    "eslint-config-next": "15.5.28",\n    "next": "16.4.5"\n  }\n}\n`;
  expect(dependencyPinHit("package.json", other, "next", ranges)).toBeNull();
});

test("a single introduced and fixed pair stays one window", () => {
  const params = { package: "mongodb", introduced: "6.7.0", fixed: "7.9.0" };
  expect(pinWindows(params)).toEqual([{ introduced: "6.7.0", fixed: "7.9.0" }]);
  expect(pinWindows({ package: "next", ranges })).toEqual(ranges);
  const text = `{\n  "dependencies": {\n    "mongodb": "7.8.1"\n  }\n}\n`;
  expect(dependencyPinHit("package.json", text, "mongodb", pinWindows(params))).toBe(3);
});
