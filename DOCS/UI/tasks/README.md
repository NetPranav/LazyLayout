# Worker tasks

One file per task: `YYYY-MM-DD-<short-name>.md`. Claude writes them and workers execute them, one after another, without waiting for the user.

## A task names

- the area (a row in `DOCS/UI/PARITY.md`) and the bridge files it replaces
- the direction: the user's words where they exist, and otherwise Claude's choice, logged in `DECISIONS.md`
- the legacy files to read for behaviour
- the files the worker may touch, and the off-limits list
- what "done" means: screenshots at 1440, 1024 and 390 in `DOCS/UI/handoffs/screenshots/<short-name>/`, a handoff, `INTEGRATION.md`, `DECISIONS.md`, `COMPONENT_SOURCES.md` and `PARITY.md` updated, no commit

## How Claude launches a worker (Antigravity CLI `agy`)

Run from the repo root, in the background:

```
agy --dangerously-skip-permissions --output-format text --print="<prompt: read AGENTS.md and DOCS/UI/UI_RULES.md, then execute DOCS/UI/tasks/<file>. Do not stop to ask. Write the handoff. Do not commit or push.>" > worker.log 2>&1
```

- Attach the prompt as `--print="..."`. Other flags go before it.
- Headless mode cannot ask for permission, so without `--dangerously-skip-permissions` the worker is auto-denied and produces nothing. With it, only the task text limits the worker, so the watcher review is mandatory. An engine edit was lost during an earlier worker session, and no one noticed because no review ran.
- `--mode auto` is not available on this account.
- The log stays empty until the worker finishes. Use `git status` to see progress.
