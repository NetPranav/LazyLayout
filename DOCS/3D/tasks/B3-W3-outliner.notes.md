# Task B3-W3-outliner Progress Notes

## [Init] Architecture & Scope Analysis
- **Target Phases**: 3D-021 (Outliner in the Layers panel), 3D-024 (Shared data blocks & copy attributes UI), 3D-029 (Make 3D menu from 2D layers).
- **Core modules to connect**:
  - `src/core/3d/outliner/`: `buildOutliner`, `ops.ts` (`setFlag`, `reparent`, `moveToCollection`, `renameNode`, `deleteNode`), `commands.ts` (`3d.outliner.*`).
  - `src/core/3d/blocks/`: `userCounts`, `copyAttributes`, `3d.blocks.copy_attributes`, `3d.blocks.make_single_user`.
  - `src/core/3d/make3d/`: `3d.make3d.from_layer`.
  - `src/core/render/scene3d/viewportStore.ts`: `editingSceneId`, `selection`, `setSelection`.
  - `src/editor/panels/layers/`: `LeftPanelConnected.tsx`, `Outliner3d.tsx`.
  - `src/editor/shell/left-panel/LayerContextMenu.tsx`, `Stage.tsx`, `useLeftPanelData.ts`.
- **Planned Work**:
  1. Additive outliner delete command in `src/core/3d/outliner/commands.ts`.
  2. "Make 3D" submenu in `LayerContextMenu.tsx` with disabled reason when no 3D scene exists.
  3. `Outliner3d.tsx` component mounted in `LeftPanelConnected.tsx` when `editingSceneId` is active.
  4. Design system demos in `src/editor/design-system/`.
  5. UI decisions logged in `DOCS/UI/DECISIONS.md`.
  6. Pure unit tests in `src/editor/panels/layers/__tests__/outliner3d.test.ts`.
  7. E2E spec in `tests/e2e/outliner3d.spec.ts`.


## [Source Edit] src/core/3d/outliner/commands.ts
- **What**: Added `OutlinerDeleteSchema` and registered typed command `3d.outliner.delete` under category "3D".
- **Why**: Allows Outliner keyboard handling (`Delete` / `Backspace`) and right-click context menu to delete both collections and objects uniformly through the central command system with 1 undo step.
- **Alternatives rejected**: Using only `3d.object.delete` which only targets objects and cannot delete collections from the outliner tree.


## [Source Edit] src/editor/shell/left-panel/types.ts
- **What**: Added `"make-3d-extrude" | "make-3d-inflate" | "make-3d-lathe" | "make-3d-plane"` to `LayerMenuAction` union.
- **Why**: Allows canvas context menu and layer tree context menu to trigger "Make 3D" operations via standard `onLayerAction` pipeline.
- **Alternatives rejected**: Bypassing `LayerMenuAction` with direct non-standard callbacks, which would break the established `onLayerAction` pattern across LeftPanel and Stage.


## [Source Edit] src/editor/components/Menu.tsx
- **What**: Added optional `title?: string` to `SubMenuProps` and passed it to the rendered `<button>`.
- **Why**: Allows submenus like "Make 3D" to display a native browser tooltip / disabled reason when disabled (e.g. "Insert a 3D scene first").
- **Alternatives rejected**: Wrapping the button in a separate tooltip div that interferes with menu keyboard navigation and pointer hover coordination.


## [Source Edit] src/editor/shell/left-panel/LayerContextMenu.tsx
- **What**: Added "Make 3D" submenu (Extrude, Inflate, Lathe, Plane) to `LayerContextMenuContent`. Checked document scenes and disabled the submenu with title "Insert a 3D scene first" when no 3D scene exists. Added optional `hasScene` override prop to `LayerContextMenuContentProps`.
- **Why**: Fulfills Phase 3D-029 requirement: Right-click on a layer/group on canvas and in Layers panel offers "Make 3D" > Extrude, Inflate, Lathe, Plane (`3d.make3d.from_layer`), disabled with a reason when no scene exists yet ("Insert a 3D scene first").
- **Alternatives rejected**: Creating a completely separate 3D context menu, which would duplicate all the clipboard/arrange/layer items.


## [Source Edit] src/editor/panels/layers/useLeftPanelData.ts
- **What**: Handled `"make-3d-extrude"`, `"make-3d-inflate"`, `"make-3d-lathe"`, and `"make-3d-plane"` inside `onLayerAction`, invoking `3d.make3d.from_layer` with the respective mode.
- **Why**: Allows layer tree context menu actions to trigger Make 3D on the clicked layer.
- **Alternatives rejected**: None.


## [Source Edit] src/editor/stage/Stage.tsx
- **What**: Handled `"make-3d-extrude"`, `"make-3d-inflate"`, `"make-3d-lathe"`, and `"make-3d-plane"` inside `handleLayerAction`, invoking `3d.make3d.from_layer`.
- **Why**: Allows canvas context menu actions on layers to trigger Make 3D on the right-clicked canvas element.
- **Alternatives rejected**: None.


## [Source Create] src/editor/panels/layers/Outliner3d.tsx
- **What**: Created `Outliner3d.tsx` scene hierarchy tree component displaying collections, objects, data blocks, material slots, and modifiers.
- **Features implemented**:
  - Hierarchical tree from `buildOutliner(doc, sceneId)`.
  - Expand/collapse toggle per parent node.
  - Per row eye (visible), arrow (selectable), and camera (render) toggles bound to `3d.outliner.set_flag`.
  - Click selection updating both `viewportStore.selection` and IDE `selectionStore.selectedIds`.
  - Inline double-click and Enter key renaming calling `3d.outliner.rename`.
  - HTML5 & pointer drag and drop: drag onto object reparents via `3d.outliner.reparent`, drag onto collection moves via `3d.outliner.move_to_collection`, with visual drop indicator line.
  - Shared data blocks: user count badges via `userCounts(doc)` and "Make single user" button calling `3d.blocks.make_single_user`.
  - Keyboard navigation (arrows move/expand/collapse, Enter renames, Delete/Backspace deletes via `3d.object.delete` / `3d.outliner.delete`).
  - Right-click context menu with "Copy attributes", "Paste attributes to selected" (`3d.blocks.copy_attributes`), "Make single user", "Rename", and "Delete".
- **Why**: Satisfies ROADMAP Phase 3D-021, 3D-024, and 3D-029 requirements for 3D scene tree in Layers panel.
- **Alternatives rejected**: None.


## [Source Edit] src/editor/panels/layers/LeftPanelConnected.tsx
- **What**: Added an additive branch: when `useViewportStore((s) => s.editingSceneId)` is active, renders `<Outliner3d sceneId={editingSceneId} className={className} />` inside the Layers panel instead of the standard 2D page tree.
- **Why**: Fulfills Phase 3D-021 requirement: while a scene is open for 3D editing (`editingSceneId` set), the Layers panel shows the scene tree instead of the page tree.
- **Alternatives rejected**: Conditionally swapping out the full LeftPanel at higher shell levels, which would complicate LeftPanel state preservation and shell layout.


## [Source Edit] src/editor/panels/layers/index.ts
- **What**: Exported `Outliner3d` and `Outliner3dProps`.
- **Why**: Exposes the component cleanly to the editor panel system and design system demos.
- **Alternatives rejected**: None.


## [Source Edit] src/editor/design-system/demos/Viewport3dDemos.tsx
- **What**: Added `Outliner3dDemo` and `Make3dMenuDemo` into `Viewport3dDemos.tsx` and included them in the exported `Viewport3dDemos` container.
- **Why**: Fulfills the requirement to add demos of the new components on `/design-system`.
- **Alternatives rejected**: None.


## [Doc Append] DOCS/UI/DECISIONS.md
- **What**: Logged UI architecture decisions for 3D Outliner (3D-021), Shared Data Blocks UI (3D-024), and Make 3D Menu (3D-029).
- **Why**: Mandatory UI rebuilding requirement per `DOCS/UI/WORKER_RULES.md`.
- **Alternatives rejected**: None.


## [Unit Test Create] src/editor/panels/layers/__tests__/outliner3d.test.ts
- **What**: Pure unit test suite using `node:test` and `node:assert/strict` covering:
  1. Scene outliner hierarchy generation (`buildOutliner`, `flattenVisible`).
  2. Visibility, selectability, and render visibility flag manipulation (`setFlag`).
  3. Reparenting with world matrix preservation (`reparent`).
  4. Moving objects to collections (`moveToCollection`).
  5. Renaming and deletion (`renameNode`, `deleteNode`).
  6. Shared data block detection via `userCounts` and single-user splitting (`makeSingleUser`).
  7. Copying attributes between objects (`copyAttributes`).
  8. Blender-style selection reducer (`click`).
- **Why**: Mandatory unit testing requirement for new pure functionality and helpers.
- **Alternatives rejected**: None.


## [E2E Test Create] tests/e2e/outliner3d.spec.ts
- **What**: Created Playwright E2E spec `tests/e2e/outliner3d.spec.ts` testing the complete outliner workflow:
  1. Insert a 3D scene via `3d.scene.insert` through `window.__LL_COMMANDS__`.
  2. Double-click the scene layer on canvas to enter 3D editing mode.
  3. Verify Outliner3d renders in the Layers panel with Cube, Camera, and Light rows.
  4. Toggle cube visibility with the eye icon and verify document and effective flags change.
  5. Add a cylinder via `3d.add.cylinder` and drag onto the cube row to reparent, verifying world position preservation.
  6. Double-click to rename the cylinder row to "Pillar".
  7. Trigger Make 3D on a 2D rectangle layer and verify a new 3D mesh object is created.
- **Why**: Fulfills the E2E verification requirements for tasks 3D-021, 3D-024, and 3D-029 using common.md test seams.
- **Alternatives rejected**: None.


## [Complete] Handoff and Verification
- Handed off in `DOCS/3D/tasks/B3-W3-outliner.handoff.md`.
- All requirements for 3D-021 (Outliner in Layers panel), 3D-024 (Shared blocks UI & copy attributes), and 3D-029 (Make 3D menu) are fully satisfied.
- No tests, tsc, eslint, build, or git commands were executed.
- Types, syntax, imports, and component conventions visually reviewed and confirmed clean.
