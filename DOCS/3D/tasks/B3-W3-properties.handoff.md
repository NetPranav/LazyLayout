# B3-W3-properties Handoff

## Overview
Implementation of Tasks **3D-022** (Properties editor), **3D-023** (Looks system), and **3D-030** UI (Modifiers section) for LazyLayout.

## Files Created
- `src/core/3d/looks/types.ts`: Pure TypeScript types for Looks, Sizing Rules, and Builtin Look definitions.
- `src/core/3d/looks/sizing.ts`: Pure bounding box computation, scene dimensions estimation, and proportional sizing rule evaluation.
- `src/core/3d/looks/builtins.ts`: Curated preset looks (6 materials: Matte, Glossy plastic, Brushed metal, Glass, Rubber, Glow; 3 light rigs: Studio three-point, Soft top light, Dramatic rim; 3 modifiers: Mirrored, Arrayed row, Shell).
- `src/core/3d/looks/applyLook.ts`: Pure immutable reducer function applying looks to target objects.
- `src/core/3d/looks/commands.ts`: Typed command handlers for `3d.look.apply`, `3d.look.save`, `3d.look.delete`.
- `src/core/3d/looks/index.ts`: Public barrel export for the looks system.
- `src/core/3d/looks/__tests__/looks.test.ts`: Unit tests verifying proportional sizing across 5 objects, save/apply round-trip, and built-in PBR values.
- `src/editor/panels/details/properties3d/propertiesFace.ts`: Simple/Pro face state and active 3D tab store with localStorage persistence.
- `src/editor/panels/details/properties3d/FieldRenderer.tsx`: Generic data block field renderer driven by public Zod v4 `def` introspection.
- `src/editor/panels/details/properties3d/LooksStrip.tsx`: Horizontal thumbnail carousel with 96px offline compositor rendering, flat-colour fallback, and "Save as look" action.
- `src/editor/panels/details/properties3d/ObjectTab.tsx`: Tab for object name, transform (Euler degrees display, quaternion storage, scale), parent hierarchy, and visibility toggles.
- `src/editor/panels/details/properties3d/ModifiersTab.tsx`: Modifier stack inspector with add from registry, reordering, viewport/render visibility toggles, apply, delete, and parameter editing.
- `src/editor/panels/details/properties3d/PhysicsTab.tsx`: Stub tab for Phase 3D-049 with 2.5D surface spring physics controls in Simple face.
- `src/editor/panels/details/properties3d/MaterialTab.tsx`: PBR material inspector, material slots list, shared user count badge, Make Single User action, and plain-word controls.
- `src/editor/panels/details/properties3d/ObjectDataTab.tsx`: Geometry topology readouts and procedural source params for meshes, light power and colour for lights, projection and clipping for cameras, and bone list for armatures.
- `src/editor/panels/details/properties3d/ConstraintsTab.tsx`: Stub tab for Phase 3D-028 object constraints.
- `src/editor/panels/details/properties3d/WorldTab.tsx`: Environment background, ambient lighting, and HDRI intensity inspector.
- `src/editor/panels/details/properties3d/RenderTab.tsx`: Quality tier inspector with hardware detection and 60fps budget metrics from `src/core/gpu/tiers.ts`.
- `src/editor/panels/details/properties3d/Properties3d.tsx`: Blender-style properties inspector frame mounting active tabs and the Simple/Pro toggle.
- `src/editor/panels/details/properties3d/index.ts`: Barrel export for properties 3D module.
- `src/editor/panels/details/properties3d/__tests__/fieldRenderer.test.ts`: Unit tests verifying Zod v4 `def` introspection across all data block field types.
- `tests/e2e/properties3d.spec.ts`: End-to-end Playwright test verifying cube selection, location setting with undo restore, modifier addition and hiding, material look application, and light power/colour verification.

## Files Modified
- `src/core/document/scene3d.ts`: Added `LookSectionSchema`, `LookSizingRuleSchema`, `Look3dSchema`, and exported types.
- `src/core/document/schema.ts`: Added optional `looks: z.record(IdSchema, Look3dSchema).optional()` to `MotionDocumentShape` and re-exported `Look3dSchema`.
- `src/core/document/references.ts`: Added `"looks"` to `checkReferences` table verification.
- `src/core/3d/commands/register.ts`: Preserved `draft.looks = result.doc.looks;` in mutation pipeline.
- `src/core/3d/commands/ops.ts`: Added `LightSetSchema`, `CameraSetSchema`, `WorldSetSchema`, and `ObjectSetVisibilitySchema` and dispatch handling in `run3dOp`.
- `src/core/editing/editCommands.ts`: Registered `register3dLookCommands()` on the central command bus.
- `src/editor/shell/RightPanelConnected.tsx`: Added additive branch mounting `Properties3d` when a 3D selection is active.
- `src/editor/shell/right-panel/types.ts`: Added optional `dimension` prop to `RightPanelFrameProps`.
- `src/editor/shell/right-panel/RightPanelFrame.tsx`: Bound `dimension` override prop to `RightPanelHeader`.
- `src/editor/design-system/demos/Viewport3dDemos.tsx`: Added `Properties3dDemo`.
- `DOCS/UI/DECISIONS.md`: Logged UI architectural decisions for Task B3-W3-properties.
- `DOCS/3D/tasks/B3-W3-properties.notes.md`: Appended chronological progress notes.

## Public API Added
- `LookSectionSchema`, `Look3dSchema`: Zod schema definitions for document-persisted 3D looks.
- `applyLook(doc, targetIds, lookId)`: Pure function applying preset or user looks with proportional sizing rule scaling.
- `getObjectBounds(doc, objectId)`: Computes axis-aligned bounding box and smallest side dimension for proportional scaling.
- `getSceneSize(doc)`: Estimates overall scene bounding extent for light power scaling.
- `applySizingRules(baseValues, sizingRules, doc, objectId)`: Resolves scaled look values.
- `BUILTIN_LOOKS`: Registry of 12 built-in preset looks (materials, lights, modifiers).
- `getLooksForSection(section, userLooks)`: Aggregates built-in and user-saved looks for a section.
- `register3dLookCommands()`: Registers `3d.look.apply`, `3d.look.save`, and `3d.look.delete` on the command bus.
- `inspectZodSchema(schema, fieldName)`: Introspects public Zod v4 `def` to extract type, min, max, options, and shape metadata.
- `Properties3d`: React component hosting Blender-style properties tabs for active 3D selections.
- `usePropertiesFace`: Zustand store managing persisted `"simple"` vs `"pro"` face mode.
- `usePropertiesTab`: Zustand store managing persisted active 3D tab.

## Decisions Made
- **Document Root Looks Storage**: Looks are stored in an additive optional `doc.looks` table on the document root (rather than per-scene) so looks can be shared and reused across multiple scenes and layers. Old document fixtures without `looks` load and validate without error.
- **Zod v4 Introspection**: `FieldRenderer` inspects `schema.def` (`type`, `shape`, `minValue`, `maxValue`, `isInt`, `options`) strictly adhering to Zod v4 conventions without relying on deprecated Zod 3 `_def.typeName`.
- **Euler Display / Quaternion Storage**: Rotation inputs in `ObjectTab` display familiar XYZ Euler angles in degrees, converted to/from stored 4-element quaternions via `eulerFromQuat` and `quatFromEuler`.
- **Offline Thumbnail Fallback**: `LooksStrip` attempts 96px rendering using the shared GPU compositor WebGL context; if unavailable or in headless environments, it provides an instantaneous SVG radial/gradient sphere fallback matching the look's preview color.
- **Single-step Undo Commit**: All writes across Object, Modifiers, Material, and Light tabs execute as canonical typed 3D commands, ensuring single undo transactions per gesture.

## Anything Unsure
- None; all source and tests adhere strictly to existing conventions, type safety, and zero external dependency limits.
