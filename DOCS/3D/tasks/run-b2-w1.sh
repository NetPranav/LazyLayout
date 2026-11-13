#!/bin/zsh
# Batch 2, wave 1: five independent pure-logic tasks in parallel. agy only writes code.
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
launch() { # name, brief
  local name=$1 brief=$2
  echo "=== START $name $(date +%T)" >> $D/run.log
  ( agy --dangerously-skip-permissions --output-format stream-json --print "Your TASK name is $name (use it for <TASK> in the notes and handoff file names).
$(cat $D/common.md $D/B2-ids.md $D/$brief)" > $D/$name.agy.jsonl 2> $D/$name.agy.err; echo "=== END $name $(date +%T)" >> $D/run.log ) &
}
launch B2-011 B2-3D-011.md
launch B2-013 B2-3D-013.md
launch B2-014-015 B2-3D-014-015.md
launch B2-016-017 B2-3D-016-017.md
launch B2-020 B2-3D-020.md
wait
