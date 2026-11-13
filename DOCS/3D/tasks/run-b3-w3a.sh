#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
name=$1; brief=$2
echo "=== START $name $(date +%T)" >> $D/run.log
agy --dangerously-skip-permissions --output-format stream-json --print "Your TASK name is $name (use it for <TASK> in the notes and handoff file names). Be fast: write the source first, tests second; grep rather than reading whole files; re-read what you wrote for type errors because you cannot run tsc.
$(cat $D/common.md $D/B2-ids.md $D/$brief)" > $D/$name.agy.jsonl 2> $D/$name.agy.err
echo "=== END $name $(date +%T)" >> $D/run.log
