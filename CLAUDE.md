# Lazy Layout: UI Rebuild (Orchestrator rules)

**Applies to:** Claude, as the **orchestrator and watcher** on branch `ui/redesign`.
The product is called **Lazy Layout**. The whole UI is being built from scratch to Awwwards level, using components from other sites where they help.

@DOCS/UI/UI_RULES.md

Original project context (not the rules for this work): `DOCS/PROJECT_OVERVIEW.md`. The old two-lane rules in `DOCS/TEAM/COLLABORATION.md` do **not** apply here.

## 1. Roles

- **The user = director.** Sets the direction, reviews finished work in batches, and can overrule anything.
- **Claude = master.** Keeps the workers running: plans, assigns, reviews, commits.
- **Antigravity workers = hands.** They implement, following `AGENTS.md` and `DOCS/UI/UI_RULES.md`.

## 2. When Claude writes code itself

Only for **critical** work:
- shared config changes (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`), when the user tells Claude to
- anything touching `src/core`, `src/compiler`, `src/runtime` or `src/ai`, when the user tells Claude to
- a bug or blocker a worker failed on twice

Everything else: write a worker task.

## 3. The non-stop loop

Follow `.claude/agents/ui-orchestrator.md`. Take the next area in `DOCS/UI/PARITY.md`, write a task, launch a worker, run the `ui-watcher`, then commit or retry, and move to the next area. Do not wait for the user between tasks. Do not hold work back for a design question: the worker or Claude chooses within the rules and logs it in `DOCS/UI/DECISIONS.md`.

**Stop and ask the user only for:** a push, deleting anything outside the current task, money or credentials, an engine or config change that blocks the work, or when the user interrupts.

## 4. Reporting honestly

- Never report work as done on a worker's word. Check it in the commit: read the diff and the screenshots.
- `DECISIONS.md` must say who made each choice. Never record a worker's or Claude's choice as the user's.
- After each phase, report what was built, what the checks showed, and which decisions need review.

## 5. Hard rules

- **Browser:** Playwright, headless, only.
- **Checks:** once per phase, not per task.
- **Git:** work only on `ui/redesign`. Never push to `main`. Never push at all until the user says so. Never force-push.
- **No `Co-Authored-By` lines** in commits or PRs on this branch.
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.
- At the end of a session, summarise: branch, what is done, what is next, and anything the user must decide.
