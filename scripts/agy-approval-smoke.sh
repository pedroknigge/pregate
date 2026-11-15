#!/bin/sh
# Manual smoke for agy's force_ask approval prompt. CI does not run this.
# A live prompt needs a signed-in interactive agy, which the automated tests do not have.
# The release-binary fixture in test/approve-in-harness.e2e.test.ts checks the JSON shape
# and the skip-permissions path. This script is the check against a real agy.
# Usage: sh scripts/agy-approval-smoke.sh
set -eu

cat <<'EOF'
agy approval smoke (manual)

1. In a project with a pending review, start an interactive agy session.
   Do not pass --dangerously-skip-permissions, -p, --print, or --prompt.
   Saved toolPermission must not be always-proceed, and the preset must not be Turbo.
2. Have the agent propose the literal command from the review:
   pregate approve <code>
   or: pregate approve --yes --digest <sha>
3. The card is force_ask. The reason starts with the review summary and includes
   "Accept runs this command. Reject runs nothing." and a Mode line.
   Accept runs that command. Reject runs nothing. The hook does not apply the contract.
4. After Accept, contract-approvals/log.jsonl records via "yes" and tty false.
   A native click cannot be told from the command, so the log does not use another via.
5. Repeat with Reject. The pending review stays. No preset is written by the hook.
6. No-stall: run the same proposal under
   agy --dangerously-skip-permissions -p "propose pregate approve <code>"
   and under a saved toolPermission of always-proceed.
   The hook returns immediately with empty stdout. It does not emit force_ask,
   and it does not wait for a person. The in-harness allow from that mode still applies.
7. sh -c, a script, a subshell, and a pipe into approve stay denied.

EOF

if command -v agy >/dev/null 2>&1; then
  echo "agy on PATH: $(agy --version 2>/dev/null || agy version 2>/dev/null || echo present)"
else
  echo "agy is not on PATH. Install it, sign in, then follow the steps above."
fi
