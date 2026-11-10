import { afterAll, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { coordinationMarkers } from "../src/storage-recovery.ts";
import { removeTree } from "./remove-tree.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-recovery-markers-"));
afterAll(() => removeTree(area));

test("permission or unsupported process-probe errors cannot prove abandonment", () => {
  const dir = join(area, "uncertain"); mkdirSync(join(dir, ".leases"), { recursive: true });
  writeFileSync(join(dir, ".leases", process.pid + "-owner.json"), JSON.stringify({ pid: process.pid, at: 1, host: hostname() }));
  for (const code of ["EPERM", "EINVAL", "EINTR"]) {
    const probe = spyOn(process, "kill").mockImplementation(() => { throw Object.assign(new Error("unavailable"), { code }); });
    restoredAfter(probe, () => {
      expect(coordinationMarkers(dir)).toMatchObject([{ state: "unknown", pid: process.pid }]);
      expect(probe).toHaveBeenCalled();
    });
  }
});

test("missing or foreign host identity never uses a local PID probe to claim abandonment", () => {
  const dir = join(area, "foreign"); mkdirSync(join(dir, ".leases"), { recursive: true });
  writeFileSync(join(dir, ".leases", process.pid + "-foreign.json"), JSON.stringify({ pid: process.pid, at: 1, host: hostname() + "-different" }));
  writeFileSync(join(dir, ".leases", process.pid + "-missing.json"), JSON.stringify({ pid: process.pid, at: 1 }));
  const probe = spyOn(process, "kill");
  restoredAfter(probe, () => {
    expect(coordinationMarkers(dir).map((item) => item.state)).toEqual(["unknown", "unknown"]);
    expect(probe).not.toHaveBeenCalled();
  });
});

test("invalid ownership does not trigger a process probe", () => {
  const dir = join(area, "invalid"); mkdirSync(join(dir, ".leases"), { recursive: true });
  writeFileSync(join(dir, ".leases/1-mismatch.json"), JSON.stringify({ pid: process.pid, at: 1 }));
  writeFileSync(join(dir, ".leases/1-malformed.json"), "not JSON");
  writeFileSync(join(dir, ".leases/2147483648-out-of-range.json"), JSON.stringify({ pid: 2147483648, at: 1 }));
  const probe = spyOn(process, "kill");
  restoredAfter(probe, () => {
    expect(coordinationMarkers(dir).map((item) => item.state)).toEqual(["unknown", "unknown", "unknown"]);
    expect(probe).not.toHaveBeenCalled();
  });
});

function restoredAfter(probe: { mockRestore(): void }, check: () => void): void {
  try { check(); } finally { probe.mockRestore(); }
}
