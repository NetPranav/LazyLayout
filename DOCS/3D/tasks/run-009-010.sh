#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
for t in 3D-009 3D-010; do
  ( agy --dangerously-skip-permissions --output-format stream-json --print "$(cat DOCS/3D/tasks/common.md DOCS/3D/tasks/$t.md)" 2> DOCS/3D/tasks/$t.agy.err > DOCS/3D/tasks/$t.agy.jsonl; echo "=== END $t exit=$? $(date +%T)" >> DOCS/3D/tasks/run.log ) &
  echo "=== START $t (parallel) $(date +%T)" >> DOCS/3D/tasks/run.log
done
wait
