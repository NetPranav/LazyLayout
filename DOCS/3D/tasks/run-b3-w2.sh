#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
echo "=== START B3-W2-make3d-text $(date +%T)" >> $D/run.log
agy --dangerously-skip-permissions --output-format stream-json --print "Your TASK name is B3-W2-make3d-text (use it for <TASK> in the notes and handoff file names). Be fast: write the source first, tests second; grep rather than reading whole files; re-read what you wrote for type errors because you cannot run tsc.
$(cat $D/common.md $D/B2-ids.md $D/B3-W2-make3d-text.md)" > $D/B3-W2-make3d-text.agy.jsonl 2> $D/B3-W2-make3d-text.agy.err
echo "=== END B3-W2-make3d-text $(date +%T)" >> $D/run.log
