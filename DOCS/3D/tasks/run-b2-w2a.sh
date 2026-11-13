#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
name=B2-W2-1
echo "=== START $name $(date +%T)" >> $D/run.log
agy --dangerously-skip-permissions --output-format stream-json --print "Your TASK name is $name (use it for <TASK> in the notes and handoff file names).
$(cat $D/common.md $D/B2-ids.md $D/B2-W2-1.md)" > $D/$name.agy.jsonl 2> $D/$name.agy.err
echo "=== END $name $(date +%T)" >> $D/run.log
