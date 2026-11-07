# Phase 72: Anchor Points & Pins — Final Implementation Review & Verification Evidence

**Phase:** 72 · Anchor points & pins  
**Branch:** `b/phase-72-anchor-points-pins`  
**Parent / Dependency Branch:** `b/phase-71-onion-skin`  
**Target Repository:** `NetPranav/LazyLayout`  

---

## 1. Specification & Acceptance Gate Summary

- **Roadmap Specification:**
  - *"One pin model: 9 preset pins plus custom pins (which may lie outside the box). The anchor is the pin used for rotation and scale; it can be moved on the canvas."*
  - *"You'll see: drag a layer's anchor point; rotation follows it."*
- **Acceptance Gate:**
  - **"Done when: rotation and scale about every preset pin match golden values."**

---

## 2. Review of Implementation Against Partner Conditions & Requirements

### Condition A & B — Canonical Mathematical Model & Transform Order
In `src/core/geometry/transforms.ts`:
- Forward transformation:
  $$P_{\text{world}} = F + A + R(\theta) \cdot S(s_x, s_y) \cdot (P - A) + T$$
  evaluated strictly in canonical graphics order: Scale first, then Rotation, then Translation ($R \cdot S$).
- **Matrix Order Verification (Requirement 3):**
  Verified analytically and experimentally that for nonuniform scale ($s_x \neq s_y$):
  $$R(\theta) \cdot S(s_x, s_y) \cdot v \neq S(s_x, s_y) \cdot R(\theta) \cdot v$$
  For $v = (10, 20), \theta = 90^\circ, s_x = 2, s_y = 0.5$:
  $R \cdot S = (-10, 20)$, whereas $S \cdot R = (-40, 5)$.
  Confirmed that `transformPoint` strictly implements $R \cdot S$.
- **Zero-scale Behavior:**
  Multiplication only; no division by scale is performed anywhere in the transform pipeline.
- **Numerical Stability:**
  Verified with $s_x = s_y = 10^{-6}$, yielding exact analytical convergence without precision degradation.

### Condition C — Anchor Point Invariance (Requirement 2)
For every preset pin and custom pin:
When $P = A$, $(P - A) = (0, 0) \implies P_{\text{world}} = F + A + T$.
Verified across all 9 preset pins under arbitrary rotations and scaling factors that the anchor point remains invariant in canvas world space.

### Condition D — Single Canonical Anchor Representation
- `layer.pins`: Stores named custom pin definitions conforming to MDM Schema v4 (`PinsSchema`).
- `transform.origin`: Single source of truth for the active anchor. Supports preset pin names (`"topLeft"`, `"center"`, etc.), legacy aliases (`"top left"`, `"bottom right"`), custom pin names, and pixel/percentage coordinate strings.
- `resolveLayerAnchor(layer, width, height)`: Abstraction shared across geometry, overlays, and renderer.

### Condition E — Unit Handling & Out-of-Bounds Pins
- Custom pins support both `px` ($P_x = x, P_y = y$) and `%` ($P_x = \frac{x}{100}W, P_y = \frac{y}{100}H$).
- Unbounded coordinates are preserved without clamping to the layer's bounding box (e.g. `{ x: -30, y: -20, unit: "px" }` and `{ x: 120, y: 150, unit: "%" }`).

### Condition F — Visual Geometry Preservation on Anchor Move
Implemented in `compensateTransformForAnchorChange(oldAnchor, newAnchor, rot, sx, sy, currentOffset)`:
$$T' = T + (I - M) \cdot (A - A')$$
where $M = R(\theta) \cdot S(s_x, s_y)$.
When an anchor is moved on an already rotated/scaled layer, $T$ is automatically updated such that all 4 transformed bounding corners of the layer remain stationary in world space (0 visual jump).

### Interactive Anchor Overlay (`src/editor/stage/AnchorOverlay.tsx`)
- Renders interactive bullseye crosshair $\bigoplus$ (`data-testid="anchor-point-handle"`) at the layer's resolved anchor.
- Shows all 9 preset target pins during drag and snaps when within 8px.
- Commits atomic undoable transaction via `setLayerProps`.
- Full undo/redo verified with `historyCommands.undo()` and `historyCommands.redo()`.

---

## 3. Verification Evidence

### A. Golden Value Matrix Verification (`src/core/geometry/__tests__/anchorTransforms.test.ts`)
*All golden values independently derived analytically as constant matrices; 9 preset pins × 4 corners tested against floating-point tolerance $< 10^{-5}$.*

1. **Golden 90° Clockwise Rotation:**
   - `topLeft`: `[[0, 0], [0, 100], [-60, 100], [-60, 0]]`
   - `top`: `[[50, -50], [50, 50], [-10, 50], [-10, -50]]`
   - `topRight`: `[[100, -100], [100, 0], [40, 0], [40, -100]]`
   - `left`: `[[30, 30], [30, 130], [-30, 130], [-30, 30]]`
   - `center`: `[[80, -20], [80, 80], [20, 80], [20, -20]]`
   - `right`: `[[130, -70], [130, 30], [70, 30], [70, -70]]`
   - `bottomLeft`: `[[60, 60], [60, 160], [0, 160], [0, 60]]`
   - `bottom`: `[[110, 10], [110, 110], [50, 110], [50, 10]]`
   - `bottomRight`: `[[160, -40], [160, 60], [100, 60], [100, -40]]`
   *Result:* **PASS** (all 9 presets match golden values).

2. **Golden Nonuniform Scale ($s_x = 2, s_y = 0.5$):**
   - Verified for all 9 preset pins against independent golden matrices.
   *Result:* **PASS**.

3. **Golden Combined Rotation & Scale ($\theta = 45^\circ, s_x = 1.5, s_y = 0.8$):**
   - Verified for all 9 preset pins against independent golden matrices.
   *Result:* **PASS**.

4. **Anchor Invariance ($A_{\text{world}} = F + A + T$):**
   - Verified for all 9 preset pins across rotations [0°, 90°, 45°, -135°, 270°] and nonuniform scales.
   *Result:* **PASS**.

5. **Visual Geometry Preservation ($B' = B + (I - M)(A - A')$):**
   - Verified all 4 corners maintain identical world positions after moving anchor on rotated/scaled layer.
   *Result:* **PASS**.

### B. Unit & Component Test Suite
```bash
$ npx tsx --test src/core/geometry/__tests__/pins.test.ts src/core/geometry/__tests__/anchorTransforms.test.ts src/editor/stage/__tests__/AnchorOverlay.test.tsx

▶ Phase 72: Golden Value Matrix & Transformation Verification
  ✔ matches golden values for 90° rotation across all 9 preset pins
  ✔ matches golden values for nonuniform scale (2, 0.5) across all 9 preset pins
  ✔ matches golden values for combined rotation & scale (45°, 1.5, 0.8) across all 9 preset pins
  ✔ verifies anchor point invariance for all 9 preset pins under arbitrary transforms
  ✔ verifies R · S ≠ S · R for nonuniform scale (matrix order distinction)
  ✔ handles zero-scale safely without division by zero or NaN
  ✔ remains numerically stable with very small positive scale (1e-6)
  ✔ supports out-of-bounds custom pins correctly as pivots
  ✔ preserves rendered visual geometry when changing anchor on an already rotated/scaled layer
✔ Phase 72: Golden Value Matrix & Transformation Verification

▶ Phase 72: Pins Resolution Engine
  ✔ resolves all 9 preset pins on a 100x60 box to exact local coordinates
  ✔ resolves legacy and whitespace aliases correctly
  ✔ resolves custom pins in pixels and percentages
  ✔ preserves out-of-bounds coordinates without clamping (Condition E)
  ✔ resolves layer anchor from transform.origin or custom named pins
  ✔ formats CSS transform-origin as pixel string
  ✔ finds nearest preset pin within snapping threshold
✔ Phase 72: Pins Resolution Engine

▶ Phase 72: AnchorOverlay UI & Stage Integration
  ✔ renders the interactive anchor point handle for the selected layer
  ✔ positions anchor handle at preset pin location (topRight)
  ✔ handles custom pins and out-of-bounds coordinates
  ✔ supports transactional undo and redo of anchor movements
✔ Phase 72: AnchorOverlay UI & Stage Integration

ℹ tests 20, pass 20, fail 0 (515ms)
```

### C. Browser-Level Playwright E2E Suite (`tests/e2e/anchor-points.spec.ts`)
```bash
$ npx playwright test tests/e2e/anchor-points.spec.ts --project=chromium

Running 2 tests using 2 workers
  ✓ inspector Origin control updates anchor position on canvas (1.5s)
  ✓ renders anchor handle for selected layer and updates when dragged with snapping (1.6s)

2 passed (11.1s)
```

### D. Quality Gates
- **TypeScript:** `npm run typecheck` $\to$ **0 errors**.
- **ESLint:** `npm run lint` $\to$ **0 errors, 76 warnings** (well within max 463).
- **Roadmap Verification:** `npm run check:roadmap-order` $\to$ **PASS: 277 phases**.
- **Graphify Knowledge Graph:** `graphify update .` $\to$ **Rebuilt 11296 nodes, 35369 edges, 416 communities**.

---

## 4. Request for Formal Phase 72 Closure Approval

All requirements from your Phase 72 implementation authorization have been implemented, tested, and verified:
1. Canonical $R \cdot S$ coordinate and matrix order verified.
2. Invariance of anchor point $A_{\text{world}} = F + A + T$ verified across all 9 preset pins.
3. Independently derived golden value matrices passed with zero discrepancy.
4. Out-of-bounds custom pins supported in px and %.
5. Visual geometry preservation $(I - M)(A - A')$ implemented and tested.
6. Stage bullseye handle, snapping to 9 presets, and inspector synchronization verified in Chromium.

Please let me know if Phase 72 is approved for formal closure and PR creation.
