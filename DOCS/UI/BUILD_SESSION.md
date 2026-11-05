# Build session: start here

> **From 2026-11-04 the build runs in parallel waves. Follow `DOCS/UI/PARALLEL_BUILD.md`, which overrides the one-worker-at-a-time loop below.**

Written by Claude (Opus, design session), 2026-11-03. From now on, two Claude sessions work on `ui/redesign` at the same time. This file says who does what. `CLAUDE.md` and `UI_RULES.md` still apply to both.

| Session | Model | Job | Owns (only it edits and commits these) |
|---|---|---|---|
| **Design session** | Opus | Designs in the HTML prototype, tests every animation there first, and sets design direction | `DOCS/UI/design/**` (prototype, variant pages, `CHANGELOG.md`, `REQUESTS.md`) |
| **Build session** | Sonnet | Orchestrator: builds the prototype into the real app with Antigravity workers, reviews with `ui-watcher`, commits | `src/**`, `DOCS/UI/tasks/**`, `DOCS/UI/handoffs/**`, `PARITY.md`, `DECISIONS.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md` |

The user is the director over both and passes messages between them.

## 1. The source of truth

- **The prototype is the spec:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`. Copy its layout, values and motion. Don't redesign and don't retune.
- **What's new in the prototype and not built yet:** `DOCS/UI/design/CHANGELOG.md`. Read it at the start of every task, and mark entries `built` when you commit them.
- **An area the prototype doesn't cover yet?** Add a line to `DOCS/UI/design/REQUESTS.md` (that's the only design file the build session may edit) and move on to the next area. The design session prototypes it, and the user tells you when it's ready.
- Decisions approved by the user are marked `user | approved` in `DECISIONS.md`. Never override them.

## 2. Git, with two sessions in one working tree

- **Commit only your own paths:** `git add <path> <path>`, never `git add -A` or `git add .`. The other session may have uncommitted work in the tree.
- Before each commit, run `git status` and check that nothing from the other session's paths is staged.
- No `Co-Authored-By` lines. Never push, and never touch `main`. Push only when the user says so. Never force-push.
- One PR at the very end, after the whole redesign and all four checks (`UI_RULES.md` §9). The user decides when.

## 3. The loop for each area

1. Take the next area (section 5 below), and set its row in `PARITY.md` to `wip`.
2. Write a **self-contained** task file in `DOCS/UI/tasks/YYYY-MM-DD-<name>.md`, using `2026-11-05-L1-top-bar.md` or `2026-11-05-real-document.md` as the model:
   - the goal
   - "Read only these": the exact prototype line ranges, CSS selectors and app files (never "read everything")
   - the behaviour to port, with values copied from the prototype
   - the rules that matter for this task (the short list in section 6)
   - the files the worker may touch
   - "Done": `npx tsc --noEmit` once, screenshots at 1440 of what was built, a handoff from `TEMPLATE.md`, no commit
3. **Workers do the work:** launch Antigravity first (`agy --dangerously-skip-permissions --print=...`), with Claude subagents as the fallback when Antigravity quota is exhausted.
   - **Background execution:** The night runner scripts (`night-runner.sh` and `night-watcher.sh`) die when their launching shell ends, so launch each worker with its own separate background call.
   - **Hung workers:** A worker that makes no file edits for 10 minutes, or an idle `agy` process still running after its handoff is written, must be stopped (`taskkill //IM agy.exe //F`) and relaunched once.
   - **Process cleanup:** Kill leftover Playwright `chromium-1248` processes after runs (`taskkill //IM chrome.exe //F` if stuck).
   - **Dev server memory:** The dev server needs significant memory; a machine low on memory will kill it. Start it only when needed, and stop it before running `npm run build` (they share `.next`).
   - **Never run mass rewriters:** Never run `eslint --fix`, prettier, or any command that rewrites many files (an earlier worker rewrote the line endings of 749 files).
   - Give the user a one-line prompt to paste into Antigravity, in this form:
     `Do the task in DOCS/UI/tasks/<file>.md. Don't stop to ask. When done, run npx tsc --noEmit once, write the handoff, don't commit.`
   - Workers don't read all rule files and don't run lint, build or e2e (`AGENTS.md` loads on its own). Add `npx eslint <paths>` only on a retry that is fixing lint.
4. When the user says the worker is done, run the `ui-watcher` subagent on the task, the handoff and `git diff`. Also open the screenshots yourself.
5. **Pass:** commit that area's paths (for example `feat(ui): rebuild top bar`), set the row to `done`, and mark the `CHANGELOG.md` entries `built`. **Fail:** add a "Retry N" section to the same task file with numbered `file:line` fixes, and give the user the same one-line prompt that points at that section. **After 2 failed retries,** fix the rest yourself, then commit.
6. At the end of a phase, run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e`, and report to the user.

### Parallel workers

You may run several Antigravity workers at once, but only when their file sets cannot overlap.

- These shared files may be edited by **one worker per batch only**: `tokens.css`, `tailwind.css`, `animations.css`, `design-system/demos/ComponentDemos.tsx`, `DesignSystemPage.tsx` and `motion/*`. Every other worker lists the tokens or demos it needs in its handoff, and you add them, or give them to the worker that owns the file in the next batch.
- In parallel batches, workers **don't edit** `DECISIONS.md`, `PARITY.md` or `INTEGRATION.md`. They write their decisions in their handoff, and you merge them in when you commit.
- Each worker gets its own task file, and gets its own screenshot folder.

## 4. Where things stand (2026-11-05)

**New editor built from prototype, wired to real document, PR #62 open:**
- **Core editor:** Shell, TopBar, left panel (Layers, Files, Assets), canvas chrome (Toolbar, AI box, Insert, View options), stage, Design inspector, Motion timeline + model + inspector, Code panel + inspector, persistence (boot, autosave, lock, banners), eight official themes, and 94 design system sections on `/design-system` are all built and committed.
- **Real document:** Stage, layers tree, inspector, code view, and timeline read and write the real engine document (commit `d7df6af`); demo data stopgaps removed; initial projects auto-seed 16 prototype layers; persistence and undo/redo work.
- **Main merged & legacy route:** `origin/main` (phases 39 to 81) merged into `integrate/main-into-new-ui` (commit `ce037af`). Main's features live in `src/legacy-editor` and remain reachable at `/editor/legacy` with `LegacyStudioHeader.tsx`. `/editor` is the new editor. PR #62 into `main` is open: https://github.com/NetPranav/LazyLayout/pull/62.
- **Cleanups & fixes:** Cursor and Scroll Fade replaced with own code (`73edaba`); `src/editor/components/imported/` removed; unused dependencies `@animate-ui/react`, `@base-ui/react`, `@floating-ui/react`, `radix-ui` removed (`58ae713`, `5cf6d24`). Timeline playback bug fixed with sub-frame accumulator (`ea8ee24`).
- **E2E tests:** `support/editor.ts` defaults to the NEW editor (`EDITOR_URL = "/editor"`), exports `LEGACY_EDITOR_URL = "/editor/legacy"`. Every spec explicitly names its target. Full suite: **199 passed, 65 skipped (`test.fixme`), 0 failed, 0 flaky (264 tests total)**.

**What is NOT done (honest list):**
1. **New-UI screens for main's features:** Pen and vector tools, auto layout, breakpoints, tokens, components and variants, templates, scroll model, and export work only at `/editor/legacy`. They need designs from the design session (`DOCS/UI/design/REQUESTS.md`), then worker tasks.
2. **Old-app areas with no new version:** 17 unbuilt areas (launcher / hub home page, database studio, blueprint shell only, content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace, render gallery, fonts).
3. **The 65 `test.fixme` tests:** Come back as those features are built.
4. **Not checked:** Responsive widths 1024 and 390, reduced motion across all springs, the six non-default themes visually, Firefox compatibility (`NumberField` uses `field-sizing: content`), and final side-by-side screenshots Paper and Dark across Design/Motion/Code.
5. **Timeline header token:** Token is 44px (prototype task said 40).
6. **Legacy lint error:** 1 error in `src/legacy-editor/menus/UnifiedLogoMenu.tsx` (old code untouched).

## 5. Build queue (prototype section → area)

Line numbers are approximate for the 2026-11-03 prototype, so grep the ids.

**Phase 1:**

| # | Area | Prototype part | Notes |
|---|---|---|---|
| 1 | `shell`: top bar | CSS "TOP BAR" (~56-213), markup `#top` (~806-818): `#menubtn` logo menu, `#modes` (Design, Motion, Code), `#themebtn`, `#shipbtn`, `#pagebtn` page switcher | The logo **traces while saving** (`.logo.saving-on`, `.tro`, `.tfl`, keyframes `ll-tro`/`ll-trf`), with no "Saving" text and an `sr-only` `role=status`. `src/editor/shell/EditorShell.tsx` replaces the bridge and mounts legacy panels for the areas not rebuilt yet |
| 2 | `shell`: left panel | CSS "PANELS" (~214-263), `#lhead`, `#p-layers`, `#p-files`, `#p-tracks`, `#p-assets`, `#lsplit` | Layers tree, search and filter, files, tracks, assets |
| 3 | `shell`: canvas chrome | CSS "CANVAS" (~264-), `#center`, `#rt`/`#rl` rulers, `#tools` bottom toolbar, `#ins` Insert, `#aibox` AI box (uses the trace loader `.aiload`), `#vpop` View options | Uses the `menus` components |
| 4 | `shell`: right panel frame | `#rbody`, `#ins-design`, `#ins-key`, `#ins-code` | Just the frame and the section headers. Fields come in Phase 2 |
| 5 | `design-system` | Close it out: every component used above, shown with all its states | |

Then run the Phase 1 checks.

**Phase 2:** `canvas` and `stage` (artboard, selection, handles), `panels/layers`, `panels/details` (inspector: Fill, Stroke, Effects, type, layout), and `panels/timeline` and `panels/motion` (Motion mode).

**Phase 3:** Code mode (`panels/code-view`), `panels/launcher` (project hub), and the rest of `PARITY.md`. Most Phase 3 areas aren't in the prototype yet, so add them to `REQUESTS.md` early.

## 6. Rules workers keep breaking (put the relevant ones in each task)

- **Variant order:** the variant goes after the prefix, `ll:hover:` and `ll:md:`, never `hover:ll:`.
- **No arbitrary values** and no hex. No px or ms literals in TS or CSS: use tokens, or `MENU_FALLBACKS`-style named constants in `presets.ts`.
- **Unlayered CSS** in `animations.css` beats Tailwind (`all: unset` and `height: 100%` broke the Select field). Keep component looks in `ll:` classes.
- **React must never own classes or styles that the motion code writes.** Use static classNames plus data attributes.
- **No browser-only reads on the first render.** Use `useSyncExternalStore` with a server snapshot, or `useMounted()`.
- **No raw `requestAnimationFrame`** outside `src/core/time`. Use the motion loop (`defaultHost` / `frameScheduler`). No `setState` in effects.
- **Global classes and ids are prefixed `ll-`.** Use `useId()` for ids.
- Every icon goes through `Icon`. React `onWheel` is passive, so use a native listener with `{ passive: false }`.
- Don't bulk-reformat files, because one worker mangled JSX that way.
- **Playwright:** it expects `chromium_headless_shell-1243`, but 1248 is installed. Pass `executablePath` to the 1248 build under `%LOCALAPPDATA%\ms-playwright`. `test:e2e` may need the same fix at phase checks.
- `next dev` re-adds a Next.js block to `AGENTS.md`. Leave it in.

## 7. Open decisions for the user (don't block on them)

- **The 65 `test.fixme` tests:** Accept for the first merge, or re-enable some first?
- **Keep `/editor/legacy` route:** Keep until each main feature has a new-UI screen (recommended, in PR #62).
- **Git author email:** Decide author identity for future commits.
- **Designs for remaining areas:** Design direction for home page, database, and other 17 unbuilt areas (`DOCS/UI/design/REQUESTS.md`).
- **Slider type:** Pick one in `DOCS/UI/design/slider-variants.html`. Until then, use the Classic slider.
- **The logo:** SVG source and license.
- **The GSAP license:** License check or replacement strategy.
- **Missing features from the original:** See `DOCS/UI/handoffs/LATEST.md` ("Known gaps") and `DOCS/UI/PARITY.md`.
