# B3-W3-properties Notes

## Task Initialized
Starting work on Properties Editor (3D-022), Looks (3D-023), and Modifiers section (3D-030).
Examining existing files and requirements before writing code.

## Step 1: Document Schema Updates
About to edit `src/core/document/scene3d.ts`, `src/core/document/schema.ts`, and `src/core/document/references.ts`.
- Add `Look3dSchema`, `LookSectionSchema`, `LookSizingRuleSchema` to `src/core/document/scene3d.ts`.
- Add optional `looks: z.record(IdSchema, Look3dSchema).optional()` to `MotionDocumentShape` in `src/core/document/schema.ts`.
- Add validation in `src/core/document/references.ts` via `if (doc.looks) keyed("looks")`.
- Why: Needed for Phase 3D-023 user-saved looks stored in the document root, maintaining additive compatibility for all existing v6/v7 documents.
- Alternatives rejected: Storing looks inside individual scene data blocks was rejected because looks are reusable across scenes and documents.

## Step 2: Pure Looks System (src/core/3d/looks/)
About to create `src/core/3d/looks/types.ts`, `builtins.ts`, `sizing.ts`, `applyLook.ts`, `commands.ts`, and `index.ts`.
- `types.ts`: Define `Look3d`, `LookSection`, `LookSizingRule`, `LookDefinition`.
- `builtins.ts`: Define built-in looks:
  - Material looks: "matte", "glossy plastic", "brushed metal", "glass", "rubber", "glow".
  - Light rig looks: "studio three-point", "soft top light", "dramatic rim".
  - Modifier looks: "mirrored", "arrayed row", "shell".
- `sizing.ts`: Pure geometric bounds calculation (smallest side, scene size) and rule scaling function.
- `applyLook.ts`: Pure immutable `applyLook(doc, targetIds, lookId)`.
- `commands.ts`: Typed commands `3d.look.apply`, `3d.look.save`, `3d.look.delete`.
- `index.ts`: Barrel export.
- Why: Satisfies ROADMAP Phase 3D-023 pure core requirements without DOM or React.
- Alternatives rejected: Hardcoding look values directly into UI components was rejected because looks must be pure data structures that round-trip through document persistence and undo history.

## Step 3: Command Operations (src/core/3d/commands/ops.ts)
About to edit `src/core/3d/commands/ops.ts`.
- Add `LightSetSchema`, `CameraSetSchema`, `WorldSetSchema`, and `ObjectSetVisibilitySchema`.
- Register them under canonical command ids `3d.light.set`, `3d.camera.set`, `3d.world.set`, `3d.object.set_visibility`.
- Implement immutable dispatch in `run3dOp`.
- Why: Enables typed command execution with undo support from the Properties Editor tabs (Object, Object Data, World).
- Alternatives rejected: Direct in-place mutation inside React components was rejected because all edits must produce single atomic undo steps through the command bus.

## Step 4: Properties Editor 3D UI (src/editor/panels/details/properties3d/)
About to create:
- `propertiesFace.ts`: Face state management (Simple vs Pro) with localStorage persistence.
- `FieldRenderer.tsx`: Generic data block field renderer driven by Zod v4 `def`.
- `LooksStrip.tsx`: Looks carousel/strip with 96px thumbnail generation, GL fallback, and "Save as look".
- `ObjectTab.tsx`: Object transform (Euler display, quaternion storage), hierarchy parenting, and visibility.
- `ModifiersTab.tsx`: Modifiers stack management (add from registry, reorder, hide/render toggles, apply, delete, params).
- `PhysicsTab.tsx`: Physics stub tab with 2.5D surface physics controls as Simple face.
- `MaterialTab.tsx`: Material PBR inspector, slots, user counts, and Make Single User.
- `ObjectDataTab.tsx`: Mesh procedural params, Light properties, Camera properties, Armature bone tree.
- `ConstraintsTab.tsx`: Constraints stub tab.
- `WorldTab.tsx`: Environment, ambient, and background color settings.
- `RenderTab.tsx`: GPU tier and budget inspector from `src/core/gpu/tiers.ts`.
- `Properties3d.tsx`: Shell with Blender-style tab bar and Simple/Pro face switch.
- `index.ts`: Public barrel export.
- Why: Implements the full Blender-style Properties editor specified in Phase 3D-022, 3D-023, and 3D-030.
- Alternatives rejected: Using standard 2D property inspector rows was rejected because 3D objects operate on shared data-blocks with Euler/Quat conversions, modifier stacks, and looks.

## Step 5: Mount Properties3d in RightPanelConnected.tsx
About to edit `src/editor/shell/RightPanelConnected.tsx`.
- Connect `useViewportStore` to read `active3dId`, `selected3dIds`, and `editingSceneId`.
- Add additive branch: When `(dimension === "3d" || editingSceneId || !inspector.hasSelection) && active3dId`, render `<Properties3d activeId={active3dId} />` inside `RightPanelFrame`.
- Pass `selectionName={selected3dObj?.name ?? "3D Object"}` to `RightPanelFrame`.
- Why: Satisfies requirement 1 ("With a 3D selection, the right panel's 3D side becomes Blender's Properties editor... mount it from RightPanelConnected.tsx in ONE additive branch").
- Alternatives rejected: Replacing `RightPanelFrame` entirely was rejected because the existing shell frame provides header chrome, tabs, and AI panel switching.

## Step 6: Design System Demos & UI Decisions
About to edit `src/editor/design-system/demos/Viewport3dDemos.tsx` and append to `DOCS/UI/DECISIONS.md`.
- Add `Properties3dDemo` demonstrating Object, Modifiers, Material, LooksStrip, and Simple/Pro face switching.
- Document UI architectural decisions in `DOCS/UI/DECISIONS.md`.
- Why: Satisfies requirement 5 ("Demos on /design-system, decisions appended to DOCS/UI/DECISIONS.md").
- Alternatives rejected: Creating an isolated demo page was rejected because the design system aggregates all 3D viewport and inspector components in `Viewport3dDemos`.

## Step 7: Comprehensive Unit & E2E Tests
About to write:
- `src/core/3d/looks/__tests__/looks.test.ts`:
  - Tests applying look to 5 objects of different sizes gives proportional results with strict float tolerance assertions.
  - Tests user look save then apply round-tripping.
  - Tests built-in looks library properties (materials, lights, modifiers).
- `src/editor/panels/details/properties3d/__tests__/fieldRenderer.test.ts`:
  - Tests that `inspectZodSchema` parses public Zod v4 `def` and picks appropriate control types (number, string, color, boolean, enum, vector3, quaternion, object, array).
- `tests/e2e/properties3d.spec.ts`:
  - Full Playwright E2E spec verifying selection of default cube, Object tab location change + single-step undo restore, Modifiers tab adding and toggling Mirror modifier, Material tab applying "Glossy plastic" look and updating roughness, and Light selection verifying power and colour.
- Why: Satisfies all test specifications across pure core unit tests and browser-level e2e journeys.
- Alternatives rejected: Skipping tolerance helpers in float assertions was rejected per Lessons ("compare floats with a tolerance helper, never assert.deepEqual on numbers").

## Step 8: Fix 1 - Resolve 56 tsc Type Errors
About to record fixes for the 56 type errors identified in `props-errors.txt`:
- Defined `LookSection` and `LookSizingRule` directly in `src/core/3d/looks/types.ts` rather than importing from schema.
- Added missing `emissive: "#000000"` to `Material3d` literal and guarded `mat` against undefined in `applyLook.ts`.
- Replaced direct `getCommand(id)?.run(args)` with `tryRunCommand(id, args)` from `@/core/commands` across all tabs and components.
- Updated `ColorSwatchField` usage to use `hex`, `onChangeHex={(hex: string) => ...}`, and `withPicker` everywhere.
- Updated `ModifierDefinition` property access to `def.label` and `quatFromEuler` to pass individual Euler angles.
- Why: Eliminates all 56 `tsc --noEmit` compiler errors, satisfies strict typing and eliminates implicit `any`s.
- Alternatives rejected: Casting command arguments or field props to `any` was rejected per rules forbidding `any`.

