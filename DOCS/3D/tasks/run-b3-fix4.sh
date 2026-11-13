#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
echo "=== START B3-W2-make3d-text.fix3 $(date +%T)" >> $D/run.log
agy --dangerously-skip-permissions --conversation 1a9886bf-16dd-4fd3-be81-d93262b4c2b8 --output-format stream-json --print "$(cat $D/B3-W2-make3d-text.fix3.md)" > $D/B3-W2-make3d-text.fix3.jsonl 2> $D/B3-W2-make3d-text.fix3.err
echo "=== END B3-W2-make3d-text.fix3 $(date +%T)" >> $D/run.log
