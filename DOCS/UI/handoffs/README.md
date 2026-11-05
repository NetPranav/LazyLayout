# Handoffs

Every worker session ends with one handoff file here, so anyone can see what changed and why.

## Naming rule
- **Format:** `YYYY-MM-DD-HHMM-<short-name>.md`
- **Template:** Start from [`TEMPLATE.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/TEMPLATE.md)
- **Author:** The worker, written at the end of the session.
- **Review:** Claude (orchestrator) reviews with `ui-watcher` and records the verdict at the bottom.
- **Screenshots:** Placed in [`screenshots/<short-name>/`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/screenshots) (headless Playwright, 1440px default, Paper and Dark).

---

## Directories

- [`screenshots/`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/screenshots): Directory containing before/after visual proof screenshots across worker tasks (Playwright headless at 1440px in Paper and Dark themes).

---

## Index of kept handoffs

| File | What it covers |
|---|---|
| [`LATEST.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/LATEST.md) | Executive summary of branch state, phase check results, what was built, known gaps, PR #62 link, and open decisions |
| [`README.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/README.md) | This file: complete index of kept handoffs and directories in `DOCS/UI/handoffs/` |
| [`TEMPLATE.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/TEMPLATE.md) | Standard handoff template for all UI worker sessions |
| [`e2e-testids.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/e2e-testids.md) | Complete reference of test hooks (`data-testid` and `data-*` attributes) and old-to-new selector mappings |
| [`2026-11-04-1505-persistence-wiring.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-04-1505-persistence-wiring.md) | Project boot, autosave, lock, and persistence banners in EditorShell; `data-testid="save-status"` dot |
| [`2026-11-05-0000-L0.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0000-L0.md) | Wave 0 foundation: eight themes without Plum, label colours, lane token blocks, design system audit fixes |
| [`2026-11-05-0225-L4.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0225-L4.md) | Wave 1 Lane L4 Canvas: toolbar, Insert panel, AI box with trace loader, View options popover, context menus, stage |
| [`2026-11-05-0230-L2.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0230-L2.md) | Wave 1 Lane L2 Left panel: Layers tree (drag to reorder/nest, eye/lock, Motion badge, context menu), Files tree, Assets |
| [`2026-11-05-0240-L3.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0240-L3.md) | Wave 1 Lane L3 Design inspector: right panel sections for Design mode, 28px/11px mono field spec, repeatability popovers |
| [`2026-11-05-0250-L1.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0250-L1.md) | Wave 1 Lane L1 Top bar: logo button with saving trace, mode tabs with sliding highlight and menus, page switcher, 8-theme picker, Ship popover |
| [`2026-11-05-0250-L5.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0250-L5.md) | Wave 1 Lane L5 Motion timeline: full-width timeline panel, motion model, 44px header, transport, resizable track column, clips, keyframes, mini-map |
| [`2026-11-05-0253-L7.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0253-L7.md) | Wave 1 Lane L7 Code mode: code bottom panel, Code / Console / Trace tabs, live code generation, canvas sync, right-panel code inspector |
| [`2026-11-05-0300-L6.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0300-L6.md) | Wave 1 Lane L6 Motion inspector: Composition, Layer clip, and Keyframe inspectors, EasingEditor (Curve/Spring), Export panel |
| [`2026-11-05-0400-L9.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0400-L9.md) | Wave 2 Lane L9 Design system page: 94 demo sections wired, shared Slider, MenuHeading, ThemeSwatch, foundations for all 8 themes |
| [`2026-11-05-0942-L3.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-0942-L3.md) | Wave 1 Lane L3 Design inspector retry: ArchetypeId star and isObject3D casing fixes in DetailsInspector |
| [`2026-11-05-1125-e2e-g4.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1125-e2e-g4.md) | E2E migration Group G4 (stage WAAPI, stopwatch, text editing, timeline nav, tools, transform, camera, workspace): 8 passed, 33 fixme |
| [`2026-11-05-1130-e2e-g1.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1130-e2e-g1.md) | E2E migration Group G1 (align, assets, command bus, composition migration, creation tools, clock, editing, fonts, frames, hit testing): 11 passed, 28 fixme |
| [`2026-11-05-1130-e2e-g2.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1130-e2e-g2.md) | E2E migration Group G2 (images, inspector pro/simple, keybindings, layers, overlay modes, paint render, parity, persistence): 31 passed, 26 fixme |
| [`2026-11-05-1140-e2e-g3.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1140-e2e-g3.md) | E2E migration Group G3 (rules engine, playback clock, presets, property migration, render gallery, selection, snapping, stage engine): 24 passed, 9 fixme |
| [`2026-11-05-1200-L8.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1200-L8.md) | Wave 2 Lane L8 Shell layout and transitions: full-width bottom panel, panel collapse/expand springs, mode-switch transitions, Shift+T toggle, splitter |
| [`2026-11-05-1242-real-document.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1242-real-document.md) | Real-document wiring: stage, layers tree, inspector, code view, and timeline read and write real engine document; demo stopgaps removed; persistence and undo work |
| [`2026-11-05-1808-merge-main.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1808-merge-main.md) | Merge `origin/main` (phases 39 to 81) into new UI: main's old code in `src/legacy-editor`, served at `/editor/legacy`; `/editor` is new editor default |
| [`2026-11-05-1940-components-license.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1940-components-license.md) | Clean-room replacement of unverified Animate UI components (`Cursor`, `Scroll Fade`), removing `src/editor/components/imported/` and clearing license blockers |
| [`2026-11-05-1950-unfixme-a.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1950-unfixme-a.md) | Group A E2E un-fixme migration: re-enabling tests supported by real document (41 passed, 0 failed, 53 fixme) |
| [`2026-11-05-1958-unfixme-b.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-1958-unfixme-b.md) | Group B E2E un-fixme migration: re-enabling real document tests, making flaky timing tests robust |
| [`2026-11-05-2028-playback-fix.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-2028-playback-fix.md) | Timeline playback bug fix: fractional frame sub-frame accumulator in `MotionModelStore.ts` restoring 60 fps real playback speed |
| [`2026-11-05-2041-legacy-e2e.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-2041-legacy-e2e.md) | Legacy E2E restoration: `LegacyStudioHeader` with top-level menu bar on `/editor/legacy`, all 29 main specs passing 100% (138/138) |
| [`2026-11-05-2115-fix-8-tests.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-2115-fix-8-tests.md) | Fix 8 failing new-editor E2E specs by passing `/editor` explicitly while `openEditor` defaulted to legacy |
| [`2026-11-05-2148-e2e-target-audit.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-2148-e2e-target-audit.md) | E2E target audit & helper inversion: `openEditor` defaults to NEW editor (`EDITOR_URL = "/editor"`), exports `LEGACY_EDITOR_URL`, all specs explicit; 199 passed, 65 skipped (`test.fixme`), 0 failed, 0 flaky (264 tests) |
| [`2026-11-05-e2e-migration.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-e2e-migration.md) | E2E migration initial pass: support helpers (`waitSaved`, `focusApp`, `openFileMenu`, `openSequencer`) and transport-bar spec migration |

---

## What is NOT done (honest list)

1. **New-UI screens for main's features:** Features from main's phases 39 to 81 (pen and vector tools, auto layout, breakpoints, tokens, components and variants, MCP agent, templates, scroll model, export) live only at `/editor/legacy`. They require designs from the design session (`DOCS/UI/design/REQUESTS.md`), followed by worker tasks in `src/editor`.
2. **Old-app areas with no new version:** 17 unbuilt areas: project launcher / hub home page, database studio, blueprint (currently shell only), content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace (standalone panel), render gallery, and fonts.
3. **The 65 `test.fixme` tests:** Preserved with written reasons until their features are implemented in the new UI (full suite: 199 passed, 65 skipped, 0 failed, 0 flaky).
4. **Unchecked visual & platform items:** Responsive widths at 1024px and 390px, reduced motion verification across all springs, visual review of the six non-default themes, Firefox support for `NumberField` (`field-sizing: content`), and final side-by-side screenshots (Paper and Dark across Design, Motion, Code).
5. **Timeline header token:** Token size is 44px (prototype task said 40).
6. **Legacy lint error:** 1 error in `src/legacy-editor/menus/UnifiedLogoMenu.tsx` (setState in effect, old code unchanged from main).
