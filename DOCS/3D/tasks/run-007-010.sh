#!/bin/zsh
# Runs agy on 3D-007..3D-010 one after another. agy only writes code; Claude tests afterwards.
# Live view: tail -f DOCS/3D/tasks/live.log   (raw JSON per phase in 3D-00X.agy.jsonl)
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
: > DOCS/3D/tasks/live.log
for t in 3D-007 3D-008 3D-009 3D-010; do
  echo "=== START $t $(date +%T)"
  echo "\n\n########## $t ##########" >> DOCS/3D/tasks/live.log
  agy --dangerously-skip-permissions --output-format stream-json --print "$(cat DOCS/3D/tasks/common.md DOCS/3D/tasks/$t.md)" 2> "DOCS/3D/tasks/$t.agy.err" | tee "DOCS/3D/tasks/$t.agy.jsonl" | node DOCS/3D/tasks/view.mjs >> DOCS/3D/tasks/live.log
  echo "=== END $t $(date +%T)"
done
echo "=== ALL DONE"
