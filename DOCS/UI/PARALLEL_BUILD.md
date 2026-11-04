# Parallel build plan: the prototype into the real app

Written by Claude (design session), 2026-11-04, at the user's request. For the **build session (Sonnet)**.

**Goal:** everything in the HTML prototype reaches the real app as fast as possible. That means Design, Motion and Code modes, the menus, motion, themes and transitions. Source of truth: `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P), with `DOCS/UI/design/CHANGELOG.md` listing what changed in it.

**Your job (Sonnet):** run workers **in parallel**, review each one with the watcher, then merge and commit. You do not build the UI. You only do the critical work:
- shared-file merges
- a bug a worker failed on twice
- the phase checks
- commits

Read `.claude/agents/ui-worker.md` (worker rules and the known mistakes) and `.claude/agents/ui-watcher.md` (review checklist). Those two files, plus this one and `CLAUDE.md`, are all you need.

## 1. How to run workers in parallel

All workers share one working tree, so parallel only works if their **file lanes never overlap**. Each lane below lists the only paths that lane may edit.

**Launching a wave:** start every lane in the wave at the same time, in the background, in **one message with one tool call per lane**. Use either option:

- **Antigravity (preferred, costs no Claude tokens):** one background Bash call per lane.
  ```
  agy --dangerously-skip-permissions --output-format text --print="Read .claude/agents/ui-worker.md, then do DOCS/UI/tasks/<task>.md. Edit only the paths in its Lane section. Don't stop to ask. Don't commit." > DOCS/UI/handoffs/logs/<lane>.log 2>&1
  ```
- **Claude subagents** (fallback): launch the `ui-worker` agent type with `model: "sonnet"`, `run_in_background: true`, and the same prompt. Use one Agent call per lane, all in one message.

**Rules while a wave runs:**
- Never wait for one lane before starting the next lane of the same wave.
- When a lane finishes, run the `ui-watcher` subagent on it right away (`model: "haiku"` is fine for a first pass), while the other lanes keep working.
- **Pass:** commit that lane's paths only, with `git add <lane paths>`. Never use `git add -A` or `git add .`.
- **Fail:** add a "Retry N" section to the task and relaunch only that lane. After 2 failed retries, fix the rest yourself.
- **Start the next wave** only when every lane of the current wave is committed.

**Shared files** are edited only by the lane that owns them in that wave:
- `tokens.css`, `tailwind.css`, `animations.css`, `globals.css`
- `components/index.ts`
- `design-system/DesignSystemPage.tsx`
- `shell/EditorShell.tsx`

**Wave 0** creates one marked block per lane in `tokens.css` and `tailwind.css`, like this:
```
/* === lane: L3 inspector === */
/* === end lane: L3 === */
```
In later waves, each lane may add tokens **only inside its own block**. Re-read the file right before each edit.

**Design-system demos:** each lane puts its demos in its own file, `src/editor/design-system/demos/<Lane>Demos.tsx`, and never edits `ComponentDemos.tsx` or `DesignSystemPage.tsx`. Wave 2's L9 lane wires all the demo files into the page.

**Type checking:** each worker runs `npx tsc --noEmit` once at the end and fixes only errors in its own lane's files. It reports errors from other lanes without touching them.

## 2. The waves

### Wave 0: foundation (1 lane, alone)
**L0: foundation and audit.** Do `DOCS/UI/tasks/2026-11-04-design-system-audit-fixes.md`, with these changes:
- Item 8 changes: **Noir is now official**. Do not remove it.
- **Themes:**
  - Add Graphite, Darkroom and Noir to `tokens.css`, copying P's `[data-theme=…]` values exactly.
  - Make the theme picker offer all eight themes: Light is Paper, White, Warm and Lilac. Dark is Noir, Dark, Graphite and Darkroom.
  - **Remove Plum everywhere.** A stored `plum` theme maps to `dark`.
- **Lane blocks:** create the per-lane token blocks in `tokens.css` and `tailwind.css` (section 1).
- **Paths:** `src/editor/styles/**`, `src/editor/components/**`, `src/editor/design-system/**`, `src/app/design-system/**`, and the files that audit task names.

### Wave 1: screens in parallel (7 lanes)

Each lane gets its own task file, `DOCS/UI/tasks/2026-11-05-<lane>.md`. Write all seven before launching. Each task file contains:
- the exact P line ranges and selectors to read
- the behaviour to port, with values copied from P
- its lane paths

| Lane | Builds (from P) | Lane paths (only these) |
|---|---|---|
| **L1 Top bar** | Logo with the back-and-forth trace while saving (no save dot, no text); mode tabs with a sliding highlight, ▾ on the active tab and a mode menu for each mode; page switcher; theme button and picker (8 themes); Ship popover; avatars hidden | `components/TopBar.tsx`, `ModeTabs.tsx`, `LogoMark.tsx`, `PageSwitcher.tsx`, `ShipPopover.tsx`, `ThemeToggle.tsx`, `topbar-constants.ts` |
| **L2 Left panel** | Layers tree as in P (search, filter, rename, drag to nest, eye and lock, Motion badge, context menu); Files tree for Code mode (filter, search, expand on a spring, modified dot, right-click menu); Assets | `shell/left-panel/**` |
| **L3 Design inspector** | Every right-panel section in Design mode as in P (field spec: 28px, 11px mono values, prefixes inside the field); page inspector when nothing is selected; row settings popovers | `panels/details/**`, `shell/right-panel/**` |
| **L4 Canvas** | Floating toolbar (Design tools, and Motion tools in Motion mode), Insert panel, AI box with the trace loader, View options, canvas and element context menus, zoom bar, artboard size menu, selection handles | `shell/canvas-chrome/**`, `stage/**` |
| **L5 Motion timeline** | P's Motion bottom panel. The timeline model (layers, clips, property tracks, 60fps); a 40px header (timecode, transport with previous/next keyframe, Timeline/Graph tabs, tools, speed, full width, export, `…`); a 264px resizable track column; label-colour strips and tints; groups that mirror Layers; clip move, trim and split; keyframes (add, select, marquee, drag, duplicate, delete); ruler, work area and markers; Graph view; right-click menus (clip, keyframe, track, lane, ruler); a 28px footer with the mini-map; focus on the selected layer (others at 45%); drop zone; all timeline shortcuts | `panels/timeline/**`, new `src/editor/motion-model/**` |
| **L6 Motion inspector** | Motion right panel states: Composition (nothing selected), Layer clip (trigger and scroll, repeat, stagger, grouped properties with a stopwatch, value, ◀◆▶ and an easing chip, Add property, presets), Keyframe (the big easing editor: multi-point curve, Save as preset, preview strip, Spring tab); Export panel (CSS, WAAPI, Framer, GSAP) | `panels/inspectors/**`, `panels/sequencer/**` (replace the bridge) |
| **L7 Code mode** | Code bottom panel: file tabs, code view (syntax using only `--text`, `--text2` and `--muted`, folding, sticky header, wrap, read-only lock), Code / Console / Trace tabs, footer; canvas ↔ code sync; output options that change the code; Project, file and layer right-panel states; Logic and Data full-page shells | `panels/code-view/**`, `panels/console/**` (replace the bridge), `panels/blueprint/**` (shell only) |

**L5 and L6 share the motion model.** L5 owns `src/editor/motion-model/**`. L6 only imports it. L5's task must define the model's types first. Write those types into L6's task too, so both lanes can start at the same time.

### Wave 2: integration (2 lanes, in parallel)
| Lane | Builds | Lane paths |
|---|---|---|
| **L8 Shell layout and transitions** | Full-width bottom panel (default in Motion and Code, `Shift+T`), timeline height splitter (40% by default, double-click resets), header band and panel shadow, `panelFx` springs for panel collapse and expand; mode-switch transitions as in P (tab highlight, panel content sliding in tab order with content blur, inspector cascade, Design→Motion rise, Motion→Code fold, Code→Design sink; under 400ms and interruptible); cross-panel focus dimming (canvas at 60%) | `shell/EditorShell.tsx`, `shell/*.tsx` (top level), `src/editor/styles/**` |
| **L9 Design system page** | Wire every lane's `<Lane>Demos.tsx` into `/design-system` with all states; add `MenuHeading` and `ThemeSwatch`; foundations show all 8 themes and the label colours | `src/editor/design-system/**`, `src/app/design-system/**` |

### Phase check (you, Sonnet)
After Wave 2:
1. Run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e`.
   - Playwright needs `executablePath` pointing to the chromium_headless_shell-1248 build under `%LOCALAPPDATA%\ms-playwright`.
2. Send each failure to the lane that owns the file, as one parallel fix wave.
3. Take side-by-side screenshots: prototype vs app, at 1440, in Design, Motion and Code, Paper and Dark.
4. Report to the user: what's done, the screenshots, and the decisions to review. **Don't push.**

## 3. Status board

Keep this table updated as lanes start, pass and commit.

| Wave | Lane | Task file | Status | Commit |
|---|---|---|---|---|
| 0 | L0 | 2026-11-04-design-system-audit-fixes.md | todo | |
| 1 | L1 to L7 | 2026-11-05-<lane>.md | todo | |
| 2 | L8, L9 | 2026-11-05-<lane>.md | todo | |
