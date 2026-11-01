# Task: Shell step 2, left rail and left panel (dark first, no accent)

**Area:** `shell` in `DOCS/UI/PARITY.md` (stays `wip`). Read `DOCS/UI/UI_RULES.md`, `PALETTE.md` and the existing `src/editor/shell/EditorShell.tsx` first.
**Goal:** `/editor` shows the top bar, a left rail, a left panel and the empty canvas. No accent color: selection is shown with neutral tokens only.

## Build

1. **Components** in `src/editor/components/`, each on `/design-system` with all states (default, hover, focus, active, disabled):
   - `RailTab`: 44px wide, 44px tall icon button (lucide icons, one stroke weight), tooltip with the label on the right side. Active state: `surface-panel` is the rail color, so the active tab sits on `surface-raised` with primary text and a 2px `text-primary` marker on the rail's inner edge. Inactive: `text-muted`.
   - `LeftRail`: vertical strip, `surface-panel`, hairline right border, tabs top-aligned (Layers, Assets, Components), `role="tablist"` vertical, arrow-key movement.
   - `PanelHeader`: micro label title (uppercase, tracked) with hairline below, optional actions slot.
   - `LayerRow`: tree row, 28px tall, hairline above each row, indent by depth with spacing tokens, expand chevron, icon, name, hover and selected states using `surface-bar` (selected also has primary text; no accent color). Keyboard: up/down/left/right/Enter.
   - `LeftPanel`: `surface-panel`, 240px wide by default, content swaps by active tab (120ms opacity, reduced motion respected).
2. **Layers tab:** a tree of layers using the imported File Tree from `src/editor/components/imported/` for structure and expand behavior. Do NOT edit files in `imported/`. Wrap or compose it with `LayerRow` styling where needed. Use the real project tree from the `@/core` store if one exists and is readable; otherwise use clearly marked example data. Selecting a row only changes local state in this step.
3. **Assets and Components tabs:** a quiet empty state each: one line of `text-secondary` and nothing else.
4. **Collapse and resize:** the panel collapses with a button in `PanelHeader` and by shortcut `Ctrl+B`. Dragging its right edge resizes between 200px and 360px. The size and open state persist in `localStorage` (try/catch). Only animate `transform` and `opacity`.
5. **Wire into `EditorShell.tsx`:** layout below the top bar is rail, panel, canvas. Keep existing top bar behavior. Mobile (390): the panel becomes an overlay sheet opened from the rail; rectangles only.
6. Add all new components to `src/editor/components/index.ts` and to the `Components` list on the design system page.

## Rules
- Tokens only, `ll:` prefix, no arbitrary values, no raw colors, no pills, no blur or glass, no accent color.
- Log your choices in `DECISIONS.md` as `worker (Antigravity)`, pending. Update `PARITY.md` notes and `INTEGRATION.md` if you use an engine store.
- Do not touch `src/core`, `src/legacy-editor`, `package.json`, or `imported/`.

## Speed rules
- Write all files first, in one pass. No typecheck, lint, build or e2e.
- One Playwright run (`chromium.launch({ channel: "chrome" })`): start `npx next dev -p 3000` once, screenshot `/editor` at 1440, 1024 and 390 (dark, panel open; plus 1440 with the panel collapsed) and `/design-system#components`, stop the server.
- Do not re-read files you wrote. Write the handoff last. No commit. Log to the scratchpad, not the repo.
