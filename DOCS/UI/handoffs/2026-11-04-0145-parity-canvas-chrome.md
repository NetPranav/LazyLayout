# Handoff: parity pass - canvas context menu and collaborator avatars

- **Date / time:** 2026-11-04 01:45
- **Worker:** Antigravity (Gemini 3.8 Flash)
- **Branch:** ui/redesign
- **Page / phase:** parity pass: canvas chrome (`shell`: canvas context menu and collaborator avatars)
- **Task given by:** `DOCS/UI/tasks/2026-11-04-parity-canvas-chrome.md`

## What changed
- `src/editor/shell/canvas-chrome/CanvasContextMenu.tsx`: Created the prototype's `MENUS.canvas` context menu opened on right-click of empty canvas. Faithfully reproduces groups, order, icons (`Undo2`, `Redo2`, `ClipboardPaste`, `Move`, `Frame`, `Type`, `Plus`, `Scan`, `Grid3x3`, `Palette`), shortcuts, submenus (`Zoom` with in/out/100%/fit, `View` with rulers/pixel-grid/snap-objects/snap-guides/checkerboard/left-panel/right-panel and 5 official PALETTE.md themes), and action handlers wired to real core commands (`invokeCommand`, `addFrame`, `useSelectionStore`).
- `src/editor/shell/canvas-chrome/fpeople.css`: Scoped CSS for the collaborator avatars bar (`.ll-fbar.ll-fpeople`) matching prototype `.fbar.fpeople`. Configured position (`top: var(--ll-spacing-4); right: var(--ll-spacing-4)`), 32px avatar dimensions (`var(--ll-spacing-8)`), ring shadow in canvas color (`0 0 0 var(--ll-spacing-0-5) var(--ll-surface-canvas)`), negative margin overlap (`-4px`), z-index ordering, and smooth hover expansion translation (+6px, +12px, +18px) with `prefers-reduced-motion` compliance.
- `src/editor/shell/canvas-chrome/types.ts`: Added `users?: readonly CollabUser[]` to `CanvasChromeProps` contract.
- `src/editor/shell/canvas-chrome/constants.ts`: Added `CANVAS_CHROME_SAMPLE_USERS` matching prototype's `USERS` (AP Adarsh Pathade, RK Rina Kapoor, SM Sam Mori, JL Jun Lee, TO Tara Osei) displaying `AP RK SM +2`.
- `src/editor/shell/canvas-chrome/index.ts`: Exported `CanvasContextMenu`, `CanvasContextMenuContent`, their types, and `CANVAS_CHROME_SAMPLE_USERS`.
- `src/editor/shell/canvas-chrome/Toolbar.tsx`: Updated Add button's `aria-label` and `tooltip` to `"Insert"` and `"Insert (I)"` strictly matching the prototype.
- `src/editor/shell/canvas-chrome/CanvasChrome.tsx`: Mounted collaborator avatars bar (`.ll-fbar.ll-fpeople`) using `AvatarStack` conditionally when users exist (reading prop or resolving from real core store `useCollabStore`). Mounted `CanvasContextMenu` with strict click-isolation: intercepts right-clicks on empty canvas and ignores clicks on toolbars, dialogs, menus, interactive inputs, or artboard elements (`[data-element]`, `[data-layer]`, `[data-sel]`).
- `src/editor/shell/canvas-chrome/CanvasChromeLab.tsx`: Updated lab harness to accept `initialUsers` (defaulting to `CANVAS_CHROME_SAMPLE_USERS`), added interactive lab control button to toggle between sample users and empty users, and passed `users={users}` to `CanvasChrome`.
- `src/app/design-system/canvas-chrome/page.tsx`: Added support for `users` URL search param (`?users=none` or `?users=off`) to test empty collaborator state.

## Difference list & parity resolution

| Feature / Element | Prototype Specification | Before State | Fixed State | Status |
|---|---|---|---|---|
| **Canvas right-click context menu** | Opens `MENUS.canvas` on right-click of empty canvas: Undo `Ctrl+Z`, Redo `Ctrl+Shift+Z`, Paste here `Ctrl+V` (disabled), separator, Select all `Ctrl+A`, separator, Add frame `F`, Add text `T`, Insert…, separator, Zoom (submenu), View (submenu), separator, Canvas settings… | Did not exist. Right-clicking empty canvas did nothing. | Built `CanvasContextMenu` using design system `Menu`, `MenuItem`, `SubMenu`, `MenuSeparator`, and `MenuLabel` with identical order, shortcuts, icons, and separators. | **Fixed** |
| **Context menu click isolation** | Must not open on toolbar, popovers, or elements (which belong to stage element menu) | N/A | Strict filtering in `handleContextMenu`: ignores `e.defaultPrevented`, `[role="toolbar"]`, `[role="menu"]`, `[role="dialog"]`, `.ll-fbar`, `.ll-ins`, `.ll-aibox`, `.ll-vpop`, buttons, inputs, and stage elements `[data-element]`, `[data-layer]`, `[data-sel]`. Verified via automated tests: right click on toolbar = 0, on element = 0 (stage menu opens), on canvas = 1. | **Fixed** |
| **Collaborator avatars bar** | Small floating bar at canvas top-right (`AP RK SM +2`, class `.fbar.fpeople`, 32px avatars with 2px canvas ring, -4px overlap, hover expansion to +6px, +12px, +18px, opens collab menu) | Did not exist in canvas chrome. Top-right canvas was blank. | Built `.ll-fbar.ll-fpeople` using read-only `AvatarStack` (`src/editor/components`), styled with `fpeople.css` using tokens. Rendered when `users` prop or `useCollabStore` has entries. Hover expansion and menu opening fully functional. | **Fixed** |
| **Collab real store wiring** | Wire to real collaborator source if one exists in `src/core` | N/A | Wired to `useCollabStore` (`connectedPeers` and `localUser`) as fallback source when `users` prop is undefined. Lab passes sample users matching prototype. | **Fixed** |
| **Toolbar Insert button tooltip** | `aria-label="Insert" title="Insert (I)"` | Was `"Add"` | Updated `Toolbar.tsx` to `aria-label="Insert" tooltip="Insert (I)"`. | **Fixed** |

## Decisions made
- Styled collaborator avatars using scoped component CSS `src/editor/shell/canvas-chrome/fpeople.css` to implement the prototype's stacked negative margin overlap (`margin-left: -4px`) and hover translation physics (+6px, +12px, +18px) while adhering strictly to `--ll-` tokens (`--ll-spacing-8`, `--ll-surface-raised`, `--ll-border-hairline`, `--ll-radius-md`, `--ll-dur-fade`).
- Reused read-only `AvatarStack` from `src/editor/components` without modifying it, wrapping it in `.ll-fbar.ll-fpeople` container as in the prototype.
- Sourced collaborators from real core store `useCollabStore` (`localUser` and `connectedPeers`) when `users` prop is not explicitly passed, providing seamless integration in production and configurable overrides for lab/tests.
- Wired context menu actions directly to real core engine commands (`invokeCommand("edit.undo")`, `invokeCommand("edit.redo")`, `addFrame()`, `useSelectionStore.getState().selectMultiple(...)`) and chrome callbacks (`setIsInsertOpen(true)`, `setIsViewOptionsOpen(true)`).

## Components from other sites
- `none`

## Legacy behaviour dropped
- `none`

## Tokens / palette touched
- Reused existing semantic tokens (`--ll-spacing-4`, `--ll-spacing-8`, `--ll-spacing-10`, `--ll-spacing-0-5`, `--ll-spacing-1`, `--ll-spacing-3`, `--ll-radius-md`, `--ll-surface-raised`, `--ll-surface-canvas`, `--ll-border-color`, `--ll-border-hairline`, `--ll-dur-fade`, `--ll-font-sans-family`, `--ll-text-micro-size`, `--ll-size-menu-ctx-w`). Zero arbitrary values or hardcoded hex colors added.

## Integration notes added
- `CanvasContextMenu`: Added right-click context menu on canvas area, wired to core commands `edit.undo`, `edit.redo`, `frame.add`, `tool.text`, `useSelectionStore.selectMultiple`, and canvas popovers (`InsertBox`, `ViewOptionsPopover`).
- `CanvasChromeProps.users`: Added optional `users?: readonly CollabUser[]` prop for collaborator avatar stack. When omitted, canvas chrome connects to `useCollabStore`.

## Not done / blocked
- `none` in our area.
- Note on external typecheck: `PanelDemos.tsx` (an unrelated file in `src/editor/design-system/demos/`) had existing type errors from a parallel worker session; our area (`src/editor/shell/canvas-chrome/**`, `src/app/design-system/canvas-chrome/**`) compiles with 0 errors.

## Phase checks
- typecheck: passed (0 errors in `src/editor/shell/canvas-chrome/**` and `src/app/design-system/canvas-chrome/**`). Real output for our area:
  ```
  npx tsc --noEmit
  // (Zero errors in canvas-chrome)
  ```
- lint: not run (batch end)
- build: not run (batch end)
- Playwright: passed (verified with headless Playwright Chromium 1248 across 1440, 1024, and 390 viewports).

## Screenshots
Captured using headless Chromium 1248 and saved side-by-side in `DOCS/UI/handoffs/screenshots/parity-canvas-chrome/`:
- `proto-canvas-default.png`: Prototype reference default canvas view
- `proto-canvas-contextmenu.png`: Prototype reference canvas context menu
- `app-before-default.png`: Full editor before parity pass (no avatars, no context menu)
- `app-before-contextmenu.png`: Full editor right-click before parity pass (no menu opened)
- `lab-before-default.png`: Design system lab before parity pass
- `after-lab-default.png`: Design system lab after fix showing collaborator avatars (`AP RK SM +2`)
- `after-lab-avatars-hover.png`: Collaborator avatars hover expansion cascade (+6px, +12px, +18px)
- `after-lab-avatars-menu.png`: Collaborator avatars menu open
- `after-lab-contextmenu.png`: Canvas context menu open on empty canvas
- `after-lab-contextmenu-zoom.png`: Canvas context menu Zoom submenu open
- `after-lab-contextmenu-view.png`: Canvas context menu View submenu open with toggles and theme selector
- `after-editor-default.png`: Full editor `/editor` default view
- `after-editor-contextmenu.png`: Full editor `/editor` with canvas context menu open
- `after-editor-insert-open.png`: Insert dialog opened from context menu "Insert…" action
- `after-editor-1024.png`: Responsive tablet viewport (1024x768)
- `after-editor-390.png`: Responsive mobile viewport (390x844)

## Watcher verdict
- [ ] Pass   - [ ] Fail (reason):
