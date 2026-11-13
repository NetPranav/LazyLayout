#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
launch() { # name, brief
  echo "=== START $1 $(date +%T)" >> $D/run.log
  ( agy --dangerously-skip-permissions --output-format stream-json --print "Your TASK name is $1 (use it for <TASK> in the notes and handoff file names). Be fast: write the source first, tests second; grep rather than reading whole files; re-read what you wrote for type errors because you cannot run tsc.
$(cat $D/common.md $D/B2-ids.md $D/$2)" > $D/$1.agy.jsonl 2> $D/$1.agy.err; echo "=== END $1 $(date +%T)" >> $D/run.log ) &
}
launch B3-021-024 B3-3D-021-024.md
launch B3-025 B3-3D-025.md
launch B3-030 B3-3D-030.md
launch B3-027-028 B3-3D-027-028.md
wait
