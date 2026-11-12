#!/bin/sh
# Project launcher: resolves the lock's engine in <DATA>/<version>/ and never falls back to the
# global PATH launcher. Hook calls use the engine's --supervise path (same protocol as the global
# installation). Run `pregate prepare` to verify and cache the pinned engine before hooks run.

path=$PATH
PATH=/usr/bin:/bin
self=$0
[ -L "$self" ] && self=$(readlink "$self")
root=${self%/.pregate/bin/*}
lock=$root/.pregate/pregate.lock.json
version=$(sed -n 's/.*"engine"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$lock" 2>/dev/null | head -1)
case $version in *[!0-9A-Za-z.-]*) version= ;; esac
printf '%s\n' "$version" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?' || version=

home=${HOME:-$USERPROFILE}
if [ -n "${XDG_DATA_HOME:-}" ]; then
  data=$XDG_DATA_HOME/pregate
elif [ -n "${LOCALAPPDATA:-}" ]; then
  data=$LOCALAPPDATA/pregate
else
  data=$home/.local/share/pregate
fi

installed() {
  [ -n "$version" ] && [ -x "$data/$version/pregate" ] && [ -s "$data/$version/pregate" ]
}

fail_closed() {
  active=
  for candidate in "${CLAUDE_PROJECT_DIR:-}" "${CURSOR_PROJECT_DIR:-}" "${GROK_WORKSPACE_ROOT:-}" "$PWD"; do
    [ -n "$candidate" ] && [ -f "$candidate/.pregate/pregate.lock.json" ] && active=1 && break
  done
  [ -n "$active" ] || exit 0
  hint=${2:-"Run pregate prepare in this project, then pregate doctor."}
  case ${1:-pre} in
  stop)
    printf '{"decision":"block","reason":"PREGATE could not verify this turn: %s; report it to the user"}\n' "$hint"
    exit 2 ;;
  session-start)
    printf '{"systemMessage":"PREGATE could not prepare this session: %s. %s"}\n' "$hint" "$hint"
    exit 0 ;;
  post-invocation)
    exit 0 ;;
  *) why="PREGATE could not evaluate: $hint; report it to the user" ;;
  esac
  printf '%.256s\n' "$why" >&2
  exit 2
}

# check, explain, preset show…: unsupervised, no global fallback.
[ $# -eq 0 ] && [ -t 0 ] && [ -t 1 ] && [ -z "${CI:-}" ] && set -- guide
if [ $# -gt 0 ] && [ "$1" != hook ]; then
  PATH=$path
  [ -n "$version" ] || { printf '%s\n' "PREGATE: this project has no readable engine pin in .pregate/pregate.lock.json" >&2; exit 1; }
  installed || { printf '%s\n' "PREGATE: engine $version is not installed; run pregate prepare" >&2; exit 1; }
  exec "$data/$version/pregate" "$@"
fi

[ -n "$version" ] || fail_closed pre "the lock names no valid engine version"
installed || fail_closed pre "engine $version is not installed; run pregate prepare"
PATH=$path
exec "$data/$version/pregate" --supervise "$data" "$version" "$@"
