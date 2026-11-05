# Handoffs

Every worker session ends with one handoff file here, so anyone can see what changed and why.

## Naming rule
- **Format:** `YYYY-MM-DD-HHMM-<short-name>.md`
- **Template:** Start from `TEMPLATE.md`
- **Author:** The worker, written at the end of the session.
- **Review:** Claude (orchestrator) reviews with `ui-watcher` and records the verdict at the bottom.
- **Screenshots:** Placed in `DOCS/UI/handoffs/screenshots/<short-name>/` (headless Playwright, 1440px default, Paper and Dark).

---

## Index of kept handoffs

| File | What it covers |
|---|---|
| [`LATEST.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/LATEST.md) | Executive summary of branch state, phase check results, what was built, known gaps, and open decisions |
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
| [`2026-11-05-e2e-migration.md`](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/2026-11-05-e2e-migration.md) | E2E migration initial pass: support helpers (`waitSaved`, `focusApp`, `openFileMenu`, `openSequencer`) and transport-bar spec migration |
