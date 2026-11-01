import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pregateControlCause, scriptControlCause } from "../src/control.ts";
import { guard } from "../src/shell.ts";
import type { Lock } from "../src/types.ts";

const ctx = {
  machineOnly: false, harness: "claude-code" as const, touched: () => true, launcher: "/repo/.pregate/bin/pregate",
  isProtected: () => false, inScope: () => false, under: () => false,
};

test("inline interpreters name pregate control commands and leave benign code alone", () => {
  expect(pregateControlCause("subprocess.run(['pregate','approve','x'])")).toBe("shell-admin");
  expect(pregateControlCause("execSync('pregate approve x')")).toBe("shell-admin");
  expect(pregateControlCause("system('pregate','disable')")).toBe("shell-admin");
  expect(pregateControlCause("system('pregate uninstall')")).toBe("hook-switch");
  expect(pregateControlCause("os.system('pregate setup')")).toBe("hook-switch");
  expect(pregateControlCause("pregate update --project --yes")).toBe("hook-switch");
  expect(pregateControlCause("pregate update --project --preview")).toBeNull();
  expect(pregateControlCause("pregate approve --preview")).toBeNull();
  expect(pregateControlCause("pregate guide --preview")).toBeNull();
  expect(pregateControlCause("pregate status")).toBeNull();
  expect(pregateControlCause("print(1 + 1)")).toBeNull();
  expect(pregateControlCause('trusted_hash = "abc"')).toBe("hook-switch");
  expect(pregateControlCause("PREGATE_TESTING=1")).toBe("hook-switch");
  expect(scriptControlCause("/repo/run.sh", "#!/bin/sh\npregate approve x\n")).toBe("shell-admin");
  expect(scriptControlCause("/repo/Makefile", "approve:\n\tpregate approve x\n")).toBe("shell-admin");
  expect(scriptControlCause("/repo/src/a.ts", "export const pregate = 1;\n")).toBeNull();
  expect(scriptControlCause("/repo/run.sh", "echo hello\n")).toBeNull();
});

test("make and bash read a literal script and still allow a benign one", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-control-"));
  writeFileSync(join(dir, "Makefile"), "approve:\n\tpregate approve x\nall:\n\techo ok\n");
  writeFileSync(join(dir, "run.sh"), "#!/bin/sh\npregate approve x\n");
  writeFileSync(join(dir, "ok.sh"), "#!/bin/sh\necho hello\n");
  const lock = { scope: { include: ["src/**"], exclude: [] } } as Lock;
  expect(lock.scope.include).toEqual(["src/**"]);
  expect(guard("make approve", dir, ctx)).toBe("shell-admin");
  expect(guard("make -f Makefile approve", dir, ctx)).toBe("shell-admin");
  expect(guard("bash ./run.sh", dir, ctx)).toBe("shell-admin");
  expect(guard("./run.sh", dir, ctx)).toBe("shell-admin");
  expect(guard("bash ./ok.sh", dir, ctx)).toBeNull();
  expect(guard("python3 attack.py", dir, ctx)).toBeNull();
  writeFileSync(join(dir, "attack.py"), "import subprocess\nsubprocess.run(['pregate','approve','x'])\n");
  expect(guard("python3 attack.py", dir, ctx)).toBe("shell-admin");
  expect(guard("python3 -c \"print(1 + 1)\"", dir, ctx)).toBeNull();
  expect(guard("node -e \"console.log(1)\"", dir, ctx)).toBeNull();
});
