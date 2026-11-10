# Phase 73 — Parenting & Helper Layers: Final Review Submission & Architectural Verification
**Branch:** `b/phase-73-parenting-helpers`
**Target Phase:** Phase 73 · Parenting & helper layers (Needs: 72; Was: v3 51.2, 88.1 rendering).
**Status:** Both outstanding review conditions from ChatGPT fully resolved and verified with automated test evidence.

---

## 1. Resolution of ChatGPT Review Conditions

### Condition 1: Single Source of Truth for Transform Parenting
- **Authoritative Persisted Representation:**
  - `layer.parentRef` (`IdSchema.nullable().optional()`) is established as the sole authoritative representation across the entire system.
  - `createLayer` (`src/core/document/factories.ts`) explicitly initializes `parentRef: input.parentRef ?? null`.
- **Derived Read-Only Compatibility Projection:**
  - `properties["transform.parent"]` (`src/core/document/properties.ts`) is documented and maintained strictly as a synchronized projection for property registry inspection compatibility.
  - `documentCommands.setTransformParent` sets `targetLayer.parentRef = targetParent`, and updates `targetLayer.properties["transform.parent"]` to match (or deletes it if unparented).
  - `documentCommands.updateProps` intercepts any caller setting `"transform.parent"` and immediately synchronizes `layer.parentRef`, guaranteeing they can never diverge.
- **Canonical Accessor:**
  - `getLayerParentRef(layer)` (`src/core/geometry/parentTransforms.ts`) is the single canonical accessor used across:
    - Kernel: `src/core/kernel/evaluate.ts`
    - Canvas Stage: `src/editor/stage/Artboard.tsx`
    - Timeline: `src/legacy-editor/panels/timeline/TimelinePanel.tsx`, `src/core/timeline/timelineOps.ts`
    - Document Store & Migrations: `src/core/store/useDocumentStore.ts`, `src/core/document/migrations/index.ts`
  - In `getLayerParentRef`, `layer.parentRef` is checked first. Any stale value in `layer.properties["transform.parent"]` is ignored whenever `layer.parentRef` is set (including `null`).
- **Automated Verification:**
  - Verified in `parentTransforms.test.ts` ("Condition 1"):
    - Confirmed `parentRef: "authoritative_parent"` overrides stale `properties["transform.parent"]: "stale"`.
    - Confirmed `parentRef: null` (detached) overrides stale `properties["transform.parent"]`.
    - Confirmed store commands and `updateProps` keep `parentRef` and `properties["transform.parent"]` in sync.

---

### Condition 2: Parent Deletion World Transform Preservation
- **Implementation in `removeLayerDependents` and `removeLayer`:**
  - In `src/core/store/useDocumentStore.ts`:
    `removeLayerDependents(draft as MotionDocument, doomed)` is invoked **before** `doomed.forEach((id) => delete draft.layers[id])`.
    This guarantees that the deleted parent layer is still accessible in `doc.layers` while child transforms are evaluated.
  - In `src/core/document/migrations/index.ts`:
    For every surviving layer child whose `parentRef` belongs to `layerIds`:
    1. Evaluates its current world transform matrix: $W_{\text{child}} = M_{\text{parent}} \cdot M_{\text{child}}$.
    2. Computes the compensated local transform via `computeReparentedLocalTransform(child, null, doc.layers)`.
    3. Re-assigns the decomposed transform properties (`transform.x`, `transform.y`, `transform.rotate`, `transform.scale: 1`, `transform.scaleX`, `transform.scaleY`) to the child layer before clearing `parentRef = null`.
- **Mathematical Accuracy:**
  - `computeReparentedLocalTransform` includes `"transform.scale": 1` to prevent double-scaling with decomposed `scaleX`/`scaleY`.
  - World corners of detached children match pre-deletion corners with $< 0.005$px variance ($0$ visual jump).
- **Undo/Redo Verification:**
  - Immer patch recording ensures:
    - `historyCommands.undo()` cleanly restores the helper layer, re-parents both children (`parentRef = helperId`), and restores their original local properties, with world corners matching $< 0.005$px.
    - `historyCommands.redo()` cleanly re-deletes the helper layer, detaches both children, and re-applies compensated local properties, with world corners matching $< 0.005$px.
- **Automated Verification:**
  - Verified in `parentTransforms.test.ts` ("Condition 2"):
    - Helper created with translation ($[100, 50]$), rotation ($30^\circ$), and nonuniform scale ($[1.5, 0.8]$).
    - Attached two children ($C_1$ with scale 1.2, $C_2$ with scale 0.8).
    - Recorded all 4 world corners before deletion.
    - Deleted helper via `documentCommands.removeLayer`.
    - Confirmed all 4 world corners after deletion match within $< 0.005$px.
    - Confirmed Undo restores helper, reparents children, and corners match $< 0.005$px.
    - Confirmed Redo re-deletes helper, detaches children, and corners match $< 0.005$px.

---

## 2. Automated Test Execution Evidence

| Test Suite | Tests Run | Result | Evidence & Coverage |
|---|---|---|---|
| `parentTransforms.test.ts` | 10 | **PASS** | 2D affine engine, 3-level analytical golden matrix ($< 10^{-5}$ diff), column-vector order ($M_A M_B \neq M_B M_A$), DAG cycle rejection, singular matrix handling, Condition 1 (single source of truth), Condition 2 (multi-child helper deletion transform preservation + undo/redo). |
| `parentEvaluation.test.ts` | 3 | **PASS** | 3-level parent chain `evaluate()` parity with stage world matrix, rotating parent helper rotates child, animated parent keyframe cascade at $t=0, 0.5, 1.0$. |
| `HelperLayerExclusion.test.ts` | 4 | **PASS** | Exclusion of `render.role: helper` from `ReactComponentEmitter`, `VanillaHtmlEmitter`, `VueComponentEmitter`, and `selectRenderable(previewOrExport=true)`. |
| `HelperAndParenting.test.tsx` | 1 | **PASS** | Stage canvas `designTransform` composed matrix calculation and CSS formatting. |
| `parenting.spec.ts` (Playwright Chromium) | 2 | **PASS** | Helper layer draws dashed with `NULL: <name>` badge in Design mode; helper is strictly absent from Preview DOM; rotating parent rotates child on stage. Passed in 31.9s. |
| **Store & Model Tests** (`documentStore.test.ts`, `motion-model.test.ts`) | 27 | **PASS** | Document commands, layer lifecycle, tree repairs, Immer patch inversions, fine-grained subscriptions. |
| **Phase 71 & 72 Regressions** (`pins.test.ts`, `anchorTransforms.test.ts`, `AnchorOverlay.test.tsx`, `OnionSkin.test.tsx`) | 20 | **PASS** | Preset pins, custom pins, anchor point transformation invariance, onion skinning continue passing with zero regressions. |

**Sum of Suites:** 10 + 3 + 4 + 1 + 2 + 27 + 20 = **67 tests** (100% PASSED).

---

## 3. Quality Gates
- **TypeScript (`npm run typecheck`):** 0 errors.
- **ESLint (`npm run lint`):** 0 errors, 79 warnings (budget max 463).
- **Roadmap Ordering (`npm run check:roadmap-order`):** PASS (277 phases validated).
- **Knowledge Graph (`graphify update .`):** Graph fully updated (11,355 nodes, 35,575 edges, 426 communities).

---

## 4. Formal Closure Request
Both outstanding conditions are now definitively resolved and proven with passing automated tests. We request partner ChatGPT's formal confirmation to close Phase 73 unconditionally so that we can push the branch and open the PR.
