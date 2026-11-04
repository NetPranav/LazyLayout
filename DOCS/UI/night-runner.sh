#!/usr/bin/env bash
# Unattended overnight runner for DOCS/UI/PARALLEL_BUILD.md (Wave 1, then Wave 2).
# Launch from the repo root: AGY="agy --dangerously-skip-permissions --output-format text" nohup bash DOCS/UI/night-runner.sh > DOCS/UI/handoffs/logs/night-runner.log 2>&1 &
# It uses only Antigravity workers (no Claude tokens). It never commits, never pushes.
# Stop it at any time: touch DOCS/UI/handoffs/logs/STOP
cd "E:/Projects/magnm related/lazy layout" || exit 1
: "${AGY:?AGY must hold the agy command with its flags}"

LOGS=DOCS/UI/handoffs/logs
STATUS=$LOGS/night-status.txt
STOPFILE=$LOGS/STOP
MAX_PARALLEL=3
QUOTA_SLEEP=1800          # 30 min between retries when the quota error appears
MAX_QUOTA_RETRIES=40      # about 20 hours of waiting per lane
MAX_PLAIN_RETRIES=3       # a run that ended without a handoff and without a quota error
ATTEMPT_CAP=10800         # kill an attempt after 3 hours
MASS_REWRITE_LIMIT=300    # more modified tracked files than this = stop everything
mkdir -p "$LOGS"

say() { echo "$(date '+%F %T') $*" | tee -a "$STATUS"; }

handoff_exists() { ls DOCS/UI/handoffs/2026-11-05-*-"$1".md >/dev/null 2>&1; }
quota_hit() { grep -qE "RESOURCE_EXHAUSTED|429|Individual quota reached" "$1" 2>/dev/null; }
modified_count() { git status --short | grep -v '^??' | wc -l; }

ensure_dev_server() {
  if ! curl -s -o /dev/null --max-time 5 http://localhost:3000/design-system; then
    say "dev server is down: starting it"
    (npm run dev > "$LOGS/devserver-night.log" 2>&1 &)
    for _ in $(seq 1 40); do curl -s -o /dev/null --max-time 5 http://localhost:3000/design-system && break; sleep 5; done
  fi
}

prompt_for() { # $1 = lane id (L5), $2 = task slug
  cat <<EOF
Read .claude/agents/ui-worker.md, then do DOCS/UI/tasks/2026-11-05-$2.md (you are lane $1). A previous run of this lane may have been cut off by a quota error or a hang: the working tree may already hold part of your work (look at git status and git diff for your lane paths, and at DOCS/UI/handoffs/logs). Continue from the current state: do not redo finished work and do not revert anything. Edit only the paths in the task's Lane section. Never run eslint --fix, prettier or any command that rewrites many files, and never run git checkout/stash/reset/add/commit (an earlier run rewrote the line endings of 749 files). Make small targeted edits. Don't stop to ask. Don't commit. The dev server is running on http://localhost:3000 (never start next dev or next build). Run every check in the foreground and never wait on background tasks. Your first action must be an edit or a measurement, not more reading. Write the handoff DOCS/UI/handoffs/2026-11-05-HHMM-$1.md as soon as the work is done, or when you cannot continue (then list exactly what is unfinished), and finish.
EOF
}

run_lane() { # $1 = lane id, $2 = task slug
  local lane=$1 slug=$2 quota=0 plain=0 n=0
  while :; do
    [ -f "$STOPFILE" ] && { say "$lane: STOP file found, giving up"; return 1; }
    handoff_exists "$lane" && { say "$lane: DONE (handoff written)"; return 0; }
    n=$((n+1)); local log="$LOGS/${lane}-night-$n.log"
    say "$lane: attempt $n (quota retries $quota, plain retries $plain)"
    ensure_dev_server
    $AGY --print="$(prompt_for "$lane" "$slug")" > "$log" 2>&1 &
    local pid=$! start; start=$(date +%s)
    while kill -0 "$pid" 2>/dev/null; do
      sleep 20
      [ -f "$STOPFILE" ] && { kill -9 "$pid" 2>/dev/null; say "$lane: stopped by STOP file"; return 1; }
      handoff_exists "$lane" && { sleep 60; kill -9 "$pid" 2>/dev/null; break; }
      if [ $(( $(date +%s) - start )) -gt $ATTEMPT_CAP ]; then kill -9 "$pid" 2>/dev/null; say "$lane: attempt $n hit the $ATTEMPT_CAP s cap, killed"; break; fi
    done
    handoff_exists "$lane" && { say "$lane: DONE (handoff written)"; return 0; }
    if quota_hit "$log"; then
      quota=$((quota+1))
      [ $quota -gt $MAX_QUOTA_RETRIES ] && { say "$lane: quota never came back, giving up"; return 1; }
      say "$lane: quota error, sleeping $QUOTA_SLEEP s"; sleep $QUOTA_SLEEP
    else
      plain=$((plain+1))
      [ $plain -gt $MAX_PLAIN_RETRIES ] && { say "$lane: ended $plain times without a handoff, giving up"; return 1; }
      sleep 30
    fi
  done
}

watchdog() { # stops everything when many tracked files change at once (a mass rewrite)
  while :; do
    sleep 20
    [ -f "$STOPFILE" ] && return
    local c; c=$(modified_count)
    if [ "$c" -gt $MASS_REWRITE_LIMIT ]; then
      say "WATCHDOG: $c modified tracked files (limit $MASS_REWRITE_LIMIT): a worker rewrote many files. Stopping all workers. Nothing was reverted: see DOCS/UI/handoffs/logs/night-status.txt"
      touch "$STOPFILE"; taskkill //IM agy.exe //F >/dev/null 2>&1; return
    fi
  done
}

run_wave() { # args: "L5:L5-motion-timeline" ...
  local running=0 spec
  for spec in "$@"; do
    while [ "$running" -ge $MAX_PARALLEL ]; do wait -n 2>/dev/null; running=$((running-1)); done
    run_lane "${spec%%:*}" "${spec#*:}" &
    running=$((running+1)); sleep 5
  done
  wait
}

: > "$STATUS"
say "night runner started (modified tracked files at start: $(modified_count))"
watchdog &
WD=$!

say "=== Wave 1 ==="
run_wave "L5:L5-motion-timeline" "L1:L1-top-bar" "L3:L3-design-inspector" "L4:L4-canvas" "L2:L2-left-panel" "L7:L7-code-mode" "L6:L6-motion-inspector"

if [ ! -f "$STOPFILE" ]; then
  say "=== Wave 2 ==="
  run_wave "L8:L8-shell-transitions" "L9:L9-design-system-page"
fi

for l in L1 L2 L3 L4 L5 L6 L7 L8 L9; do
  if handoff_exists "$l"; then say "SUMMARY $l: handoff written"; else say "SUMMARY $l: NO handoff (unfinished)"; fi
done
say "night runner finished. Nothing was committed or pushed: review and commit lane by lane in the morning."
kill "$WD" 2>/dev/null
