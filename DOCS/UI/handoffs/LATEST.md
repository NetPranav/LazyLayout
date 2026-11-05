# Latest handoff: state of the UI rebuild (branch `ui/redesign`)

Written by Claude (build session), 2026-11-05. Read this first. Older detail is in the kept handoffs listed in `README.md` and in `git log`. **Nothing is pushed.** The branch is many commits ahead of `origin/ui/redesign`.

## Where we are

The new editor (`src/editor`, route `/editor`) is built from the HTML prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` in **Design, Motion and Code** modes, and it works on the engine's **real document**: the stage, layers tree, inspector, code view and timeline all read and write the same layers (commit `d7df6af`). A new project starts with the prototype's page (16 real layers). Edits write through engine commands, so autosave marks the project dirty, a reload restores them, and undo and redo work. The design system page `/design-system` has 94 sections.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run build` | passes (with `NEXT_PUBLIC_ENABLE_LABS=1`) |
| `npx eslint src/editor` | 0 errors, about 38 warnings |
| `npm run lint` | 1 error, in read-only legacy code (`src/legacy-editor/menus/UnifiedLogoMenu.tsx`) |
| e2e (chromium, 171 tests) | **77 passed, 96 `fixme`, 4 failing** (flaky-looking, timing tests) |

The 96 `fixme` tests are switched off with a written reason (legacy dock layout, old text overlay, showcase demo, legacy timeline controls and so on). They are not passing coverage. The reasons are in `2026-11-05-*-e2e-g1..g4.md`.

## What was built, by commit area

- **Wave 0, foundation (`340b78f`):** eight themes (Paper default, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom; no Plum), label colours, nine token blocks for the parallel lanes, audit fixes.
- **Wave 1, screens (`2575c0c` to `acc661b`):** L1 top bar (mode tabs, mode menus, theme picker, logo trace), L2 left panel, L3 design inspector, L4 canvas (toolbar, Insert, AI box, View options, menus, stage), L5 motion timeline and the shared motion model (`src/editor/motion-model`), L6 motion inspector and export, L7 code mode.
- **Wave 2 (`00a92c1`, `7b38947`):** L8 shell layout and transitions (full-width bottom panel, springs, `Shift+T`, splitter), L9 design system page.
- **Fixes after review:** lint (`7f30178`), timeline lane origin (`a2c4d0f`, a class-name clash `ll-lay` collapsed the track column), left panel (`6bf1cab`), code mode (`a3ef44b`).
- **Before the waves:** persistence wiring (project boot, autosave, lock, banners), menus, Insert, page switcher, right panel parity.
- **Tests:** shared e2e helpers and four spec groups migrated (`11b9b3f`, `55b6905`), test hooks (`9540ab0`, list in `e2e-testids.md`).

## Known gaps (honest list)

1. **Areas of the old app with no new version:** the home page (project hub and launcher), database studio, blueprint (shell only exists), content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace, render gallery, fonts. Product decision pending: bridge, hide or drop. These need designs from the design tab (`DOCS/UI/design/REQUESTS.md`).
2. **e2e:** re-enable the `fixme` tests the real document now allows; decide whether the 4 failures are flaky or real (`deterministic-clock`, `playback-on-clock`, `snapping`, `stage-incremental`).
3. **Imported components with an unverified license:** `Cursor` and `Scroll Fade` (`COMPONENT_SOURCES.md`). Rules say replace or confirm before a merge.
4. **Not checked:** responsive widths 1024 and 390, reduced motion across all springs, the other six themes visually, Firefox (`NumberField` uses `field-sizing: content`), final side-by-side screenshots (prototype vs app, Design, Motion, Code, Paper and Dark).
5. **Small known differences:** the timeline header token is 44px where the prototype task said 40; the Design section of the Code-mode inspector is missing; the Code-mode segmented control has no sliding highlight; the "All" select outline in the Files tree; many menu items are disabled with a reason because the engine has no command yet (Output Log, Plugins, Deployment and others); page create, rename and delete do not record undo history; the Add keyframe button is disabled because no engine command exists.

## How to continue

- **Run the app:** `npm run dev` (http://localhost:3000, editor at `/editor`, design system at `/design-system`). It needs memory: if the machine is low, a dev server was once killed by the system.
- **Playwright:** the installed browser is the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright` (`chrome-win64\chrome.exe`). The repo config asks for another build and its `webServer` command breaks on Windows: use a throwaway config outside the tracked files that imports `playwright.config`, sets `launchOptions.executablePath`, and uses `webServer: { command: "echo reuse", reuseExistingServer: true }`.
- **Workers:** Antigravity (`agy --dangerously-skip-permissions --output-format text --print="..."`) is preferred. Its quota ran out on 2026-11-04 (a different account worked on 2026-11-05); when it is out, use Claude subagents. Launch each worker with its own background call: `DOCS/UI/night-runner.sh` and `night-watcher.sh` die when the shell that launched them ends. Workers hang sometimes (no edits for 10 minutes): stop and relaunch once. One worker once rewrote the line endings of 749 files: tell workers never to run `eslint --fix`, prettier or any command that rewrites many files, and check `git status` for mass changes.
- **Rules:** `DOCS/UI/UI_RULES.md`, `.claude/agents/ui-worker.md` (known mistakes), `CLAUDE.md` (no `Co-Authored-By`, never push without the user, commit by lane paths only).
- **Process and board:** `DOCS/UI/PARALLEL_BUILD.md`, `BUILD_SESSION.md`.

## Decisions the user must make

1. Bridge, hide or drop the old-app areas listed above (and which come first).
2. Draft PR now (for review) or one PR when it is mergeable.
3. Replace or confirm the two components with unverified licenses.
4. Whether the 96 `fixme` tests are acceptable for a first PR or must be re-enabled first.
5. The repo's git author email (commits use `adarzhpawar@gmail.com`; the user's address is `adarzhpathade@gmail.com`): set it or leave it.

## Rough estimate to a mergeable PR

A draft PR for review can be opened now. A PR that is safe to merge needs the old-app areas decided and bridged or hidden, the `fixme` tests reviewed, the loose ends above closed, and a final visual pass: roughly 3 to 5 days of worker time plus review, depending on how many designs arrive and how many tests come back.
