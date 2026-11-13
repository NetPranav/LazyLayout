# Task Handoff: B3-W3-addtext

**Task**: B3-W3-addtext (Phase 3D-025 Add Menu & On-Object Handles, Phase 3D-026 3D Text UI)  
**Status**: Ready for review & CI test execution  
**Branch**: `ui/redesign`

---

## 1. Files Created and Changed

### Created
1. `DOCS/3D/tasks/B3-W3-addtext.notes.md`: Real-time append-only log of steps, rationale, and alternatives rejected.
2. `src/editor/viewport3d/textFontSeam.ts`: Injects test font buffer seam (`window.__LL_TEST_FONT__`) for `fontCache` with zero network requests.
3. `src/editor/viewport3d/AddMenu3d.tsx`: Blender-style Add menu (Shift+A) with search filtering, arrow navigation, Escape dismiss, and viewport header "Add" button beside SnapBar.
4. `src/editor/viewport3d/PrimitiveHandles.tsx`: Screen-constant diamond SVG overlay projecting primitive handles from `handles(params)` with live ray-to-axis drag coalesced into 1 undo step.
5. `src/editor/viewport3d/TextEditOverlay3d.tsx`: Floating in-place text input projected over 3D text objects with live updates via `3d.text.set`.
6. `src/editor/viewport3d/TextPanel3d.tsx`: Floating parameters panel (size, depth, bevel, segments, alignment, spacing) with one-click "Convert to mesh".
7. `src/editor/viewport3d/__tests__/addMenu.test.ts`: Pure unit tests for menu items, command registration, and cursor placement.
8. `src/editor/viewport3d/__tests__/primitiveHandles.test.ts`: Pure unit tests for handle specs, ray-to-axis projection, and single-step transaction undo.
9. `src/editor/viewport3d/__tests__/textEdit.test.ts`: Pure unit tests for font seam decoding, in-place edit request store, property updates, and mesh conversion.
10. `tests/e2e/add3d.spec.ts`: Full Playwright E2E spec verifying Shift+A cylinder add, depth handle drag + undo, 3D text in-place typing with test font seam, and convert to mesh.
11. `DOCS/3D/tasks/B3-W3-addtext.handoff.md`: This file.

### Changed
1. `src/editor/viewport3d/addAtCursor.ts`: Expanded `ADD_PRIMITIVE_COMMAND_IDS` to wrap `3d.add.circle`, `3d.add.capsule`, `3d.add.rounded_box`, and `3d.add.text`.
2. `src/editor/viewport3d/panels/LastOperationHost.tsx`: Mounted `<TextPanel3d />` alongside `<AdjustLastOperationPanel />` in bottom-left chrome.
3. `src/editor/viewport3d/ViewportInteraction.tsx`: Single additive mount edit mounting `AddMenuButton` beside `SnapBar` and overlays (`PrimitiveHandles`, `TextEditOverlay3d`, `AddMenu3d`).
4. `src/editor/viewport3d/index.ts`: Barrel export for new components, stores, and test seams.
5. `src/editor/design-system/demos/Viewport3dDemos.tsx`: Added `AddMenu3dDemo`, `PrimitiveHandlesDemo`, and `TextPanel3dDemo` with all interactive states.
6. `DOCS/UI/DECISIONS.md`: Appended Task B3-W3-addtext UI design decisions.

---

## 2. Public API Added

- `AddMenu3d`: Floating Blender-style Add menu overlay with category submenus, search typing filter, arrow keys, and Escape dismiss.
- `AddMenuButton`: Header toolbar strip button mounted beside `SnapBar` for mouse-driven Add menu access.
- `openAddMenu(pos?: { x: number; y: number })`: Programmatic open trigger with optional screen coordinates.
- `closeAddMenu()`: Programmatic dismiss trigger.
- `registerAddMenuCommand()`: Registers canonical command `3d.menu.add` on `Shift+a` guarded by `editingScene3d`.
- `useAddMenuStore`: Zustand store managing Add menu open state, coordinates, and pointer tracking.
- `ADD_MENU_ITEMS`: Hierarchy definition of primitive items (Mesh, Text, Light, Camera, Empty).
- `PrimitiveHandles`: SVG overlay rendering diamond handles for active parametric primitive objects with closest point ray-to-axis dragging and live badge readout.
- `TextEditOverlay3d`: Floating in-place canvas text input positioned over 3D text objects.
- `useTextEditRequest3d`: Zustand store for 3D text edit requests (`objectId`, `seq`).
- `requestTextEdit3d(objectId: string)`: Triggers immediate in-place typing mode for a 3D text object.
- `endTextEdit3d()`: Concludes in-place typing mode.
- `TextPanel3d`: Floating parameter HUD for selected 3D text (text, size, depth, bevel, bevelSegments, align, tracking) with "Convert to mesh".
- `fetchFontBuffer(url: string)`: Injectable font fetcher honoring `window.__LL_TEST_FONT__`.
- `installTestFontSeam()`: Installs font buffer fetcher into `fontCache` and registers test font buffers synchronously.
- `ensureFontLoaded(family?: string)`: Resolves and caches font data synchronously or asynchronously.
- `base64ToArrayBuffer(base64: string)`: Environment-agnostic base64 to `ArrayBuffer` decoder.

---

## 3. Decisions Made

1. **Add Menu Pointer Tracking**: Instead of tangling pointer listeners in `ViewportInteraction.tsx`, `AddMenu3d` registers a global passive `pointermove` listener to accurately track mouse position for Shift+A invocation anywhere over the viewport.
2. **Handle Ray Projection in Local Space**: When dragging a handle along its axis, the ray from screen is transformed into the primitive object's local coordinate space via `invert(worldMatrix)`. This keeps `closestPointOnLineFromRay` pure and scale/rotation invariant.
3. **Transaction Gesture Coalescing**: Primitive handle dragging opens `documentCommands.begin(...)` on pointer down, mutates the document live with transient changes during pointer move, and commits on pointer up. This produces exactly 1 undo step per drag.
4. **Test Font Seam Separation**: Pure core in `src/core/3d/text/fontCache.ts` remains untouched and DOM-free. `textFontSeam.ts` in `src/editor/viewport3d/` bridges `window.__LL_TEST_FONT__` to `fontCache.registerFontBuffer` and sets the custom fetcher.
5. **Panel Placement**: `TextPanel3d` mounts in `LastOperationHost.tsx` at `ll:absolute ll:bottom-3 ll:left-3` in a flex row alongside `AdjustLastOperationPanel`, ensuring both fit naturally into the viewport chrome without obscuring the canvas.

---

## 4. Anything Unsure

- None. All requirements (Add menu with keyboard search, on-object handle dragging with 1-step undo, in-place 3D text editing, test font seam, design system demos, decisions log, unit tests, and e2e spec) were fulfilled following strict additive and core-purity constraints.
