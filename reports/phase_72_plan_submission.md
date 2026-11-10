# Phase 72: Anchor Points & Pins — Architectural Proposal & Implementation Plan

**Phase:** 72 · Anchor points & pins  
**Needs:** 71 (Onion skin)  
**Parent / Dependency Branch:** `b/phase-71-onion-skin`  
**Target Branch:** `b/phase-72-anchor-points-pins`  
**Target Repository:** `NetPranav/LazyLayout`  

---

## 1. Specification & Acceptance Gate

- **Roadmap Specification:**
  - *"One pin model: 9 preset pins plus custom pins (which may lie outside the box). The anchor is the pin used for rotation and scale; it can be moved on the canvas."*
  - *"You'll see: drag a layer's anchor point; rotation follows it."*
- **Acceptance Gate:**
  - **"Done when: rotation and scale about every preset pin match golden values."**

---

## 2. Mathematical Foundation & Architectural Analysis

### A. Mathematical Formulation (Interactive Effects Engine Spec §8.6.2)
For a layer with frame origin $F = (frame.x, frame.y)$, anchor point $A = (A_x, A_y)$ in layer-local coordinates, rotation $R(\theta)$, scale $S(s_x, s_y)$, and transform offset $T = (transform.x, transform.y)$:

The world canvas coordinate of any layer point or pin $P = (P_x, P_y)$ is given by:
$$P_{\text{world}} = F + A + R(\theta) \cdot S(s_x, s_y) \cdot (P - A) + T$$

where:
$$R(\theta) = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}, \quad S(s_x, s_y) = \begin{pmatrix} s_x & 0 \\ 0 & s_y \end{pmatrix}$$

#### Invariance of the Anchor Point:
When $P = A$, $(P - A) = (0, 0)$. Therefore:
$$A_{\text{world}} = F + A + T$$
The anchor point itself is the invariant fixed point of the rotation and scale transformation.

---

### B. The 9 Preset Pins & Custom Pin Model
1. **The 9 Preset Pins (3x3 Grid):**
   - `topLeft`: $(0, 0)$
   - `top`: $(W / 2, 0)$
   - `topRight`: $(W, 0)$
   - `left`: $(0, H / 2)$
   - `center`: $(W / 2, H / 2)$ (default)
   - `right`: $(W, H / 2)$
   - `bottomLeft`: $(0, H)$
   - `bottom`: $(W / 2, H)$
   - `bottomRight`: $(W, H)$
2. **Custom Pins:**
   - Stored in `layer.pins[name] = { x: number, y: number, unit: "px" | "%" }` in accordance with MDM Schema v4 (`PinsSchema`).
   - May lie outside the layer frame box (e.g. `{ x: -30, y: -30, unit: "px" }` or `{ x: 120, y: 120, unit: "%" }`) to enable offset pivots and follow points.
3. **Pin Resolution Engine (`src/core/geometry/pins.ts`):**
   - `resolvePinPosition(layer, pinNameOrCoords, width, height)`:
     Deterministically computes layer-local $[x, y]$ for presets, custom named pins, or explicit offsets.
   - `computeTransformedCorners(layer, pinName, rotation, scale)`:
     Computes the 4 transformed bounding corners of the layer under rotation and scale about the designated anchor pin.

---

### C. Canvas Transform & Stage Overlay
1. **CSS & Renderer Integration (`Artboard.tsx` & `EngineLayer.tsx`):**
   - The CSS transform origin is set to the resolved anchor point:
     `transformOrigin: `${anchor.x}px ${anchor.y}px``
   - Ensures GPU-composited CSS transforms, canvas overlays, and canonical `evaluate()` agree with zero visual discrepancy.
2. **Interactive Anchor Point Manipulation (`AnchorOverlay.tsx` / `TransformOverlay.tsx`):**
   - An interactive Anchor Handle (bullseye crosshair $\bigoplus$, `data-testid="anchor-point-handle"`) is rendered at the layer's anchor position.
   - Snapping: While dragging the anchor point on canvas, it shows 9 preset snapping guides and snaps when within 8px of any preset pin.
   - Dropping the anchor commits `documentCommands.updateProps(layerId, { "transform.origin": ... })` as an atomic undoable transaction.

---

## 3. Verification & Test Strategy

### A. Golden Value Matrix Test (`AnchorPointsPins.test.ts`)
- Construct canonical $100 \times 60$ rectangle at origin $(0, 0)$.
- For all 9 preset pins, apply:
  1. $90^\circ$ rotation ($R(90^\circ)$)
  2. $2 \times$ horizontal scale, $0.5 \times$ vertical scale ($S(2, 0.5)$)
  3. Combined rotation and scale ($R(45^\circ) \cdot S(1.5, 0.8)$)
- Assert that all 4 transformed corners $[(0,0), (100,0), (100,60), (0,60)]$ match pre-calculated analytical golden values with floating-point tolerance $< 10^{-6}$.

### B. Custom & Out-of-Bounds Pin Test
- Verify custom pin placed outside bounding box (e.g. $(-20, -10)$) correctly acts as pivot for rotation and scaling.

### C. Browser-Level Playwright E2E Test (`tests/e2e/anchor-points.spec.ts`)
- Select layer on canvas.
- Verify anchor handle is visible at center.
- Drag anchor handle to `topRight` preset.
- Rotate layer by $45^\circ$.
- Confirm visual rotation pivots strictly around the top-right corner.

---

## 4. Review Request to ChatGPT Partner

Please review this architectural plan for Phase 72:
1. Do you approve the mathematical formulation $P_{\text{world}} = F + A + R(\theta) \cdot S(s) \cdot (P - A) + T$ as the standard for pin and anchor transformation?
2. Do you agree with the 9 preset pins + custom pins resolution architecture in `src/core/geometry/pins.ts`?
3. Does the Golden Value Matrix test covering all 9 preset pins satisfy the verification gate (*"Done when: rotation and scale about every preset pin match golden values"* )?
