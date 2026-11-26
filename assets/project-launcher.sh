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

uncertainty_open() {
  u=$(cd "$1" 2>/dev/null && pwd -P) || return 0
  while [ "${u#/}" != "$u" ]; do
    if [ -f "$u/.pregate/preset.json" ]; then
      grep -Eq '"uncertainty"[[:space:]]*:[[:space:]]*"closed"' "$u/.pregate/preset.json" && return 1
      return 0
    fi
    [ -e "$u/.git" ] && return 0
    u=${u%/*}
  done
  return 0
}

# Same consent records as the global launcher. 0 means this directory is enforced.
consented() {
  d=$(cd "$1" 2>/dev/null && pwd -P) || return 1
  while [ "${d#/}" != "$d" ]; do
    unknown=1
    g=$(PATH=/usr/bin:/bin:$path git -C "$d" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
    if [ -n "$g" ]; then
      g=$(cd "$g" 2>/dev/null && pwd -P)
      [ -n "$g" ] && unknown=
    else
      g=$d
    fi
    r=$(printf '%s' "$d" | sed 's/\\/\\\\/g;s/"/\\"/g')
    g=$(printf '%s' "$g" | sed 's/\\/\\\\/g;s/"/\\"/g')
    records=$(grep -hF "\"root\":\"$r\"," "$data/consent/"*.json 2>/dev/null)
    if [ -n "$records" ]; then
      printf '%s' "$records" | grep -qF '"disabled":true' && return 1
      grep -hF "\"repo\":\"$g\"" "$data/consent/"*.json 2>/dev/null | grep -qF '"disabled":true' && return 1
      { [ -n "$unknown" ] || printf '%s' "$records" | grep -qF "\"common\":\"$g\""; } && return 0
    fi
    [ -z "$unknown" ] && [ -e "$d/.git" ] && [ "$g" != "$r" ] && grep -qF "{\"repo\":\"$g\"}" "$data/consent/"*.json 2>/dev/null && return 0
    grep -qF "\"root\":\"$r\"," "$data/proposals/"*.json 2>/dev/null && return 0
    [ -e "$d/.git" ] && return 1
    d=${d%/*}
  done
  return 1
}

fail_closed() {
  active= root=
  for candidate in "${CLAUDE_PROJECT_DIR:-}" "${CURSOR_PROJECT_DIR:-}" "${GROK_WORKSPACE_ROOT:-}" "$PWD"; do
    [ -n "$candidate" ] && [ -f "$candidate/.pregate/pregate.lock.json" ] && active=1 && root=$candidate && break
  done
  [ -n "$active" ] || exit 0
  if uncertainty_open "$root"; then
    [ "$hook_event" = pre ] && [ "$hook_harness" = cursor ] && printf '%s\n' '{"permission":"allow"}'
    exit 0
  fi
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

hook_event=${2:-} hook_harness=${4:-}
# Pre decides enforcement before the engine exists. A checkout where pregate enable never ran,
# and one where pregate disable ran, exits 0 here. onFailure cannot block a hook that exits 0
# with empty stdout. An enabled project, including one with uncertainty open, still starts the
# engine. A payload path inside an enforced root starts it too. A probe that fails before any
# candidate was enforced exits 0.
if [ "$hook_event" = pre ]; then
  enforced=
  for candidate in "${CLAUDE_PROJECT_DIR:-}" "${CURSOR_PROJECT_DIR:-}" "${GROK_WORKSPACE_ROOT:-}" "$PWD"; do
    [ -n "$candidate" ] && consented "$candidate" && enforced=1 && break
  done
  if [ -z "$enforced" ]; then
    pre_in=$(mktemp 2>/dev/null) || exit 0
    cat > "$pre_in" || { rm -f "$pre_in"; exit 0; }
    pre_candidates=$(mktemp 2>/dev/null) || { rm -f "$pre_in"; exit 0; }
    sed -n 's/.*"workspacePaths":\["\([^"\\]*\)".*/\1/p' "$pre_in" >>"$pre_candidates" 2>/dev/null
    grep -oE '"(cwd|workspaceRoot|workspace_root|file_path|filePath|TargetFile|Path|Cwd)"[[:space:]]*:[[:space:]]*"[^"\\]*"' "$pre_in" 2>/dev/null \
      | sed -n 's/.*"\([^"\\]*\)"$/\1/p' >>"$pre_candidates"
    while IFS= read -r candidate; do
      [ -n "$candidate" ] && consented "$candidate" && enforced=1 && break
    done <"$pre_candidates"
    rm -f "$pre_candidates"
    if [ -z "$enforced" ]; then
      rm -f "$pre_in"
      # Cursor's native preToolUse treats empty stdout as a failure when failClosed is set.
      [ "$hook_harness" = cursor ] && printf '%s\n' '{"permission":"allow"}'
      exit 0
    fi
    exec 0< "$pre_in" || { rm -f "$pre_in"; exit 0; }
    rm -f "$pre_in"
  fi
fi
[ -n "$version" ] || fail_closed pre "the lock names no valid engine version"
installed || fail_closed pre "engine $version is not installed; run pregate prepare"
PATH=$path
exec "$data/$version/pregate" --supervise "$data" "$version" "$@"
