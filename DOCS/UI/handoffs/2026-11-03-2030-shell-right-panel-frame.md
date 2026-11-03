# Handoff: shell: right panel frame

- **Date / time:** 2026-11-03 20:30
- **Worker:** Antigravity
- **Branch:** ui/redesign
- **Page / phase:** Phase 1 (shell)
- **Task given by:** DOCS/UI/tasks/2026-11-03-shell-right-panel-frame.md

## What changed
- `src/editor/shell/right-panel/types.ts`: Type definitions for `RightPanelMode`, `DesignSectionConfig`, `AccordionRowConfig`, `AiChatMessage`, `StatusChip`, and `RightPanelFrameProps`.
- `src/editor/shell/right-panel/RightPanelHeader.tsx`: Header component with selection icon, name, hide-layer toggle (`aria-pressed`), more options button, and jump status chips ("Animated", "Data bound").
- `src/editor/shell/right-panel/RightPanelSection.tsx`: Collapsible design section frame with flipping chevron (`ll:rotate-90`), keyboard handling, `aria-expanded`, `moreContent` drawer, `onAdd` action, and children slot with empty-state placeholder.
- `src/editor/shell/right-panel/RightPanelAccordionRow.tsx`: Inspector accordion row for Key/Motion and Code spec sheets, with label, right-aligned mono value (muted when none/0/Off), flipping chevron, and children slot.
- `src/editor/shell/right-panel/RightPanelAiChat.tsx`: Expanded AI chat view swapping the inspector body, with sparkles logo, title, close button, message log, and input row with send button.
- `src/editor/shell/right-panel/RightPanelFrame.tsx`: Master inspector frame component controlling display between Design, Motion, Code, and expanded AI view with smooth section jump scrolling and default prototype configurations.
- `src/editor/shell/right-panel/RightPanelLabView.tsx`: Interactive lab workbench allowing switching between Design, Motion, Code, and AI modes on a simulated 1440x900 canvas.
- `src/editor/shell/right-panel/index.ts`: Public module exports for `RightPanelFrame` and supporting types/components.
- `src/app/design-system/right-panel/page.tsx`: Lab page with `labsEnabled` guard and Suspense wrapper rendering the 1440x900 workbench.

## Decisions made
- Used `ll:text-lead` (16px) with `ll:font-semibold` for `.rname` selection title as the closest existing design token to the prototype's 18px font size without adding arbitrary values.
- In Motion and Code modes, hidden `.rhead` per prototype rule `.app[data-mode=motion] .rhead, .app[data-mode=code] .rhead { display: none }`.
- Implemented smooth in-panel scroll to sections when clicking status chips ("Animated" -> Animation section, "Data bound" -> Data section).
- Provided default prototype previews for the default-open rows (`Easing` curve in Motion, `Props` in Code) while all other sections/rows provide a clean dashed empty-state placeholder when no children are passed.

## Components from other sites
- none

## Legacy behaviour dropped
- none

## Tokens / palette touched
- Token wish: A dedicated 18px font size token (`--ll-text-title-lg: 18px`) for panel selection titles (currently mapped to `ll:text-lead`).

## Integration notes added
- `RightPanelFrame` exported from `src/editor/shell/right-panel` is ready for integration into `EditorShell.tsx` (right zone). It receives `mode: "design" | "motion" | "code"` from top bar mode or editor store and `aiOpen` state from the floating AI bar expand action.

## Not done / blocked
- none

## Phase checks
- typecheck: passed (`npx tsc --noEmit` exited with 0 errors)
- lint: not run
- build: not run
- Playwright: passed (captured 4 headless screenshots at 1440 width)

## Screenshots
- DOCS/UI/handoffs/screenshots/right-panel/right-panel-design.png
- DOCS/UI/handoffs/screenshots/right-panel/right-panel-motion.png
- DOCS/UI/handoffs/screenshots/right-panel/right-panel-code.png
- DOCS/UI/handoffs/screenshots/right-panel/right-panel-ai-chat.png

## Watcher verdict
- [ ] Pass   - [ ] Fail (reason):


## Retry 1: Review fixes (2026-11-03)

### Changes made
1. **No `setState` in effect**: Removed `useEffect` and `useSearchParams` from `RightPanelLabView.tsx`. `page.tsx` now handles `searchParams` asynchronously on the server and passes `initialMode` and `initialAi` as initial state values to `RightPanelLabView`.
2. **No translucent surfaces**: Removed all opacity slashes (`/30`, `/40`, `/20`). All surfaces use solid `ll:bg-surface-bar` or `ll:bg-surface-canvas`.
3. **Ids from `useId()`**: Generated dynamic ids using `useId()` for the panel body, mode bodies, AI chat input, and lab mode toggle buttons. Ensured `aria-controls` targets (`bodyId` in `RightPanelSection` and `contentId` in `RightPanelAccordionRow`) always exist in the DOM with `hidden={!isOpen}` when collapsed.
4. **Prefixed / eliminated global classes**: Replaced all unprefixed class names with `ll-` prefixes (`ll-zone`, `ll-right`, `ll-zbody`, `ll-rhead`, `ll-rtop`, `ll-rico`, `ll-rname`, `ll-rstat`, `ll-rs`, `ll-dsec`, `ll-dtitle`, `ll-dbody`, `ll-dmore`, `ll-prow`, `ll-prow-h`, `ll-pl`, `ll-pv`, `ll-car`, `ll-sec`, `ll-aichat`, `ll-aichead`, `ll-aimark`, `ll-aitl`, `ll-ailist`, `ll-aimsg`, `ll-you`, `ll-aichatfoot`, `ll-airow`, `ll-aisend`). Replaced `.sp` spacer elements with `ll:flex-1`.
5. **Hide-layer toggle `aria-pressed`**: Explicitly passed `aria-pressed={isLayerHidden}` to `IconButton` in `RightPanelHeader.tsx`.
6. **Reduced motion**: Added `ll:motion-reduce:transition-none` to the chevron transition classes in `RightPanelSection.tsx` and `RightPanelAccordionRow.tsx`.
7. **Frame only**: Removed custom field widgets (`EasingRowContent` curve and x1/y1/x2/y2 boxes, and `PropsRowContent`). Design sections now show an empty placeholder using the `EmptyState` component with solid styling and hidden canvas action buttons. Moved fake `moreContent` stubs to `RightPanelLabView.tsx`. Removed default `onAdd: () => {}` stubs so Add buttons only render when a real handler is provided.
8. **Focus rings**: AI chat text input now has a visible focus ring (`ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:focus-visible:border-primary`) matching other controls. Verified status chip and section header focus rings are visible on panel background.
9. **Status chips open & scroll**: Lifted `openSectionIds` state to `RightPanelFrame.tsx`. Clicking a status chip opens the targeted section if closed and scrolls smoothly to it, respecting `prefers-reduced-motion`.
10. **Tidy-ups**: Replaced `Date.now()` in `RightPanelLabView.tsx` with an incrementing ref. Consolidated default chat messages into `RightPanelLabView.tsx`, removing the duplicate copy in `RightPanelAiChat.tsx`.
11. **Retook all four screenshots**: Headless Playwright at 1440x900 for Design, Motion, Code, and AI Chat views.

### Behavior note
- All design sections and accordion rows are collapsible with no persisted storage state (ephemeral component state).

### Token wishes kept
- `--ll-text-title-lg: 18px` for selection title names (`.ll-rname` currently using `ll:text-lead` 16px).
- `--ll-text-section-title: 13px` for section header titles (currently using `ll:text-small` 12px).

### Phase checks (Retry 1)
- typecheck: `npx tsc --noEmit` executed:
```
src/editor/shell/left-panel/LeftPanel.tsx(182,11): error TS2322: Type '{ files: FileItem[]; selectedIds: string[]; expandedIds: string[]; searchQuery: string; onSelect: (id: string, e?: MouseEvent<Element, MouseEvent> | KeyboardEvent<...> | undefined) => void; onToggleExpand: (id: string) => void; onRename: ((id: string, newName: string) => void) | undefined; onMatchCountChange: Dispat...' is not assignable to type 'IntrinsicAttributes & FilesTreeProps'.
  Property 'onMatchCountChange' does not exist on type 'IntrinsicAttributes & FilesTreeProps'.
src/editor/shell/left-panel/LeftPanel.tsx(195,11): error TS2322: Type '{ layers: LayerItem[]; selectedIds: string[]; expandedIds: string[]; searchQuery: string; onSelect: (id: string, e?: MouseEvent<Element, MouseEvent> | KeyboardEvent<...> | undefined) => void; ... 4 more ...; onMatchCountChange: Dispatch<...>; }' is not assignable to type 'IntrinsicAttributes & LayersTreeProps'.
  Property 'onMatchCountChange' does not exist on type 'IntrinsicAttributes & LayersTreeProps'.
```
*(Zero errors in `src/editor/shell/right-panel/**` and `src/app/design-system/right-panel/**`; the above 2 errors originate from `src/editor/shell/left-panel/LeftPanel.tsx` in a concurrent worker branch).*
- Playwright: All 4 screenshots updated in `DOCS/UI/handoffs/screenshots/right-panel/`.

---

## Retry 2 (2026-11-03)

### Changes made
1. **Dynamic unique IDs derived from `useId()`:**
   - Section body IDs (`RightPanelSection.tsx`) and accordion content IDs (`RightPanelAccordionRow.tsx`) are now generated directly as `${autoId}-body` and `${autoId}-content` from React's `useId()`, eliminating static/fixed strings like `position-body` or `layer-content`.
   - The config ID is preserved cleanly as `data-section-id` / `data-row-id` attributes on the container elements.
   - Smooth scrolling target lookups remain strictly scoped to the frame container's own ref (`bodyRef.current.querySelector('[data-section-id="..."]')`), never searching global `document`.
2. **Replaced `EmptyState` with local placeholder (`RightPanelEmptyPlaceholder.tsx`):**
   - Removed `EmptyState` and the arbitrary `[&_.esb]:ll:hidden` class in `RightPanelSection.tsx`.
   - Created `src/editor/shell/right-panel/RightPanelEmptyPlaceholder.tsx` providing a clean, single-line muted text placeholder with a dashed border (`ll:border-dashed ll:border-border`), solid neutral background (`ll:bg-surface-bar`), token padding (`ll:py-2.5 ll:px-3`), and modest radius (`ll:rounded-sm`).
   - Completely eliminated dead action buttons ("Add frame", "Insert", "Ask AI") and right-edge button clipping.
   - Standardized the Motion and Code accordion row empty fallbacks (`RightPanelAccordionRow.tsx`) to render the same consistent placeholder component.
3. **Retook all four screenshots:**
   - Playwright headless with Chromium 1248 at 1440x900 captured clean screenshots in `DOCS/UI/handoffs/screenshots/right-panel/`:
     - `right-panel-design.png`: Clean section bodies with dashed placeholder boxes, no dead or clipped buttons.
     - `right-panel-motion.png`: Accordion rows with consistent placeholder fallback.
     - `right-panel-code.png`: Accordion rows with consistent placeholder fallback.
     - `right-panel-ai-chat.png`: Expanded AI chat with header, message list, input, and send affordance.

### Phase checks (Retry 2)
- typecheck: `npx tsc --noEmit` executed:
```
Exit code: 0 (clean, 0 errors across the entire repository)
```
- Playwright: All 4 screenshots updated in `DOCS/UI/handoffs/screenshots/right-panel/`.

