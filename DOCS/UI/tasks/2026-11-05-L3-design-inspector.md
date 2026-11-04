# Task: Design inspector (`L3`), Wave 1

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md`. **L3 runs in parallel with six other lanes** in the same working tree. Only edit your lane paths.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes: read them, they are the rules), `DOCS/UI/PALETTE.md`, then the prototype lines listed below. Source of truth: `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P). Copy its layout, values and motion exactly. P is 7137 lines: open it with line ranges, never read it whole.
- **What exists today:** a first rebuild of every area already exists in `src/editor` (committed). It was built from an older version of P. **Treat it as a draft: bring it to P's current look and behaviour.** Keep exports and props that other lanes or `EditorShell.tsx` use (check with grep before renaming anything); wire to the real engine stores where the draft already does (`src/core`, read-only), and keep that wiring.
- **Wave 0 is done** before you start: eight themes (Paper default, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom; no Plum), tokens and a block for your lane in `tokens.css` and `tailwind.css` (`/* === lane: L3 ... === */`), shared components already fixed to the field spec.

## What to build (from P)

Read: CSS `676-844` (right panel header and sections, section "more", alignment grid, fill/effect parts, **one-line rows and the settings popover**, design tab additions), `845-869` (accordion rows, shared field spec), `714-720` (**the field spec: 28px, padding 8, gap 8, 11px mono value weight 400 no tracking, prefix inside 11px mono 500 muted, focus border `--text`**); JS `1543-1772` (expanded "..." blocks as one property sheet: `lrow` = 72px label column + controls; repeatable rows: Fill, Stroke, Effects, Animation, Data, Logic, one line each, settings in one shared popover), `2968-3215` (Design inspector: every control visible and editable, sections rebuild on selection change), `4699-4717` (header status: Animated, Data bound), `7068-7137` (right panel events, inspector writes back to the model). HTML: `.right` in `1313-1445`, `#ins-design` (`1436`).

1. **Every section in Design mode as P**, for each element type (text, frame, box/button, image, line, circle, star, polygon, input, toggle, counter, 3D object): Position (align bar, X, Y, rotation; the "..." Offset mode where X/Y mirror Top/Left), Layout (W, H, sizing selects, clip toggle; for frames Free/Stack/Grid, direction, alignment grid, gap, padding, wrap), Appearance, Typography, Fill, Stroke, Effects, Animation, Data, Logic, Accessibility, plus each section's `...` sheet. Section titles 13px/500, sub-labels 12px sans muted, **no uppercase labels above fields**.
2. **Page inspector** (nothing selected): page name, size, background, theme and tokens (P: grep `Page` near `2968`).
3. **Repeatable rows** + the **row settings popover** (one shared floating panel aligned to its row: contents per type as P `1565-1772`).
4. **Header:** type icon + name 18px/600, eye, `...` menu (Reset, Delete) 200px wide, status chips (Animated / Data bound, click scrolls to the section).
5. **Expanded AI** view of the right panel (P `371-420`, `1773-1835`): header, messages, input (borderless, visible focus ring). The AI box that opens it is L4's; `RightPanelFrame` already takes `aiOpen`/`onAiClose`.
6. Fields write to the engine through the existing wiring (`useSelectionInspector`, `setLayerProps`): keep it. The **demo-data stopgap** (`PROTOTYPE_ELEMENTS`) stays until the stage reads a real document (a later task): do not extend it.
Keep exports and props used by `RightPanelConnected` (in `shell/`, not yours) and the design system labs under `src/app/design-system/details`.

## Lane paths (the only files you may edit)

- `src/editor/panels/details/**`
- `src/editor/shell/right-panel/**`
- `src/editor/design-system/demos/InspectorDemos.tsx` (new)

Tokens: add them only inside your lane block in `src/editor/styles/tokens.css` and `src/editor/styles/tailwind.css`, re-reading the file right before each edit. Never edit other shared files (`animations.css`, `globals.css`, `components/index.ts`, `design-system/DesignSystemPage.tsx`, `ComponentDemos.tsx`, `shell/EditorShell.tsx` belong to other lanes in this wave). A shared component (`Menu`, `Select`, `Button`, `NumberField`...) that needs a change is not yours: list it under "Needs from other lanes" and work around it with props or classes.

## Demos

Put every demo of what you built, with all its states, in `src/editor/design-system/demos/InspectorDemos.tsx` (create it; export one component per demo). Do not edit `DesignSystemPage.tsx` or `ComponentDemos.tsx`: Wave 2 wires your file into the page. Sample props only, never a store.

## Rules that matter here

Everything in `.claude/agents/ui-worker.md`, in particular: `ll:` prefix and variant order `ll:hover:`; no arbitrary values, hex, px or ms literals (tokens, or named constants in `motion/presets.ts`); React never owns classes or styles the motion engine writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on global classes; icons through `Icon`; no pills (radii 4/6/8); no glass; menus use the shared `Menu`; the field spec (28px, 11px mono values, prefixes inside); small targeted edits only, never rewrite or reformat whole files; no commits, no pushes, no `git add`/`stash`/`checkout`/`reset`.

## Done

1. **Compare, then fix.** For every state you build, open P and the app side by side in headless Playwright at 1440x900 (`executablePath`: the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `chrome-win64\chrome.exe`; P via `pathToFileURL`; the app at `http://localhost:3000/editor`, already running: never start `next dev` or `next build`). Measure boxes, fonts and colours of both (`getBoundingClientRect`, `getComputedStyle`) and fix until they match within 1px. Put a measured table in the handoff.
2. `npx tsc --noEmit` once at the end. Fix errors in your own files. List errors in other lanes' files without touching them. Do not run lint, build or e2e.
3. Screenshots of what you built, Paper and Dark, 1440, in `DOCS/UI/handoffs/screenshots/L3/`, prototype next to app.
4. Handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L3.md` from `TEMPLATE.md`: what you built, the real `tsc` output, the measured table, "Needs from other lanes", "Decisions", "Not done / blocked". Say what you did not verify. Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`.
5. Run every check in the foreground. **Never wait on a background task** (a worker that waits hangs). Finish when the handoff is written.
