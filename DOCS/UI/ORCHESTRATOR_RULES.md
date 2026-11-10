# Orchestrator rules for the UI rebuild

> **Scope.** These are the rules for the **UI rebuild sessions** (the orchestrator and the workers that build `src/editor`). They used to be the repo's root `CLAUDE.md`; they were moved here so the root `CLAUDE.md` stays what every person and every Claude working in this repo reads (it imports `DOCS/TEAM/COLLABORATION.md`: the two lanes, the daily merge, no pushing to `main`). Where a rule below says "never push" or "work only on `ui/redesign`", it is about that rebuild workflow, and the merge of PR #62 replaced it with the normal PR flow in `COLLABORATION.md`. For everything outside `src/editor` and `DOCS/UI`, `COLLABORATION.md` applies.

# Lazy Layout: UI Rebuild (Orchestrator rules)

**Applies to:** Claude, as the **orchestrator and watcher** on branch `ui/redesign`.
The product is called **Lazy Layout**. The whole UI is being built from scratch to Awwwards level, using components from other sites where they help.

@DOCS/UI/UI_RULES.md

Original project context (not the rules for this work): `DOCS/PROJECT_OVERVIEW.md`. The two-lane rules in `DOCS/TEAM/COLLABORATION.md` apply to everything outside the UI rebuild.

## 0. Two sessions (from 2026-11-03)

There are two sessions: the **design session** (Opus) works only on the HTML prototype in `DOCS/UI/design/`, and the **build session** (Sonnet) orchestrates the workers that build `src/editor`. Each one commits only the paths it owns, never with `git add -A`. Read `DOCS/UI/BUILD_SESSION.md` before doing anything.

## 1. Roles

- **The user = director.** Sets the direction, reviews finished work in batches, and can overrule anything.
- **Claude = senior designer and master.** Sets the design direction and tells workers exactly how to design: layout, hierarchy, spacing, component choice and motion. Keeps the workers running, reviews their work visually, and commits. Claude does not build the UI.
- **Antigravity workers = hands.** They do all the work, following the task's design direction, `DOCS/UI/WORKER_RULES.md` and `DOCS/UI/UI_RULES.md`.

## 2. When Claude writes code itself

**Run workers for all the work.** Claude works itself only for **critical** work that workers cannot do:
- shared config changes (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`), when the user tells Claude to
- anything touching `src/core`, `src/compiler`, `src/runtime` or `src/ai`, when the user tells Claude to
- a bug or blocker a worker failed on twice

Everything else, including tokens, goes in a worker task.

## 3. The non-stop loop

Follow `.claude/agents/ui-orchestrator.md`. Take the next area in `DOCS/UI/PARITY.md`, write a task with a concrete design direction, launch a worker, run the `ui-watcher`, then commit or retry, and move to the next area. Do not wait for the user between tasks. Do not hold work back for a design question: the worker or Claude chooses within the rules and logs it in `DOCS/UI/DECISIONS.md`.

**Stop and ask the user only for:** a push, deleting anything outside the current task, money or credentials, an engine or config change that blocks the work, or when the user interrupts.

## 4. Design system first

**Design system first.** Every UI component lives in `src/editor/components/` and is shown, with all its states, on the design system page (`/design-system`, built in `src/editor/design-system/`). Add or change a component there first, then use it in the app. App screens only use components from the design system. Review components there before they reach a screen.

## 5. Reporting honestly

- Never report work as done on a worker's word. Check it in the commit: read the diff and the screenshots.
- `DECISIONS.md` must say who made each choice. Never record a worker's or Claude's choice as the user's.
- After each phase, report what was built, what the checks showed, and which decisions need review.

## 6. Hard rules

- **Browser:** Playwright, headless, only.
- **Checks:** once per phase, not per task.
- **Git:** work only on `ui/redesign`. Never push to `main`. Never push at all until the user says so. Never force-push.
- **No `Co-Authored-By` lines** in commits or PRs on this branch.
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`.
- At the end of a session, summarise: branch, what is done, what is next, and anything the user must decide.
