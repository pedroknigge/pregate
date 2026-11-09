import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { commandOnPath, controlInFile, readScriptFile } from "../src/control-file.ts";
import { pregateControlCause, scriptControlCause } from "../src/control.ts";
import { guard } from "../src/shell.ts";

const ctx = {
  machineOnly: false, harness: "claude-code" as const, touched: () => true, launcher: "/repo/.pregate/bin/pregate",
  isProtected: () => false, inScope: () => false, under: () => false, readControlFile: controlInFile, readScriptFile, commandPath: commandOnPath,
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
  // A long program is read whole: padding neither hides a command nor denies by itself.
  expect(pregateControlCause("x".repeat(1_048_577))).toBeNull();
  expect(pregateControlCause(`pregate approve x\n${"x".repeat(1_048_577)}`)).toBe("shell-admin");
  expect(pregateControlCause(`${"#".repeat(1_048_577)}\nCI=1 pregate disable --yes\n`)).toBe("hook-switch");
  expect(pregateControlCause(`${"x".repeat(1_048_577)}\npregate disable --yes\n`)).toBe("shell-admin");
});

test("continued lines, computed verbs and contract-writing commands are control commands", () => {
  expect(pregateControlCause("pregate \\\nsetup\n")).toBe("hook-switch");
  expect(pregateControlCause("pregate \\\r\n  disable --yes\r\n")).toBe("shell-admin");
  expect(pregateControlCause("preg\\\nate disable --yes\n")).toBe("shell-admin");
  expect(pregateControlCause("pregate `\n  disable --yes\n")).toBe("shell-admin");
  expect(pregateControlCause('pregate "$verb" --yes')).toBe("shell-admin");
  expect(pregateControlCause("pregate preset compile")).toBe("shell-admin");
  expect(pregateControlCause("pregate preset apply loosen.json --yes")).toBe("shell-admin");
  expect(pregateControlCause("pregate preset apply loosen.json --preview")).toBeNull();
  expect(pregateControlCause("pregate init --yes")).toBe("shell-admin");
  expect(pregateControlCause("pregate promote --yes")).toBe("shell-admin");
  expect(pregateControlCause("pregate feedback apply x --yes")).toBe("shell-admin");
  expect(pregateControlCause("pregate storage apply x --yes")).toBe("shell-admin");
  expect(pregateControlCause("pregate issue submit x --yes")).toBe("shell-admin");
  expect(pregateControlCause("export PREGATE_UNATTENDED_APPROVAL=1")).toBe("hook-switch");
  expect(pregateControlCause("rm ~/.local/share/pregate/consent/*.json")).toBe("hook-switch");
  expect(pregateControlCause("pregate preset show")).toBeNull();
  expect(pregateControlCause("echo pregate is \\\nfine")).toBeNull();
});

test("a script file is decoded from UTF-16 and UTF-32, and undecodable text fails closed", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-control-"));
  const utf16 = (text: string, bom: boolean) => Buffer.concat([bom ? Buffer.from([0xff, 0xfe]) : Buffer.alloc(0), Buffer.from(text, "utf16le")]);
  writeFileSync(join(dir, "le.ps1"), utf16("pregate disable --yes\r\n", true));
  writeFileSync(join(dir, "be.ps1"), Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from("pregate uninstall\r\n", "utf16le").swap16()]));
  writeFileSync(join(dir, "plain.ps1"), utf16("pregate disable --yes\r\n", false));
  writeFileSync(join(dir, "ok.ps1"), utf16("Write-Output hello\r\n", true));
  writeFileSync(join(dir, "odd.ps1"), Buffer.from([0x70, 0, 0x72, 0, 0, 1, 2, 3, 0, 0, 0xff, 0, 0x13]));
  expect(controlInFile(join(dir, "le.ps1"))).toBe("shell-admin");
  expect(controlInFile(join(dir, "be.ps1"))).toBe("hook-switch");
  expect(controlInFile(join(dir, "plain.ps1"))).toBe("shell-admin");
  expect(controlInFile(join(dir, "ok.ps1"))).toBeNull();
  expect(controlInFile(join(dir, "odd.ps1"))).toBe("shell-admin");
  expect(controlInFile("/bin/ls")).toBeNull();
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
  for (const command of ['bash "$SCRIPT"', 'sh "$X"', 'bash < "$S"', 'python3 "$P"', 'node "$P"', 'make -f "$F"', 'powershell -File $P']) {
    expect(guard(command, dir, ctx), command).toBe("shell-write");
  }
  writeFileSync(join(dir, "attack.py"), "import subprocess\nsubprocess.run(['pregate','approve','x'])\n");
  expect(guard("python3 attack.py", dir, ctx)).toBe("shell-admin");
  expect(guard("python3 -c \"print(1 + 1)\"", dir, ctx)).toBeNull();
  expect(guard("node -e \"console.log(1)\"", dir, ctx)).toBeNull();
});

test("a bare command name is resolved on PATH and scanned when the file is a script", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-path-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const file = join(bin, process.platform === "win32" ? "deploy.cmd" : "deploy");
  writeFileSync(file, process.platform === "win32" ? "@echo pregate uninstall\r\n" : "#!/bin/sh\npregate uninstall\n");
  if (process.platform !== "win32") chmodSync(file, 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${saved ?? ""}`;
  try {
    expect(guard("deploy", dir, ctx)).toBe("hook-switch");
    writeFileSync(file, process.platform === "win32" ? "@echo hello\r\n" : "#!/bin/sh\necho hello\n");
    expect(guard("deploy", dir, ctx)).toBeNull();
    expect(guard("ls", dir, ctx)).toBeNull();
  } finally {
    if (saved === undefined) delete process.env.PATH;
    else process.env.PATH = saved;
  }
});
