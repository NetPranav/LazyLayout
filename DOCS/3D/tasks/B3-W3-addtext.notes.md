# B3-W3-addtext progress notes

## 2026-11-12 - Task Kickoff
- **Task**: B3-W3-addtext: UI for Add menu (Shift+A / Add button), on-object primitive handles (`PrimitiveHandles.tsx`), and 3D text UI (`TextEditOverlay3d.tsx`, `TextPanel3d.tsx`, `textFontSeam.ts`), plus e2e and unit tests.
- **Rules checked**:
  - Additive only: never rename or delete existing exports.
  - UI in `src/editor/viewport3d/` with Tailwind `ll:` prefix and CSS tokens.
  - Do NOT touch `src/editor/panels/*` or stage, only additive mount in `ViewportInteraction.tsx`.
  - Design system demo on `/design-system`, decisions in `DOCS/UI/DECISIONS.md`.
  - Seam `window.__LL_TEST_FONT__` for base64 font in tests.
  - Pure unit tests and e2e in `tests/e2e/add3d.spec.ts`.

## Step 1: Create `src/editor/viewport3d/textFontSeam.ts`
- **What**: Create `textFontSeam.ts` to implement `fetchFontBuffer` and install it into `setFontBufferFetcher` from `src/core/3d/text/fontCache.ts`. When `window.__LL_TEST_FONT__` (base64 string of Geist) is present, decode it to an `ArrayBuffer` and immediately register it via `registerFontBuffer("Geist", buffer)`.
- **Why**: Pure core in `src/core/3d/text/` cannot access DOM or `window`. `textFontSeam.ts` sits in `src/editor/viewport3d/` and provides the test seam for automated e2e testing with zero network requests.
- **Alternatives rejected**: Modifying `src/core/3d/text/fontCache.ts` directly was rejected because `src/core/` must not touch DOM/window and must remain strictly pure.

## Step 2: Update `src/editor/viewport3d/addAtCursor.ts`
- **What**: Add `"3d.add.circle"`, `"3d.add.capsule"`, `"3d.add.rounded_box"`, and `"3d.add.text"` to `ADD_PRIMITIVE_COMMAND_IDS`.
- **Why**: The Add menu includes all 10 procedural mesh primitives plus 3D Text. Adding them to `ADD_PRIMITIVE_COMMAND_IDS` ensures `installAddAtCursorWrapper` and `addPrimitiveAtCursor` wrap them to place them at the active 3D cursor.
- **Alternatives rejected**: Writing separate add-wrapper logic for text and new primitives was rejected to maintain DRY single source of cursor resolution.

## Step 3: Create `src/editor/viewport3d/AddMenu3d.tsx`
- **What**: Create `AddMenu3d.tsx` implementing the Blender-style Add menu (Mesh primitives, Text, Light, Camera, Empty), command `3d.menu.add` with `Shift+A` shortcut guarded by `editingScene3d`, search filtering, keyboard arrow navigation, Escape to close, and an `AddMenuButton` header strip button.
- **Why**: Fulfills Task 3D-025 specification for fast primitive creation at the 3D cursor from keyboard and header chrome.
- **Alternatives rejected**: Native browser context menus were rejected because they cannot support live search filtering, nested Blender categories, or custom token styling.

## Step 4: Create `src/editor/viewport3d/PrimitiveHandles.tsx`
- **What**: Create `PrimitiveHandles.tsx` SVG overlay rendering diamond-shaped handles for selected procedural primitive objects using `handles(params)`. Supports camera projection, stage zoom scaling, ray-to-axis dragging with live `3d.primitive.set_param` updates coalesced via `documentCommands.begin(...)` / `commit()` / `cancel()`, and live numeric readout.
- **Why**: Allows direct on-canvas spatial editing of primitive parameters (e.g. cylinder depth, cube width, sphere radius) with 1 undo step.
- **Alternatives rejected**: HTML DOM overlays were rejected because SVG overlays avoid layout shifts, support precise pixel diamonds, and align with `GizmoOverlay.tsx`.

## Step 5: Create `src/editor/viewport3d/TextEditOverlay3d.tsx`
- **What**: Create `TextEditOverlay3d.tsx` and `useTextEditRequest3d` store to handle in-place floating text editing for 3D text objects. Floating input projects over the object's 3D location, runs `3d.text.set` on change, finishes on Enter/blur, and reverts on Escape.
- **Why**: Fulfills Phase 3D-026 requirement where adding Text or double-clicking text immediately opens in-place editing as in Figma / LazyLayout 2D text tool.
- **Alternatives rejected**: Modal dialog prompt was rejected because in-place canvas typing matches the 2D text tool pattern.

## Step 6: Create `src/editor/viewport3d/TextPanel3d.tsx`
- **What**: Create `TextPanel3d.tsx` displaying editable properties for the selected 3D text object: text string, size, depth, bevel depth, bevel resolution (bevelSegments), alignment, tracking, and a "Convert to mesh" action button running `3d.text.convert_to_mesh`.
- **Why**: Fulfills Phase 3D-026 requirement for contextual floating parameter panel positioned next to Adjust Last Operation panel.
- **Alternatives rejected**: Mounting in the main right panel was rejected because the task specifically assigns viewport floating HUD chrome next to `AdjustLastOperationPanel`, while other tasks own `src/editor/panels/*`.

## Step 7: Update `src/editor/viewport3d/panels/LastOperationHost.tsx`
- **What**: Mount `<TextPanel3d />` in `LastOperationHost.tsx` at the bottom-left container alongside `<AdjustLastOperationPanel />` (`ll:flex ll:items-end ll:gap-3`).
- **Why**: Follows the exact placement directive: "Properties ... show in a small panel `TextPanel3d.tsx` next to the Adjust Last Operation panel (follow how `LastOperationHost.tsx` mounts) while a text object is selected".
- **Alternatives rejected**: Mounting only in `ViewportInteraction.tsx` was rejected because `LastOperationHost` is the persistent viewport floating chrome container.

## Step 8: Update `src/editor/viewport3d/ViewportInteraction.tsx`
- **What**: Perform ONE additive mount edit in `ViewportInteraction.tsx`: import `AddMenu3d`, `AddMenuButton`, `PrimitiveHandles`, `TextEditOverlay3d`, mount `AddMenuButton` beside `SnapBar` in the top header strip, and mount `PrimitiveHandles`, `TextEditOverlay3d`, and `AddMenu3d` in the viewport overlay layer.
- **Why**: Satisfies the constraint: "make ONE additive mount edit in `ViewportInteraction.tsx`; other tasks edit `src/editor/panels/*` and the stage: do NOT touch those."
- **Alternatives rejected**: Scattering multiple edits across event handlers was rejected in favor of self-contained component listeners and a single clean mount block.

## Step 9: Update `src/editor/viewport3d/index.ts`
- **What**: Re-export public components and seams from `index.ts`: `AddMenu3d`, `AddMenuButton`, `PrimitiveHandles`, `TextEditOverlay3d`, `TextPanel3d`, and font test seams (`fetchFontBuffer`, `installTestFontSeam`).
- **Why**: Clean, discoverable barrel export for LazyLayout 3D viewport components and external test suites.
- **Alternatives rejected**: Deep imports across private files were rejected to keep API boundary consistent.

## Step 10: Add demos in `src/editor/design-system/demos/Viewport3dDemos.tsx` and update `DOCS/UI/DECISIONS.md`
- **What**: Add `AddMenu3dDemo`, `PrimitiveHandlesDemo`, and `TextPanel3dDemo` to the design system page, showing interactive states (header button trigger, search filter, diamond handle visualization, and text property editing). Append UI design decisions to `DOCS/UI/DECISIONS.md`.
- **Why**: Adheres to `UI_RULES.md` §3 ("Design system first. Every UI component ... is shown, with all its states, on the design system page") and logs non-blocking architectural choices in `DECISIONS.md`.
- **Alternatives rejected**: Skipping design-system demos was rejected as it violates the core UI rule.

## Step 11: Unit Tests for Add Menu, Primitive Handles, and 3D Text
- **What**: Create pure unit tests in `src/editor/viewport3d/__tests__/`:
  - `addMenu.test.ts`: Menu item schema, search resolution, `3d.menu.add` command execution at 3D cursor.
  - `primitiveHandles.test.ts`: Handle definitions, ray-to-axis distance, transaction coalescing on depth handle drag.
  - `textEdit.test.ts`: Font seam decoding, text editing in-place request, property updates, and convert to mesh.
- **Why**: Enforces deterministic verification with `node:test` without DOM or browser dependencies.
- **Alternatives rejected**: Skipping unit tests in favor of only e2e was rejected as both unit tests and e2e are required.

## Step 12: Create E2E test `tests/e2e/add3d.spec.ts`
- **What**: Create Playwright E2E spec in `tests/e2e/add3d.spec.ts` testing the complete user journey:
  1. Initialize with `window.__LL_TEST_FONT__` from `Geist-Regular.ttf`.
  2. Insert 3D scene and enter 3D editing mode.
  3. Press Shift+A and select Cylinder: verify creation at 3D cursor.
  4. Drag height handle: verify `depth` increases live and 1 undo restores it.
  5. Add Text, type "SALE" through the overlay: verify text block string is "SALE" and mesh vertices > 0.
  6. Click "Convert to mesh": verify object type becomes "mesh" and texts link is removed.
- **Why**: Directly validates all requirements of Tasks 3D-025 and 3D-026 end-to-end.
- **Alternatives rejected**: Testing with mock fonts was rejected; real Geist TTF verifies watertight font parsing and mesh triangulation.

## Step 13 & 14: Final Inspection and Handoff
- **What**: Completed comprehensive visual type and syntax checks, verified zero `any` usage, verified zero unused imports, verified JSX only in `.tsx` files, and verified float tolerance checks in tests.
- **Handoff**: Prepared `DOCS/3D/tasks/B3-W3-addtext.handoff.md` detailing all created/modified files, public API additions, architectural decisions, and verification steps.
