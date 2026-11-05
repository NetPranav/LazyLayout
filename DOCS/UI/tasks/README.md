# Worker tasks

One file per task: `YYYY-MM-DD-<name>.md`. Claude writes them and workers execute them, one after another or in parallel waves, without waiting for the user.

## Naming rule
- **Format:** `YYYY-MM-DD-<name>.md`
- **Scope:** Self-contained task describing one specific area or lane.
- **Contents:**
  - The area (a row in [`PARITY.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/PARITY.md)) and the legacy files/bridges it replaces
  - Design direction copied from prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` (exact line ranges, selectors, and layout values)
  - The files the worker may touch (its lane paths), and off-limits paths
  - Completion criteria: `npx tsc --noEmit` once, screenshots at 1440px in `DOCS/UI/handoffs/screenshots/<lane>/`, a handoff from [`TEMPLATE.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/TEMPLATE.md), and no git commits or pushes.

---

## How workers are launched

Workers do all the build work. Antigravity (`agy`) is preferred, with Claude subagents as the fallback when Antigravity quota is exhausted:

```bash
agy --dangerously-skip-permissions --output-format text --print="Read .claude/agents/ui-worker.md, then do DOCS/UI/tasks/<file>.md. Edit only the paths in its Lane section. Don't stop to ask. Don't commit." > DOCS/UI/handoffs/logs/<lane>.log 2>&1
```

> [!IMPORTANT]
> **Process and runner rules:**
> - **Runner scripts:** The night runner scripts `night-runner.sh` and `night-watcher.sh` die when their launching shell ends, so launch each worker with its own separate background call.
> - **Hung workers:** A worker that makes no file edits for 10 minutes, or an idle `agy` process after its handoff is written, must be stopped (`taskkill //IM agy.exe //F`) and relaunched once.
> - **Playwright cleanup:** Kill leftover Playwright `chromium-1248` processes after test runs (`taskkill //IM chrome.exe //F`).
> - **Dev server memory:** The dev server needs significant memory (a machine low on memory kills it); start only when needed, and stop before `npm run build` (they share `.next`).
> - **Never run mass rewriters:** Never run `eslint --fix`, prettier, or any command that rewrites many files (an earlier worker rewrote the line endings of 749 files).

---

## Index of kept task files

| File | What it covers |
|---|---|
| [`README.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/README.md) | This file: complete index of kept task files in `DOCS/UI/tasks/` |
| [`2026-11-04-design-system-audit-fixes.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-04-design-system-audit-fixes.md) | Wave 0 task for foundation: 8 themes without Plum, lane token blocks, and design system audit fixes |
| [`2026-11-04-persistence-wiring.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-04-persistence-wiring.md) | Shell persistence task: project boot, autosave, lock, status hook, and persistence banners |
| [`2026-11-05-e2e-migrate.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-e2e-migrate.md) | Shared task for parallel E2E test migration workers across spec groups G1 to G4 |
| [`2026-11-05-L0-foundation.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L0-foundation.md) | Wave 0 task: foundations, eight official themes, and per-lane token blocks in `tokens.css` and `tailwind.css` |
| [`2026-11-05-L1-top-bar.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L1-top-bar.md) | Wave 1 Lane L1: top bar, mode tabs with sliding highlight, logo saving trace, page switcher, 8-theme picker, Ship popover |
| [`2026-11-05-L2-left-panel.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L2-left-panel.md) | Wave 1 Lane L2: left panel (Layers tree with drag-to-reorder/nest, eye/lock, Motion badge, context menu), Files tree, Assets |
| [`2026-11-05-L3-design-inspector.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L3-design-inspector.md) | Wave 1 Lane L3: Design mode right panel inspector, 28px/11px mono field spec, repeatability popovers, page inspector |
| [`2026-11-05-L4-canvas.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L4-canvas.md) | Wave 1 Lane L4: canvas chrome (toolbar, Insert panel, AI box with trace loader, View options, context menus, stage) |
| [`2026-11-05-L5-motion-timeline.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L5-motion-timeline.md) | Wave 1 Lane L5: Motion bottom panel, shared motion model, 44px header, transport, resizable track column, clips, keyframes, mini-map |
| [`2026-11-05-L6-motion-inspector.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L6-motion-inspector.md) | Wave 1 Lane L6: Motion right panel (Composition, Layer clip, and Keyframe easing editor), Export panel (CSS, WAAPI, Framer, GSAP) |
| [`2026-11-05-L7-code-mode.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L7-code-mode.md) | Wave 1 Lane L7: Code bottom panel (Code, Console, Trace), code generator, canvas sync, right-panel code inspector |
| [`2026-11-05-L8-shell-transitions.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L8-shell-transitions.md) | Wave 2 Lane L8: full-width bottom panel, panel collapse/expand springs, mode-switch transitions, Shift+T toggle, splitter |
| [`2026-11-05-L9-design-system-page.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-L9-design-system-page.md) | Wave 2 Lane L9: wire 94 demo sections into `/design-system`, shared Slider, MenuHeading, ThemeSwatch, 8 themes |
| [`2026-11-05-merge-main.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-merge-main.md) | Task to merge `origin/main` (phases 39 to 81) into new UI branch, relocate main's old-UI files to `src/legacy-editor`, and establish `/editor/legacy` route |
| [`2026-11-05-real-document.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/tasks/2026-11-05-real-document.md) | Real document wiring: connect stage, layers, details, code-view, and timeline to engine document; remove demo stopgaps |

---

## What is NOT done (honest list)

1. **New-UI screens for main's features:** Pen and vector tools, auto layout, breakpoints, tokens, components and variants, templates, scroll model, export live only at `/editor/legacy`. They require designs from the design session (`DOCS/UI/design/REQUESTS.md`), then worker tasks to build in `src/editor`.
2. **Old-app areas with no new version:** 17 unbuilt areas: project launcher / hub home page, database studio, blueprint (currently shell only), content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace (standalone panel), render gallery, and fonts.
3. **The 65 `test.fixme` tests:** Marked with specific reasons, pending implementation of new-UI screens.
4. **Visual checks and compatibility:** Responsive 1024/390, reduced motion across all springs, six non-default themes visually, Firefox `field-sizing: content` support, and final side-by-side screenshots Paper and Dark.
5. **Timeline header token:** Token size is 44px (prototype task said 40).
6. **Legacy lint error:** 1 error in `src/legacy-editor/menus/UnifiedLogoMenu.tsx` (old code unchanged from main).
