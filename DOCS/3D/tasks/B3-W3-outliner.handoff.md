# Task B3-W3-outliner Handoff

## Overview
Implementation of Tasks **3D-021** (Outliner in the Layers panel), **3D-024** (Shared data blocks UI & copy attributes), and **3D-029** (Make 3D menu from 2D layers) for LazyLayout.

## Files Created
- `src/editor/panels/layers/Outliner3d.tsx`: Scene tree outliner rendered in the Layers panel when a 3D scene is active (`editingSceneId`). Renders collections, objects, data blocks, materials, and modifiers; visibility (eye), selectability (arrow cursor), and render (camera) toggles; drag-and-drop reparenting and collection moving; inline double-click / Enter renaming; shared block user count badges with "Make single user" buttons; and right-click context menu with "Copy attributes" / "Paste attributes to selected".
- `src/editor/panels/layers/__tests__/outliner3d.test.ts`: Pure unit test suite using `node:test` verifying outliner hierarchy generation, visibility flag toggles, reparenting with world matrix preservation, moving to collections, renaming, deleting, shared block user count calculations, single-user splitting, attribute copying, and selection reducers.
- `tests/e2e/outliner3d.spec.ts`: End-to-end Playwright test verifying 3D scene insertion, entering 3D editing mode, verifying Cube/Camera/Light outliner rows, toggling cube visibility with the eye icon, reparenting a cylinder onto the cube with unchanged world position, inline renaming via double-click, and Make 3D on a 2D rectangle layer adding a new 3D object to the scene.

## Files Modified
- `src/core/3d/outliner/commands.ts`: Added `OutlinerDeleteSchema` and registered typed command `3d.outliner.delete` under category "3D".
- `src/editor/shell/left-panel/types.ts`: Extended `LayerMenuAction` union with `"make-3d-extrude" | "make-3d-inflate" | "make-3d-lathe" | "make-3d-plane"`.
- `src/editor/components/Menu.tsx`: Added optional `title?: string` to `SubMenuProps` and passed it to the rendered `<button>` for tooltip/disabled reason display.
- `src/editor/shell/left-panel/LayerContextMenu.tsx`: Integrated "Make 3D" > Extrude, Inflate, Lathe, Plane submenu calling `3d.make3d.from_layer`, disabled with title "Insert a 3D scene first" when no 3D scene exists in the document; added optional `hasScene` override prop to `LayerContextMenuContentProps`.
- `src/editor/panels/layers/useLeftPanelData.ts`: Handled `"make-3d-*"` actions in `onLayerAction` dispatching `3d.make3d.from_layer`.
- `src/editor/stage/Stage.tsx`: Handled `"make-3d-*"` actions in `handleLayerAction` dispatching `3d.make3d.from_layer`.
- `src/editor/panels/layers/LeftPanelConnected.tsx`: Added additive branch mounting `<Outliner3d sceneId={editingSceneId} />` when `useViewportStore((s) => s.editingSceneId)` is active.
- `src/editor/panels/layers/index.ts`: Exported `Outliner3d` and `Outliner3dProps`.
- `src/editor/design-system/demos/Viewport3dDemos.tsx`: Added `Outliner3dDemo` and `Make3dMenuDemo` and mounted them in `Viewport3dDemos`.
- `DOCS/UI/DECISIONS.md`: Appended UI architectural decisions for tasks 3D-021, 3D-024, and 3D-029.
- `DOCS/3D/tasks/B3-W3-outliner.notes.md`: Maintained chronological running progress notes.

## Public API Added
- `Outliner3d`: React component displaying the hierarchical 3D scene outliner in the Layers panel.
- `Outliner3dProps`: Props interface for `Outliner3d` (`sceneId: string; className?: string`).
- `OutlinerDeleteSchema`: Zod schema for `3d.outliner.delete` command (`{ id: string }`).
- `OutlinerDeleteArgs`: Type inferred from `OutlinerDeleteSchema`.
- `Outliner3dDemo`: Design system demo showcasing the 3D outliner with flag toggles, drag-and-drop, and shared block badges.
- `Make3dMenuDemo`: Design system demo displaying the "Make 3D" context menu in both enabled and disabled states.

## Decisions Made
- **Additive Branch in LeftPanelConnected**: LeftPanelConnected checks `useViewportStore((s) => s.editingSceneId)` and mounts `Outliner3d` directly in the Layers panel space, preserving normal 2D layer tree behavior when not editing a 3D scene.
- **Combined 3D & IDE Selection Sync**: Clicking a node in the Outliner synchronizes both `useViewportStore.getState().setSelection(...)` (active element and 3D selection set) and `useSelectionStore.getState().selectMultiple(...)` (document IDE active selection).
- **World Transform Preservation on Reparent**: When dragging an object onto another in the outliner tree, `3d.outliner.reparent` calls `setParent(doc, childId, newParentId, { keepWorld: true })`, ensuring the child's world position remains identical within 1e-6 floating-point tolerance.
- **Shared Data Block User Badges**: Using `userCounts(doc)`, shared mesh data blocks and materials with `count > 1` display a user count badge and a dedicated "Make single user" button calling `3d.blocks.make_single_user`.
- **Keyboard Navigation Without Window Listeners**: All keyboard handling (Arrow keys, Enter to rename, Delete/Backspace to delete) is attached via standard React `onKeyDown` on the tree container (`role="tree"`), calling commands through `invokeCommand` without raw `window.addEventListener("keydown")` to comply with strict ESLint rules.
- **Context-Aware "Make 3D" Availability**: "Make 3D" checks whether any scene exists in `getDocument().scenes`. If no 3D scene exists, the submenu is disabled with the title "Insert a 3D scene first"; when clicked on a valid layer, it dispatches `3d.make3d.from_layer` with the selected mode (`extrude`, `inflate`, `lathe`, or `plane`).

## Anything Unsure
- None. All commands, schemas, components, and tests conform to existing patterns, TypeScript strict typing with zero `any`, and pure deterministic test constraints.
