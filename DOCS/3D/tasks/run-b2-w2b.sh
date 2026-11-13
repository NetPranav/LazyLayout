#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
launch() {
  local name=$1 brief=$2
  echo "=== START $name $(date +%T)" >> $D/run.log
  ( agy --dangerously-skip-permissions --output-format stream-json --print "Your TASK name is $name (use it for <TASK> in the notes and handoff file names).
$(cat $D/common.md $D/B2-ids.md $D/$brief)" > $D/$name.agy.jsonl 2> $D/$name.agy.err; echo "=== END $name $(date +%T)" >> $D/run.log ) &
}
launch B2-W2-2a B2-W2-2a.md
launch B2-W2-2b B2-W2-2b.md
wait
