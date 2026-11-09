// Contract model of Grok PreToolUse supervision for tests — NOT the real Grok binary.
// Baseline fail-open semantics match the official docs:
// https://docs.x.ai/build/features/hooks and xai-org/grok-build 10-hooks.md (main mirror, 2026-11).
// failClosed-on-crash/timeout for >= 1.0.71 is unverified in that public mirror; this fixture follows
// the expected semantics described in third-party release notes (vibecoding.cz weekly 2026-w44) and
// the Skillsaw hook linter (handler failClosed / fail_closed boolean).

export interface PreHandler {
  type: string;
  command: string;
  timeout?: number;
  failClosed?: boolean;
}

export interface GateOutcome {
  denied: boolean;
  exitCode: number | null;
  signal: string | null;
}

export function grokPreToolUseGate(handler: PreHandler, stdin: string, env: Record<string, string> = {}): GateOutcome {
  const timeoutMs = (handler.timeout ?? 5) * 1000;
  const p = Bun.spawnSync(["sh", "-c", handler.command], {
    env, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: timeoutMs,
  });
  const stdout = p.stdout.toString();
  const code = p.exitCode;
  const signal = p.signalCode ?? null;
  if (code === 0) {
    try {
      const o = JSON.parse(stdout) as { decision?: string; hookSpecificOutput?: { permissionDecision?: string } };
      if (o.decision === "deny" || o.hookSpecificOutput?.permissionDecision === "deny") {
        return { denied: true, exitCode: code, signal };
      }
    } catch { /* empty or non-JSON stdout ⇒ allow */ }
    return { denied: false, exitCode: code, signal };
  }
  if (code === 2) return { denied: true, exitCode: code, signal };
  const failed = code !== 0 || signal !== null;
  if (failed && handler.failClosed === true) return { denied: true, exitCode: code, signal };
  return { denied: false, exitCode: code, signal };
}
