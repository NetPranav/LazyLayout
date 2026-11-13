#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
fix() { echo "=== START $1.fix1 $(date +%T)" >> $D/run.log; ( agy --dangerously-skip-permissions --conversation $2 --output-format stream-json --print "$(cat $D/$1.fix1.md)" > $D/$1.fix1.jsonl 2> $D/$1.fix1.err; echo "=== END $1.fix1 $(date +%T)" >> $D/run.log ) & }
fix B3-W3-properties 3d8fb8ed-32e7-41b3-9e1a-0938ec7c6252
fix B3-W2-make3d-text 1a9886bf-16dd-4fd3-be81-d93262b4c2b8
wait
