#!/bin/zsh
cd "/Users/pranav/Project Folder/WebAPPBuilder" || exit 1
D=DOCS/3D/tasks
fix() { # name, conversation, brief
  echo "=== START $1.fix1 $(date +%T)" >> $D/run.log
  ( agy --dangerously-skip-permissions --conversation $2 --output-format stream-json --print "$(cat $D/$3)" > $D/$1.fix1.jsonl 2> $D/$1.fix1.err; echo "=== END $1.fix1 $(date +%T)" >> $D/run.log ) &
}
fix B2-011 f6b271e9-d625-41e4-8705-3c92610a0d85 B2-011.fix1.md
fix B2-013 62dc4664-21a5-4fb9-9a14-aa100c4984c8 B2-013.fix1.md
fix B2-016-017 6c3ae645-4af1-4bdc-aaae-ab28ea97be64 B2-016-017.fix1.md
fix B2-W2-2b 896d9e1b-5cc8-4e6b-addb-03c9a3f43d8a B2-W2-2b.fix1.md
wait
