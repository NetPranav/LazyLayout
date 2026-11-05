# Task: Left panel (`L2`), Wave 1

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md`. **L2 runs in parallel with six other lanes** in the same working tree. Only edit your lane paths.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes: read them, they are the rules), `DOCS/UI/PALETTE.md`, then the prototype lines listed below. Source of truth: `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P). Copy its layout, values and motion exactly. P is 7137 lines: open it with line ranges, never read it whole.
- **What exists today:** a first rebuild of every area already exists in `src/editor` (committed). It was built from an older version of P. **Treat it as a draft: bring it to P's current look and behaviour.** Keep exports and props that other lanes or `EditorShell.tsx` use (check with grep before renaming anything); wire to the real engine stores where the draft already does (`src/core`, read-only), and keep that wiring.
- **Wave 0 is done** before you start: eight themes (Paper default, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom; no Plum), tokens and a block for your lane in `tokens.css` and `tailwind.css` (`/* === lane: L2 ... === */`), shared components already fixed to the field spec.

## What to build (from P)

Read: CSS `211-253` (panels), `1107-1114` (Files panel), `4718-4792` (Design tab additions: layers rename, range select, drag, motion badge, blank page), `4808-4817` (assets header tools); JS `2682-2768` (left panel: layer search, assets collapsed by default, draggable divider; selection; eye toggle and Hide), `2769-2946` (context menus: the **layer row** menu is yours; the canvas and element menus belong to L4), `4078-4121` (Layers panel motion badge and dragging a layer onto the timeline), `6338-6424` (**Files panel** for Code mode), `7048-7067` (Files events). HTML: the `.left` element in `1313-1445`.

1. **Layers tree (Design and Motion):** header with page switcher slot and the search toggle (icon opens a search field, Escape closes; filter by name; non-matching rows hidden); rows 32px, indent per level through a tree-indent token, chevron, type icon, name, hover-only **eye and lock**, the **Motion badge** on animated layers (click opens Motion, scrolls to the layer and flashes its row, P `4078`), rename on double click or F2, **plain click selects, Shift+click adds, range select**, **drag to reorder and to nest** (drop line and nest highlight), expand and collapse on a spring, hidden layers dimmed, locked layers. Selection is the shared selection store (the draft is already wired through `useLeftPanelData`: keep that wiring).
2. **Layer context menu** (right click a row): items, order, separators, icons, shortcuts and submenus exactly as P `MENUS.layer`, `align`, `arrange`, `more` (around P `2249-2300`) plus the label colour submenu (P `4864`). Items the engine cannot do are shown disabled with a reason.
3. **Files tree (Code mode):** filter, search, folders that expand on a spring, a **modified dot** on changed files, right-click menu (P `7048-7067`), selected file row, folder and file icons, order of files as P.
4. **Tracks (Motion mode left column) is NOT yours:** the timeline's track column is L5. In Motion mode the left panel shows the Layers tree (P mirrors the timeline order).
5. **Assets:** collapsed bar (label, chevron, "+" and search buttons), expands on drag of the divider or click, tile grid, header tools (P `4808`).
6. Empty states: text only, no dead buttons.
Keep exports (`LeftPanel`, `LeftPanelFrame`..., check `index.ts`) and the props that `LeftPanelConnected` (in `panels/layers`, not yours) passes.

## Lane paths (the only files you may edit)

- `src/editor/shell/left-panel/**`
- `src/editor/design-system/demos/LeftPanelDemos.tsx` (new)

Tokens: add them only inside your lane block in `src/editor/styles/tokens.css` and `src/editor/styles/tailwind.css`, re-reading the file right before each edit. Never edit other shared files (`animations.css`, `globals.css`, `components/index.ts`, `design-system/DesignSystemPage.tsx`, `ComponentDemos.tsx`, `shell/EditorShell.tsx` belong to other lanes in this wave). A shared component (`Menu`, `Select`, `Button`, `NumberField`...) that needs a change is not yours: list it under "Needs from other lanes" and work around it with props or classes.

## Demos

Put every demo of what you built, with all its states, in `src/editor/design-system/demos/LeftPanelDemos.tsx` (create it; export one component per demo). Do not edit `DesignSystemPage.tsx` or `ComponentDemos.tsx`: Wave 2 wires your file into the page. Sample props only, never a store.

## Rules that matter here

Everything in `.claude/agents/ui-worker.md`, in particular: `ll:` prefix and variant order `ll:hover:`; no arbitrary values, hex, px or ms literals (tokens, or named constants in `motion/presets.ts`); React never owns classes or styles the motion engine writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on global classes; icons through `Icon`; no pills (radii 4/6/8); no glass; menus use the shared `Menu`; the field spec (28px, 11px mono values, prefixes inside); small targeted edits only, never rewrite or reformat whole files; no commits, no pushes, no `git add`/`stash`/`checkout`/`reset`.

## Done

1. **Compare, then fix.** For every state you build, open P and the app side by side in headless Playwright at 1440x900 (`executablePath`: the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `chrome-win64\chrome.exe`; P via `pathToFileURL`; the app at `http://localhost:3000/editor`, already running: never start `next dev` or `next build`). Measure boxes, fonts and colours of both (`getBoundingClientRect`, `getComputedStyle`) and fix until they match within 1px. Put a measured table in the handoff.
2. `npx tsc --noEmit` once at the end. Fix errors in your own files. List errors in other lanes' files without touching them. Do not run lint, build or e2e.
3. Screenshots of what you built, Paper and Dark, 1440, in `DOCS/UI/handoffs/screenshots/L2/`, prototype next to app.
4. Handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L2.md` from `TEMPLATE.md`: what you built, the real `tsc` output, the measured table, "Needs from other lanes", "Decisions", "Not done / blocked". Say what you did not verify. Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`.
5. Run every check in the foreground. **Never wait on a background task** (a worker that waits hangs). Finish when the handoff is written.
