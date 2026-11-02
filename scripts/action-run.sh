#!/usr/bin/env bash
# Commands for the composite action. Each mode has its own default. check scans the
# tree. audit takes no extra flags (it rejects --all). ratchet is check --ratchet and
# stops before running when base is empty, including when a SARIF path is set.
set -euo pipefail

mode=${PREGATE_MODE:-check}
base=${PREGATE_BASE:-}
args=${PREGATE_ARGS:-}
sarif=${PREGATE_SARIF:-}

case "$mode" in
  check|audit|ratchet) ;;
  *)
    echo "action-run: unknown mode '$mode' (expected check, audit or ratchet)" >&2
    exit 2
    ;;
esac

if [ "$mode" = "ratchet" ] && [ -z "$base" ]; then
  echo "action-run: mode ratchet requires the base input (a git ref or SHA). Nothing was checked." >&2
  exit 1
fi

# An empty args input means the mode default, not a flag the caller typed.
if [ -z "$args" ] && [ "$mode" = "check" ]; then
  args="--all"
fi

if [ "$mode" = "ratchet" ]; then
  if [ -n "$sarif" ]; then
    pregate check --ratchet --base "$base" --format sarif > "$sarif"
  else
    pregate check --ratchet --base "$base"
  fi
elif [ "$mode" = "audit" ]; then
  if [ -n "$sarif" ]; then
    # shellcheck disable=SC2086
    pregate audit $args --sarif > "$sarif"
  else
    # shellcheck disable=SC2086
    pregate audit $args
  fi
else
  if [ -n "$sarif" ]; then
    # shellcheck disable=SC2086
    pregate check $args --format sarif > "$sarif"
  else
    # shellcheck disable=SC2086
    pregate check $args
  fi
fi
