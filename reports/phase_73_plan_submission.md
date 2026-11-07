# Phase 73 Architectural Proposal & Implementation Plan
**Focus:** Parenting & helper layers (`render.role: helper`, AE null layers, kernel transform composition, pick-whip independent of layer tree)
**Roadmap Reference:** Phase 73 (Needs: Phase 72; Was: v3 51.2, 88.1 rendering).
**Target Acceptance Criteria:**
1. Pick-whip parenting independent of the layer tree; kernel composes parent transforms.
2. Helper layers (`render.role: helper`, the After Effects null) draw dashed with identification in Design mode, and are strictly absent from Preview and export.
3. Rotating a helper rotates its parented children; helper does not export.
4. A 3-level parent chain ($C \to B \to A$) evaluated in `evaluate()` exactly matches the stage canvas transform.
5. All automated quality gates pass: unit tests, golden transform matrix verification, Playwright Chromium E2E, TypeScript, ESLint, roadmap order verification.

---

## 1. Architectural Analysis & Core Challenges

### 1.1 Structural Layer Tree vs. Motion / Transform Parenting
- **Current State:** In LazyLayout, `layer.parentId` and `layer.children` define the strict DOM container hierarchy (`Page -> Frame -> Container -> Element`). In Phase 61, the timeline parent dropdown called `layer.move`, modifying `layer.parentId`.
- **The Core Problem:** In After Effects and modern motion graphics, parenting is **transform-based** and decoupled from the visual DOM nesting tree. A layer inside Frame 1 or at root can be parented to an invisible Null/Helper anywhere in the composition without altering DOM clipping, auto-layout flow, or sibling paint indices.
- **Proposed Solution:**
  - Introduce `parentRef?: string | null` (or `transformParentId?: string | null`) on `LayerSchema` (optional field, backwards-compatible, no schema breaking bump).
  - Also support reading/writing `properties["transform.parent"]` if preferred, or keep `layer.parentRef` as the canonical reference.
  - Cycle detection: Fast DAG validation algorithm `canSetParent(layers, layerId, targetParentId): boolean` that prevents self-parenting ($A \to A$) and cyclic dependencies ($A \to B \to C \to A$).
  - Pose Preservation (World Compensation): Provide `setParent(layerId, targetParentId, { preserveWorldTransform?: boolean })`. When parenting, compute local transform offset $T', R', S'$ so the layer maintains stationary world canvas coordinates upon attachment.

### 1.2 Kernel Transform Composition (`evaluate`)
- In `src/core/kernel/evaluate.ts`, `evaluate(doc, compId, layerId, t, inputs)` currently computes local properties and synthesizes a local `transform` string.
- In Phase 73:
  1. Kernel inspects the parent chain: $L_0 \to L_1 \to L_2 \to \dots \to L_k$ (bounded at depth 32).
  2. For each node in the chain, evaluates its local affine transform matrix $\mathbf{M}_i$ at time $t$ using its anchor $A_i$, rotation $\theta_i$, scale $(s_{x,i}, s_{y,i})$, translation $(T_{x,i}, T_{y,i})$, and frame origin $(F_{x,i}, F_{y,i})$:
     $$\mathbf{M}_i = \begin{pmatrix} s_{x,i}\cos\theta_i & -s_{y,i}\sin\theta_i & F_{x,i} + A_{x,i} + T_{x,i} - s_{x,i}\cos\theta_i A_{x,i} + s_{y,i}\sin\theta_i A_{y,i} \\ s_{x,i}\sin\theta_i & s_{y,i}\cos\theta_i & F_{y,i} + A_{y,i} + T_{y,i} - s_{x,i}\sin\theta_i A_{x,i} - s_{y,i}\cos\theta_i A_{y,i} \\ 0 & 0 & 1 \end{pmatrix}$$
  3. Composes the chain in world space:
     $$\mathbf{M}_{\text{world}} = \mathbf{M}_k \times \dots \times \mathbf{M}_1 \times \mathbf{M}_0$$
  4. Emits `transform: matrix(a, b, c, d, e, f)` and exposes decomposed/composed transform attributes in `ResolvedProps`.
  5. The stage (`Artboard.tsx` / `EngineLayer.tsx`) renders the element using the composed parent transform whenever a parent link is present, ensuring $100\%$ parity between stage rendering and `evaluate()`.

### 1.3 Helper Layers (`render.role: "helper"`)
- `properties["render.role"]` already exists in `properties.ts` with values `"content" | "helper"`.
- **Design Mode:**
  - Renders on canvas with a distinctive dashed outline (`border: 1px dashed var(--ll-border-strong)` or accent null color), non-intrusive name badge (`[Helper: Null 1]`), and transparent background.
  - Can be selected, transformed, rotated, scaled, and picked as parent.
- **Preview Mode:**
  - When `mode === "preview"`, helper layers are completely filtered out and stripped from the rendered DOM.
- **Export Emitters:**
  - `ReactComponentEmitter`, `VanillaHtmlEmitter`, and `VueComponentEmitter` exclude all layers with `render.role === "helper"`.
  - Helpers do not produce DOM elements, preventing unwanted layout shifts, styling artifacts, or accessibility violations.

---

## 2. Implementation Plan

1. **Geometry & Transform Engine Extension (`src/core/geometry/parentTransforms.ts`):**
   - 2D affine matrix multiplication and point transformation.
   - Chain evaluation: `composeParentChain(layers, layerId, evaluateLocal)` returns the net world matrix and local-to-world mapping.
   - Cycle detection: `validateParentLink(layers, childId, newParentId)`.
   - Transform compensation for parenting without visual jumping.

2. **Kernel Integration (`src/core/kernel/evaluate.ts`):**
   - Incorporate parent transform composition into `evaluate()`.
   - Provide helper `evaluateComposedTransform(doc, compId, layerId, t, inputs)`.
   - Guarantee deterministic evaluation and zero memory leaks.

3. **Schema & Model Support (`src/core/document/schema.ts` & `src/core/document/properties.ts`):**
   - Add optional `parentRef?: IdSchema.nullable().optional()` to `LayerSchema`.
   - Add `"transform.parent": str(null, null, "none", VISUAL)` to `properties.ts` to allow inspector binding and keyframing/expressions.
   - Export convenient helper command `documentCommands.setTransformParent(layerId, parentRef, preservePose)`.

4. **Helper Layer Rendering & Mode Filtering:**
   - In `Artboard.tsx`: Render helper layers with dashed border and name pill in design mode.
   - In `RenderLayer.tsx` / `selectRenderable`: Filter out helper layers when rendering preview or export.
   - In `src/compiler/emitters/`: Exclude helper layers in React, Vue, and Vanilla HTML emitters.

5. **Timeline & Inspector Pick-Whip UI:**
   - Update `ParentSelect` in `TimelinePanel.tsx` to set `parentRef` (transform parenting) instead of `layer.move` (DOM reparenting).
   - Display helper layers clearly with a null icon / tag in dropdown choices.
   - Add parenting selector in Inspector `PositionSection.tsx` / `TransformSection`.

6. **Comprehensive Test Suite:**
   - Unit tests: Golden matrix calculations for 3-level parent chain ($C \to B \to A$) with rotation, scale, and translation.
   - Cycle detection tests (prevent circular and self-parenting).
   - Stage vs `evaluate()` parity tests.
   - Helper layer DOM presence tests (present in Design, absent in Preview DOM, absent in exported React/HTML).
   - Playwright Chromium E2E test verifying pick-whip parenting, rotating helper rotating child, and Preview mode exclusion.
