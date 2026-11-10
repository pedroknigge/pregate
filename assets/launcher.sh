#!/bin/sh
# PREGATE launcher (ARCHITECTURE §4.0, MULTI-HARNESS MH-15, MH-18, MH-19). `pregate setup` writes it as
# <DATA>/bin/pregate with the engine version below, and every registered hook execs it. For hook
# events it is the only fail-closed for what the engine cannot report itself: a missing engine, a
# crash, SIGKILL/OOM, a hang, or an exit outside the protocol.

version=@ENGINE_VERSION@
# The launcher's own commands run on a PATH the harness cannot empty or shadow; the engine gets the
# caller's, since it runs git, which may live in /opt/homebrew/bin.
path=$PATH
PATH=/usr/bin:/bin
# The engines sit next to the launcher, in <DATA>/<v>/pregate, and not where the environment of the
# moment says (MH-18). The CLI on the PATH, ~/.local/bin/pregate, is a symlink to the launcher.
self=$0
[ -L "$self" ] && self=$(readlink "$self")
data=${self%/*/*}

has_consent() {
  for record in "$data/consent/"*.json; do [ -f "$record" ] && return 0; done
  for record in "$data/proposals/"*.json; do [ -f "$record" ] && return 0; done
  return 1
}

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
    # An unavailable Git identity cannot make a consenting root fail open when the engine fails.
    if [ -n "$records" ]; then
      printf '%s' "$records" | grep -qF '"disabled":true' && return 1
      { [ -n "$unknown" ] || printf '%s' "$records" | grep -qF "\"common\":\"$g\""; } && return 0
    fi
    # Repository consent covers every worktree top of that repository.
    [ -z "$unknown" ] && [ -e "$d/.git" ] && [ "$g" != "$r" ] && grep -qF "{\"repo\":\"$g\"}" "$data/consent/"*.json 2>/dev/null && return 0
    # An initial review has no consent record. The engine validates proposal expiry; if the engine
    # is unavailable, protect the review conservatively until its stored candidate is removed.
    grep -qF "\"root\":\"$r\"," "$data/proposals/"*.json 2>/dev/null && return 0
    [ -e "$d/.git" ] && return 1
    d=${d%/*}
  done
  return 1
}

# An empty engine would run as an empty script: exit 0, which allows in four harnesses and passes a
# pre-commit.
installed() {
  [ -x "$data/$1/pregate" ] && [ -s "$data/$1/pregate" ]
}

# check, explain, setup…: unsupervised, since pre-commit may exceed 5 s and exit 1 is legitimate.
[ $# -eq 0 ] && [ -t 0 ] && [ -t 1 ] && [ -z "${CI:-}" ] && set -- guide
if [ $# -gt 0 ] && [ "$1" != hook ]; then
  PATH=$path
  installed "$version" && exec "$data/$version/pregate" "$@"
  printf '%s\n' "PREGATE: engine $version is not installed; reinstall PREGATE" >&2
  exit 1
fi
# Registered hooks always name their event; a bare call is a person or a script, kept on `hook auto`.
bare= hint="pregate: no command. Run pregate in a terminal for the guide, or pregate --help."
[ $# -eq 0 ] && bare=1 && set -- hook auto
[ -n "$bare" ] && [ -t 0 ] && printf '%s\n' "$hint" >&2 && exit 0
event=$2
# SessionStart reaches the engine without consent: its dormant notice is for users with no project yet.
# Stop does once a session reached a consented root, so it can warn when consent was removed.
has_consent || [ -n "$bare" ] || [ "$event" = session-start ] || { [ "$event" = stop ] && [ -f "$data/reached" ]; } || exit 0
# Stop and SessionStart fail closed only in Claude Code: elsewhere Pre already blocks, and pre-commit
# and CI cover the rest. Cursor and Grok run the same registration, flagged claude-code (MH-04).
claude=
[ "${4:-claude-code}" = claude-code ] && [ -z "${GROK_HOOK_EVENT:-}" ] && [ -z "${CURSOR_VERSION:-}" ] && claude=1

# fd 3 keeps the caller's stdin (background jobs otherwise get /dev/null). fd 4 keeps the caller's
# stderr; the shell's own stderr goes to /dev/null so job notices ("Killed: 9") never reach the harness.
# Children close fd 4: one that outlives the launcher would hold the harness pipe open.
exec 3<&0 4>&2 2>/dev/null

# $1 = agent reason, $2 = human reason, $3 = what the human should
# check (default: the installation). Prints the event's fail-closed output and exits. Pre is the same
# in the five harnesses: exit 2 with stdout empty and one stderr line (Grok shows only the first one,
# cut at 256 characters).
fail_closed() {
  trap '' USR1 USR2 TERM HUP
  active=
  for candidate in "${CLAUDE_PROJECT_DIR:-}" "${CURSOR_PROJECT_DIR:-}" "${GROK_WORKSPACE_ROOT:-}" "$PWD"; do
    consented "$candidate" && active=1 && break
  done
  if [ -z "$active" ] && [ -f "$tmp/in" ]; then
    candidate=$(sed -n 's/.*"workspacePaths":\["\([^"\\]*\)".*/\1/p' "$tmp/in")
    consented "$candidate" && active=1
  fi
  # An engine redirects only for a root with an approved lock: the call is a project's, also when
  # the session started in a folder above it that has none.
  [ -z "${routed:-}" ] || active=1
  [ -n "$active" ] || exit 0
  hint=${3:-"Check the installation (pregate doctor)."}
  case $event in
  stop)
    [ -n "$claude" ] || exit 0
    if grep -q '"stop_hook_active" *: *true' "$tmp/in"; then
      printf '{"systemMessage":"PREGATE could not verify this turn: %s. %s"}\n' "$2" "$hint"
      exit 0
    fi
    why="PREGATE could not verify this turn: $1; report it to the user"
    printf '{"decision":"block","reason":"%s"}\n' "$why" ;;
  session-start)
    [ -z "$claude" ] || printf '{"systemMessage":"PREGATE could not prepare this session: %s. %s"}\n' "$2" "$hint"
    exit 0 ;;
  *) why="PREGATE could not evaluate: $1; report it to the user" ;;
  esac
  printf '%.256s\n' "$why" >&4
  exit 2
}

# Consume the same bounded protocol as the Bun supervisor. A stack distinguishes
# an individual evaluation from shared resolution nested inside it.
simple_import_rules() {
  import_ids=$1
  case $import_ids in *,more=*)
    import_more=${import_ids##*,more=}
    case $import_more in ''|*[!0123456789]*|0*) return 1 ;; esac
    import_ids=${import_ids%,more=*} ;;
  esac
  [ "$import_ids" != none ] || return 0
  import_count=0
  while :; do
    import_id=${import_ids%%,*}
    import_count=$((import_count + 1))
    [ "$import_count" -le 8 ] && [ "${#import_id}" -le 256 ] || return 1
    import_ns=${import_id%%/*}
    import_rest=${import_id#*/}
    [ "$import_ns" != "$import_id" ] || return 1
    case $import_ns in [abcdefghijklmnopqrstuvwxyz]*) ;; *) return 1 ;; esac
    case $import_ns in *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) return 1 ;; esac
    import_name=${import_rest%%/*}
    case $import_name in [ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]*) ;; *) return 1 ;; esac
    case $import_name in *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-]*) return 1 ;; esac
    if [ "$import_name" != "$import_rest" ]; then
      import_leaf=${import_rest#*/}
      case $import_leaf in [abcdefghijklmnopqrstuvwxyz]*) ;; *) return 1 ;; esac
      case $import_leaf in *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) return 1 ;; esac
    fi
    [ "$import_ids" != "$import_id" ] || return 0
    import_ids=${import_ids#*,}
  done
}

checkpoint_only() {
  checkpoint_bytes=0
  checkpoint_line=
  while IFS= read -r checkpoint_line; do
    case $checkpoint_line in
    'PREGATE-CHECKPOINT input'|'PREGATE-CHECKPOINT admission'|'PREGATE-CHECKPOINT parse'|'PREGATE-CHECKPOINT rules'|'PREGATE-CHECKPOINT dependency-review'|'PREGATE-CHECKPOINT stop-inventory')
      ;;
    'PREGATE-IMPORT-REVIEW rules='*)
      simple_import_rules "${checkpoint_line#PREGATE-IMPORT-REVIEW rules=}" || return 1 ;;
    'PREGATE-IMPORT-REVIEW completed='*ms)
      import_time=${checkpoint_line#PREGATE-IMPORT-REVIEW completed=}
      import_time=${import_time%ms}
      import_whole=${import_time%.*}
      [ "$import_whole" != "$import_time" ] || return 1
      case $import_whole in ''|*[!0123456789]*) return 1 ;; esac
      case ${import_time##*.} in [0123456789]) ;; *) return 1 ;; esac ;;
    *) return 1 ;;
    esac
    checkpoint_bytes=$((checkpoint_bytes + ${#checkpoint_line} + 1))
  done <"$tmp/err"
  # Count only successful reads with LF; NUL truncation and unterminated bytes fall back.
  [ -z "$checkpoint_line" ] && [ "$checkpoint_bytes" -eq "$1" ]
}

# The engine writes its progress to fd 5 ($tmp/trace) so a clean stderr needs no filtering; an
# engine pinned by an older lock still writes it to stderr, which clean mode separates.
progress_output() {
  src=$tmp/err
  [ "$1" != clean ] && [ -s "$tmp/trace" ] && src=$tmp/trace
  [ -f "$src" ] || return
  bytes=0
  if [ "$1" = clean ]; then
    bytes=$(wc -c <"$tmp/err") || return
    checkpoint_only "$bytes" && return
    : >"$tmp/progress-select" || return
  fi
  # Classify a same-length copy; NUL is never a valid protocol character.
  LC_ALL=C tr '\000' '?' <"$src" >"$tmp/progress" || return
  LC_ALL=C awk -v mode="$1" -v bytes="$bytes" -v select="$tmp/progress-select" -v tail="$tmp/progress-tail" '
    function rule(id) { return length(id) <= 256 && id ~ /^[a-z][a-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*(\/[a-z][a-z0-9-]*)?$/ }
    function consume(line, id, value) {
      if (line ~ /^PREGATE-CHECKPOINT (input|admission|parse|rules|dependency-review|stop-inventory)$/) {
        stage = substr(line, 20); depth = 0; return 1
      }
      if (line ~ /^PREGATE-IMPORT-REVIEW rules=((none|[a-z][a-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*(\/[a-z][a-z0-9-]*)?(,[a-z][a-z0-9-]*\/[A-Za-z][A-Za-z0-9-]*(\/[a-z][a-z0-9-]*)?)*)(,more=[1-9][0-9]*)?)$/) {
        rules = substr(line, 29); duration = ""; return 1
      }
      if (line ~ /^PREGATE-IMPORT-REVIEW completed=[0-9]+\.[0-9]ms$/) { duration = substr(line, 33, length(line)-34); return 1 }
      if (line ~ /^PREGATE-RULE started=/ && rule(id = substr(line, 22))) {
        kinds[++depth] = "rule"; ids[depth] = id; return 1
      }
      if (line ~ /^PREGATE-RULE completed=/) {
        value = substr(line, 24); id = value; sub(/ .*/, "", id)
        if (rule(id) && substr(value, length(id)+1) ~ /^ [0-9]+\.[0-9]ms$/) {
          if (depth && kinds[depth] == "rule" && ids[depth] == id) depth--; return 1
        }
      }
      if (line == "PREGATE-RESOLUTION started") { kinds[++depth] = "resolution"; return 1 }
      if (line ~ /^PREGATE-RESOLUTION completed=[0-9]+\.[0-9]ms$/) {
        if (depth && kinds[depth] == "resolution") depth--; return 1
      }
      return 0
    }
    {
      original = $0; offset += length(original)+1; line = original; sub(/\r$/, "", line)
      if (!consume(line) && mode == "clean") {
        if (offset <= bytes) printf "%dp\n", NR > select
        else tail_bytes = length(original)
      }
    }
    END {
      if (mode == "clean") { printf "%d\n", tail_bytes > tail; exit }
      if (mode != "detail") exit
      if (stage != "") printf "; last engine checkpoint: %s", stage
      if (depth && kinds[depth] == "rule") printf "; executing rule: %s", ids[depth]
      else if (depth && kinds[depth] == "resolution") printf "; executing shared dependency resolution"
      if (stage == "dependency-review" && rules != "") {
        printf "; shared import review: %s", rules
        if (duration != "") printf " (%s ms)", duration
      }
    }
  ' "$tmp/progress" || return
  if [ "$1" = clean ]; then
    # Only numeric record addresses reach sed; stderr is copied from the original.
    LC_ALL=C sed -n -f "$tmp/progress-select" "$tmp/err" || return
    IFS= read -r tail_bytes <"$tmp/progress-tail" || return
    # Copy an unterminated final record separately so sed cannot add an EOF newline.
    [ "$tail_bytes" -eq 0 ] || tail -c "$tail_bytes" "$tmp/err"
  fi
}
progress_detail() { progress_output detail; }

timed_out() {
  detail=$(progress_detail)
  fail_closed "the engine timed out after $deadline s$detail" "the engine timed out after $deadline s$detail" \
    "Inspect pregate preset diagnose --json and pregate doctor. A checkpoint is not proof of the cause."
}

# The deadline does not depend on `wait` returning: a trapped signal interrupts `wait`, so the
# output arrives even if the engine survives SIGKILL (e.g. stuck in uninterruptible I/O).
arm() {
  [ -z "$timer" ] || kill "$timer"
  deadline=$1
  (sleep "$1"; kill -s USR1 $$) </dev/null >/dev/null 3<&- 4>&- &
  timer=$!
}

# Runs the engine of version $1 on fd 3 with the remaining arguments; rc = its exit. Its
# stdout and stderr go to files: a killed engine's surviving children must not hold the harness pipes
# open past the deadline.
run() {
  e=$data/$1/pregate
  shift
  PREGATE_LAUNCHER_PID=$$ PREGATE_PROGRESS=1 PREGATE_PROGRESS_FD=5 PATH=$path "$e" "$@" <&3 >"$tmp/out" 2>"$tmp/err" 5>"$tmp/trace" 3<&- 4>&- &
  pid=$!
  while :; do
    extended=
    wait $pid
    rc=$?
    [ -n "$extended" ] || break
  done
}

pid= timer= tmp=
# A timer left behind would later signal whatever process reuses the launcher's PID. The temp dir
# is removed in the background so the harness does not wait for one more process.
trap '[ -z "$timer" ] || kill "$timer"; [ -z "$tmp" ] || rm -rf "$tmp" </dev/null >/dev/null 3<&- 4>&- &' EXIT
# Cancelled by the harness: kill the engine and deny all the same, since Codex lets the tool run on
# an exit 2 without stderr.
trap 'kill -s KILL $pid; fail_closed "the harness cancelled it" "the harness cancelled it"' TERM HUP
trap 'timer=; kill -s KILL $pid; timed_out' USR1
trap 'extended=1; arm 95' USR2
# Pre: 5 s (O30). The deadline is wall time, and parallel calls on a machine with few cores share
# its CPU; the registered timeouts (30 s, 60 s, 15 s) only cover a launcher that is slow to start.
case $event in
stop) arm 45 ;;
session-start) arm 10 ;;
*) arm 5 ;;
esac

tmp=$(mktemp -d "${TMPDIR:-/tmp}/pregate.XXXXXX") || fail_closed "no temporary directory" "no temporary directory"

# Explicit Pre goes straight to the engine. Only a redirect needs replay: the engine returns the
# original input after its version line. Stop/auto still need their input before a failure.
if [ "$event" != pre ]; then
  cat <&3 >"$tmp/in" 3<&- 4>&- &
  pid=$!
  wait $pid || fail_closed "stdin could not be read" "stdin could not be read"
  pid=
  exec 3<"$tmp/in"
fi
# Empty input is no hook payload: a bare call without one gets a hint and no decision. Byte
# classes: in a UTF-8 locale an undecodable byte or U+00A0 would count as blank and skip the deny.
if [ -n "$bare" ] && ! LC_ALL=C grep -q '[^[:space:]]' "$tmp/in"; then
  printf '%s\n' "$hint" >&4
  exit 0
fi
[ -n "$bare" ] && ! has_consent && exit 0
# hook_event_name can also appear inside tool_input, so only a single occurrence is trusted. Two on
# one line print nothing and two on separate lines print two words: either way the event is Pre.
if [ "$event" = auto ]; then
  case $(sed -n '/"hook_event_name".*"hook_event_name"/q; s/.*"hook_event_name" *: *"\([A-Za-z]*\)".*/\1/p' "$tmp/in") in
  Stop) event=stop; arm 45 ;;
  SessionStart) event=session-start; arm 10 ;;
  *) event=pre ;;
  esac
fi

installed "$version" || fail_closed "engine $version is not installed; reinstall PREGATE" "engine $version is not installed" "Reinstall PREGATE."
run "$version" "$@"
# MH-19: exit 3 with one version on stdout is "run the engine that the lock of this call's root
# pins". Once, on the same stdin, within the same deadline.
if [ $rc = 3 ]; then
  routed=1
  IFS= read -r v <"$tmp/out" || v=
  case $v in *[!0-9A-Za-z.-]*) v= ;; esac
  printf '%s\n' "$v" | grep -Eqx '[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?' \
    || fail_closed "the engine named no valid version to run (exit 3)" "the engine named no valid version"
  installed "$v" || fail_closed "engine $v is not installed: run \`pregate update --engine $v\`" \
    "engine $v is not installed" "Run pregate update --engine $v."
  # Explicit Pre's input has been consumed; the redirecting engine returns it verbatim.
  if [ "$2" = pre ]; then
    tail -n +2 "$tmp/out" >"$tmp/in" || fail_closed "stdin could not be replayed" "stdin could not be replayed"
    grep -Eq '^[[:space:]]*\{' "$tmp/in" || fail_closed "the engine returned no valid input to replay" "the engine returned no valid input"
  fi
  exec 3<"$tmp/in"
  run "$v" "$@"
  [ $rc = 3 ] && fail_closed "engine $v redirected again (exit 3)" "engine $v redirected again"
fi
# A timer or a cancellation arriving now must not append a second output after the engine's.
trap '' USR1 USR2 TERM HUP

case $rc in
0|2)
  cleanerr="$tmp/cleanerr"
  # An allowed call leaves stderr empty: nothing to separate, no extra process.
  if [ -s "$tmp/err" ]; then
    progress_output clean >"$cleanerr" || fail_closed "engine progress could not be read" "engine progress could not be read"
  fi
  # Codex runs the tool on an exit 2 whose stderr is empty (MH-15).
  [ $rc = 0 ] || grep -q '[^[:space:]]' "$cleanerr" || fail_closed "the engine denied without a reason" "the engine denied without a reason"
  [ -s "$tmp/out" ] && cat "$tmp/out"
  [ -s "$cleanerr" ] && cat "$cleanerr" >&4
  exit $rc ;;
esac
detail=$(progress_detail)
fail_closed "the engine failed (exit $rc)$detail" "the engine failed (exit $rc)$detail"
