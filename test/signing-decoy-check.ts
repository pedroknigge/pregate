// Spawned by signing-shim.test.ts with a decoy directory at the front of PATH.
// Proves the offline signer never executes curl, wget, or a cosign discovered on PATH.
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAKE_COSIGN, prepareSigner } from "./signing-tool.ts";

const decoy = mkdtempSync(join(tmpdir(), "pregate-decoy-"));
const log = join(decoy, "log");
for (const name of ["curl", "wget", "cosign"]) {
  writeFileSync(join(decoy, name), `#!/bin/sh\nprintf '%s\\n' ${name} >> ${JSON.stringify(log)}\nexit 99\n`);
  chmodSync(join(decoy, name), 0o755);
}
process.env.PATH = `${decoy}:${process.env.PATH ?? ""}`;

const signer = prepareSigner(join(decoy, "work"));
const file = join(decoy, "payload");
writeFileSync(file, "payload\n");
signer.sign(file);
if (!signer.verify(file).ok) throw new Error("offline verify failed");
if (existsSync(log)) throw new Error(`spawned a PATH tool:\n${readFileSync(log, "utf8")}`);
if (signer.bin !== FAKE_COSIGN) throw new Error(`expected the fixed shim, got ${signer.bin}`);
