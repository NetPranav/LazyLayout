#!/usr/bin/env bash
# Token-free watcher for the overnight run: the ui-watcher checklist as a script.
# Launch next to the runner: AGY="agy --dangerously-skip-permissions --output-format text" nohup bash DOCS/UI/night-watcher.sh > DOCS/UI/handoffs/logs/night-watcher.log 2>&1 &
# When a lane's handoff appears it runs the grep checks, writes DOCS/UI/handoffs/logs/review-<lane>.txt (VERDICT: PASS or FAIL),
# and on FAIL (at most 2 retries per lane) appends a "Retry N" section with the failures to the lane's task file,
# moves the handoff to DOCS/UI/handoffs/superseded/ and relaunches that lane. It never commits and never reverts.
cd "E:/Projects/magnm related/lazy layout" || exit 1
: "${AGY:?AGY must hold the agy command with its flags}"
LOGS=DOCS/UI/handoffs/logs
STATUS=$LOGS/night-status.txt
STOPFILE=$LOGS/STOP
mkdir -p "$LOGS" DOCS/UI/handoffs/superseded
say() { echo "$(date '+%F %T') [watcher] $*" | tee -a "$STATUS"; }

slug_of() { case $1 in L1) echo L1-top-bar;; L2) echo L2-left-panel;; L3) echo L3-design-inspector;; L4) echo L4-canvas;; L5) echo L5-motion-timeline;; L6) echo L6-motion-inspector;; L7) echo L7-code-mode;; L8) echo L8-shell-transitions;; L9) echo L9-design-system-page;; esac; }
D=src/editor/design-system/demos
paths_of() { case $1 in
  L1) echo "src/editor/components/TopBar.tsx src/editor/components/ModeTabs.tsx src/editor/components/LogoMark.tsx src/editor/components/PageSwitcher.tsx src/editor/components/ShipPopover.tsx src/editor/components/ThemeToggle.tsx src/editor/components/topbar-constants.ts $D/TopBarDemos.tsx";;
  L2) echo "src/editor/shell/left-panel $D/LeftPanelDemos.tsx";;
  L3) echo "src/editor/panels/details src/editor/shell/right-panel $D/InspectorDemos.tsx";;
  L4) echo "src/editor/shell/canvas-chrome src/editor/stage $D/CanvasDemos2.tsx";;
  L5) echo "src/editor/panels/timeline src/editor/motion-model $D/TimelineDemos.tsx";;
  L6) echo "src/editor/panels/inspectors src/editor/panels/sequencer $D/MotionInspectorDemos.tsx";;
  L7) echo "src/editor/panels/code-view src/editor/panels/console src/editor/panels/blueprint $D/CodeModeDemos.tsx";;
  L8) echo "src/editor/shell/EditorShell.tsx src/editor/shell/RightPanelConnected.tsx src/editor/styles";;
  L9) echo "src/editor/design-system src/app/design-system src/editor/components/Slider.tsx";;
esac; }

handoff_of() { ls -t DOCS/UI/handoffs/2026-11-05-*-"$1".md 2>/dev/null | head -1; }

review() { # $1 lane -> writes review file, echoes PASS or FAIL
  local lane=$1 out=$LOGS/review-$lane.txt files p f fails=0
  files=""; for p in $(paths_of "$lane"); do [ -e "$p" ] && files="$files $(find "$p" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) 2>/dev/null)"; done
  { echo "REVIEW $lane $(date '+%F %T')"; echo "handoff: $(handoff_of "$lane")"; } > "$out"
  fail() { echo "FAIL: $*" >> "$out"; fails=$((fails+1)); }
  warn() { echo "WARN: $*" >> "$out"; }
  [ -z "$(handoff_of "$lane")" ] && fail "no handoff"
  [ -n "$(handoff_of "$lane")" ] && ! grep -qi "tsc" "$(handoff_of "$lane")" && fail "handoff has no tsc output"
  # off-limits paths (compare with HEAD)
  local off; off=$(git status --short | grep -E "src/(core|compiler|runtime|ai|legacy-editor|after)/|package(-lock)?\.json|next\.config|tsconfig|eslint\.config" | head -5)
  [ -n "$off" ] && fail "off-limits paths changed: $off"
  local mc; mc=$(git status --short | grep -v '^??' | wc -l); [ "$mc" -gt 300 ] && fail "mass rewrite: $mc modified tracked files"
  [ -n "$files" ] || fail "no source files found in the lane paths"
  local hits
  hits=$(grep -nE "(hover|focus|active|md|lg|first|last|group-hover|disabled):ll:|-ll:" $files 2>/dev/null | head -5); [ -n "$hits" ] && fail "variant order: $hits"
  hits=$(grep -nE "ll:[a-z-]*\[|ll:\[" $files 2>/dev/null | grep -v "data-\[" | head -5); [ -n "$hits" ] && fail "arbitrary values: $hits"
  hits=$(grep -n "requestAnimationFrame" $files 2>/dev/null | grep -v "^\S*:[0-9]*:\s*\(//\|\*\|/\*\)" | head -3); [ -n "$hits" ] && fail "raw requestAnimationFrame: $hits"
  hits=$(grep -n "rounded-full" $files 2>/dev/null | head -3); [ -n "$hits" ] && fail "pill shape (rounded-full): $hits"
  hits=$(echo "$files" | tr ' ' '\n' | grep -E "\.tsx?$" | grep -viE "Demos|Lab|stub" | xargs grep -nE "#[0-9A-Fa-f]{6}\b" 2>/dev/null | head -5); [ -n "$hits" ] && fail "hex colours: $hits"
  hits=$(grep -rniE "plum" $files 2>/dev/null | grep -viE "legacy|maps? .*dark|stored" | head -3); [ -n "$hits" ] && warn "Plum mentioned: $hits"
  hits=$(echo "$files" | tr ' ' '\n' | grep -E "\.tsx?$" | grep -v "components/Icon.tsx" | xargs grep -ln 'from "lucide-react"' 2>/dev/null | head -5); [ -n "$hits" ] && warn "direct lucide-react imports (only allowed to pass a component to Icon): $hits"
  # tsc errors in this lane's files
  local tsc; tsc=$(npx tsc --noEmit 2>&1 | grep -E "error TS" || true)
  for p in $(paths_of "$lane"); do hits=$(echo "$tsc" | grep -F "$p" | head -5); [ -n "$hits" ] && fail "tsc errors in lane files: $hits"; done
  echo "tsc errors in the whole project: $(echo "$tsc" | grep -c 'error TS')" >> "$out"
  if [ $fails -eq 0 ]; then echo "VERDICT: PASS" >> "$out"; echo PASS; else echo "VERDICT: FAIL" >> "$out"; echo FAIL; fi
}

prompt_retry() { cat <<EOF
Read .claude/agents/ui-worker.md, then do DOCS/UI/tasks/2026-11-05-$2.md (you are lane $1). It now ends with a "Retry" section: the automatic review of your previous run FAILED. Fix every failure listed there first, then finish anything the previous handoff listed as unfinished. The working tree already holds your previous work: continue from it, do not redo finished work, do not revert anything. Edit only the paths in the task's Lane section. Never run eslint --fix, prettier or any command that rewrites many files, and never run git checkout/stash/reset/add/commit. Small targeted edits only. Don't stop to ask. Don't commit. The dev server is running on http://localhost:3000. Run every check in the foreground, never wait on background tasks. Write a new handoff DOCS/UI/handoffs/2026-11-05-HHMM-$1.md when done, with the real tsc output, and finish.
EOF
}

declare -A retries reviewed
while :; do
  [ -f "$STOPFILE" ] && { say "STOP file found, watcher exits"; exit 0; }
  for lane in L1 L2 L3 L4 L5 L6 L7 L8 L9; do
    h=$(handoff_of "$lane"); [ -z "$h" ] && continue
    key="$lane:$h"; [ -n "${reviewed[$key]}" ] && continue
    sleep 90   # let the worker finish writing files after the handoff
    say "$lane: reviewing $h"
    v=$(review "$lane"); reviewed[$key]=1
    say "$lane: review $v (details in $LOGS/review-$lane.txt)"
    if [ "$v" = FAIL ]; then
      n=$(( ${retries[$lane]:-0} + 1 ))
      if [ $n -le 2 ]; then
        retries[$lane]=$n; slug=$(slug_of "$lane")
        { echo; echo "## Retry $n (automatic review, $(date '+%F %T'))"; echo; echo "The review failed. Fix these first:"; echo; sed -n '/^FAIL/p' "$LOGS/review-$lane.txt" | sed 's/^/- /'; } >> "DOCS/UI/tasks/2026-11-05-$slug.md"
        mv "$h" "DOCS/UI/handoffs/superseded/" 2>/dev/null
        while [ "$(tasklist | grep -ci agy)" -ge 3 ]; do sleep 60; done
        say "$lane: relaunching for retry $n"
        $AGY --print="$(prompt_retry "$lane" "$slug")" > "$LOGS/${lane}-retry$n.log" 2>&1 &
      else
        say "$lane: failed review after 2 retries: needs a human (see $LOGS/review-$lane.txt)"
      fi
    fi
  done
  sleep 60
done
