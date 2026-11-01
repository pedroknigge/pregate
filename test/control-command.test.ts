import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pregateControlCause, scriptControlCause } from "../src/control.ts";
import { guard } from "../src/shell.ts";

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

test("prose that mentions pregate is not an invocation; a quoted list across lines still is", () => {
  expect(scriptControlCause("/repo/Makefile", "# build helpers for pregate\ninstall:\n\techo ok\n")).toBeNull();
  expect(scriptControlCause("/repo/deploy.sh", "#!/bin/sh\n# requires pregate\nupdate() { echo; }\n")).toBeNull();
  expect(pregateControlCause("# CI = GitHub Actions; run pregate status")).toBeNull();
  expect(pregateControlCause("echo pregate\ninstall:\n")).toBeNull();
  expect(pregateControlCause("// pregate\nsetup()")).toBeNull();
  expect(pregateControlCause("subprocess.run([\n  'pregate',\n  'approve', 'x'])")).toBe("shell-admin");
  expect(pregateControlCause("export CI=1\npregate approve --yes --digest abc")).toBe("hook-switch");
  expect(pregateControlCause("CI=1 pregate status")).toBe("hook-switch");
  expect(pregateControlCause("CI = 1\napprove:\n\tpregate approve x\n")).toBe("hook-switch");
  expect(pregateControlCause("os.environ['CI'] = '1'\nsubprocess.run(['pregate', 'status'])")).toBe("hook-switch");
  // A long program is judged by its first MiB, not denied for its size.
  expect(pregateControlCause("x".repeat(1_048_577))).toBeNull();
  expect(pregateControlCause(`pregate approve x\n${"x".repeat(1_048_577)}`)).toBe("shell-admin");
});

test("a script fed on stdin or run without a suffix is read; a CI prefix binds only its command", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-control-"));
  writeFileSync(join(dir, "run.sh"), "#!/bin/sh\npregate uninstall\n");
  writeFileSync(join(dir, "run"), "#!/bin/sh\npregate uninstall\n");
  writeFileSync(join(dir, "attack.py"), "import subprocess\nsubprocess.run(['pregate','approve','x'])\n");
  writeFileSync(join(dir, "ok.sh"), "#!/bin/sh\necho hello\n");
  for (const command of ["bash < run.sh", "bash -s < run.sh", "sh - < ./run.sh", "./run", `${dir}/run`, "bash run"]) {
    expect(guard(command, dir, ctx), command).toBe("hook-switch");
  }
  for (const command of ["python3 < attack.py", "python3 - < attack.py", "python3 attack.py"]) {
    expect(guard(command, dir, ctx), command).toBe("shell-admin");
  }
  expect(guard("bash < ok.sh", dir, ctx)).toBeNull();
  expect(guard("cat < run.sh", dir, ctx)).toBeNull();
  expect(guard("wc -l < run.sh", dir, ctx)).toBeNull();
  expect(guard("ls", dir, ctx)).toBeNull();
  expect(guard("/bin/ls", dir, ctx)).toBeNull();
  expect(guard("CI=1 bun test && pregate status", dir, ctx)).toBeNull();
  expect(guard("CI=1 pregate status", dir, ctx)).toBe("hook-switch");
  expect(guard("CI=1 sh -c 'pregate status'", dir, ctx)).toBe("hook-switch");
  expect(guard("CI=1; pregate status", dir, ctx)).toBe("hook-switch");
  expect(guard("export CI=1; pregate status", dir, ctx)).toBe("hook-switch");
});

test("make and bash read a literal script and still allow a benign one", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-control-"));
  writeFileSync(join(dir, "Makefile"), "approve:\n\tpregate approve x\nall:\n\techo ok\n");
  writeFileSync(join(dir, "run.sh"), "#!/bin/sh\npregate approve x\n");
  writeFileSync(join(dir, "ok.sh"), "#!/bin/sh\necho hello\n");
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
