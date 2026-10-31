# Worker tasks

One file per task: `YYYY-MM-DD-<short-name>.md`. Claude writes them from the user's approved direction; Antigravity workers execute them.

## A task names

- the page or area (a row in `DOCS/UI/PARITY.md`) and which bridge files in `src/editor` it replaces
- the approved design direction, quoted from the user, and what is still undecided (workers must not decide it)
- the files the worker may touch, and the off-limits list
- Playwright screenshot sizes and the folder to save them in
- what "done" means: handoff from `handoffs/TEMPLATE.md`, `INTEGRATION.md` entries, `PARITY.md` updated, no commit

Finished tasks and handoffs move to `DOCS/UI/archive/` when a phase is closed.

## How Claude launches a worker (Antigravity CLI `agy`)

Run from the repo root, in the background, one worker at a time when their files overlap:

```
agy --dangerously-skip-permissions --output-format text --print="<prompt: read AGENTS.md and UI_RULES.md, then execute DOCS/UI/tasks/<file>. Write the handoff. Do not commit or push.>" > worker.log 2>&1
```

- Pass the prompt as `--print="..."` (attached). A separate prompt argument after other flags is not read.
- Headless mode cannot ask for permission, so without `--dangerously-skip-permissions` the worker is auto-denied and produces nothing. With it, nothing enforces the rules except the task text, so the `ui-watcher` review after every session is mandatory.
- `--mode auto` is not available on this account.
- The log stays empty until the worker finishes. Check `git status` to see progress.
