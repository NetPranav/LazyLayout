# Proposal: Wiring Canvas Elements to the Motion Workspace, Timeline & Stage Evaluation

## 1. Executive Summary & Problem Context
The user tested the application locally (`npm run dev`) at `http://localhost:3000/editor?projectId=prj_mw6dp1xd_nk05` with the following workflow:
1. Created a new Rectangle layer on the canvas.
2. Switched to the **Motion** mode tab in the top navigation bar.
3. Attempted to create an animation on the newly drawn rectangle.
4. **Result:** Nothing worked. The inspector did not show controls for the rectangle, the timeline did not show the rectangle, and the stage elements remained static during timeline playback.

We performed an end-to-end headless Playwright reproduction on the running dev server, confirming the exact disconnection between the canvas, the `useMotionModel` store, the timeline, the inspector, and the stage evaluation engine.

---

## 2. Root Cause Analysis

### A. Root Cause 1: `useMotionModel` Layer Isolation
- `src/editor/motion-model/store.ts` initializes with `defaultComposition()` (`src/editor/motion-model/model.ts`), which only hardcodes 5 seed layers (`hero`, `headline`, `subtitle`, `button`, `image`).
- When a user draws a rectangle, circle, text, or frame via `createLayerFromBox`, the layer is created in `documentStore.getState().document.layers`, but `useMotionModel` is never notified.
- Consequently, `comp.layers` does not contain the newly created layer.

### B. Root Cause 2: Inspector Lockout in `KeyframeInspector.tsx`
- In `src/editor/panels/inspectors/KeyframeInspector.tsx` (line 84):
  ```typescript
  const activeLayer = useMemo(() => {
    const targetId = propLayer || docSelectedId;
    if (!targetId) return null;
    return comp.layers.find((l) => l.id === targetId || layerName(l.id) === targetId) ?? null;
  }, [comp.layers, propLayer, docSelectedId]);
  ```
- Because the newly created layer ID is not in `comp.layers`, `activeLayer` is `null`.
- In line 108:
  ```typescript
  if (!isDirectControlledKeyframe && keyTargets.length === 0) {
    if (activeLayer) {
      return <LayerInspector layer={activeLayer} className={className} />;
    }
    return <CompositionInspector className={className} />;
  }
  ```
- Because `activeLayer` is `null`, `KeyframeInspector` defaults to `<CompositionInspector />`.
- The user is shown composition-level settings (FPS, Speed, Loop) and has zero controls to add keyframes, add property tracks, or animate the selected rectangle.

### C. Root Cause 3: Timeline Invisibility in `TimelinePanel.tsx`
- In `src/editor/panels/timeline/TimelinePanel.tsx` (line 331):
  ```typescript
  const treeLayers = useMemo(() => {
    const heroLayer = comp.layers.find((l) => l.id === "hero");
    const childLayers = comp.layers.filter((l) => l.id !== "hero");
    return { hero: heroLayer, children: childLayers };
  }, [comp.layers]);
  ```
- Only layers already present in `comp.layers` are rendered as `TimelineLane` rows.
- Any newly drawn layer in `documentStore` is completely missing from the timeline.

### D. Root Cause 4: Static Canvas Rendering in `Artboard.tsx`
- In `src/editor/stage/Artboard.tsx` (lines 345–379):
  - Elements are styled solely with static `designTransform(layer.properties, ...)` based on base properties in `layer.properties`.
  - `Artboard.tsx` does not subscribe to `useMotionModel((s) => s.playhead)` and does not apply dynamic keyframe values (`valueAt(motionLayer, prop, playhead)` or kernel `evaluate`).
  - As a result, when the playhead moves, scrubs, or plays at 60 FPS, the canvas stage remains completely static.

---

## 3. Proposed Solution Architecture

### Step 1: Dynamic Motion Layer Registration (`src/editor/motion-model/store.ts` & `model.ts`)
1. Expose `ensureLayer` in `motionActions`:
   ```typescript
   ensureLayer(layerId: string): MotionLayer {
     let layer: MotionLayer | undefined;
     edit((c) => {
       layer = ensureLayer(c, layerId);
     });
     return layer!;
   }
   ```
2. When `ensureLayer` creates a `MotionLayer` for a document layer, initialize it with:
   - Full composition clip: `clips: [{ s: 0, e: comp.dur }]`
   - Default triggers, easing, and empty property tracks (`tr: []`)
   - Correct name and archetype resolved from `documentStore`.

### Step 2: Auto-Registration & Inspector Activation (`src/editor/panels/inspectors/KeyframeInspector.tsx`)
1. When `docSelectedId` is selected, check if it exists in `documentStore.getState().document.layers`.
2. If it is a valid document layer and not yet in `comp.layers`, invoke `motionActions.ensureLayer(docSelectedId)`.
3. `activeLayer` will resolve to the newly ensured `MotionLayer`, immediately rendering `<LayerInspector />`.
4. In `LayerInspector`, the user can:
   - Click "+ Add Property" to add tracks for Position X/Y, Opacity, Scale, Rotation.
   - Click presets ("Fade In", "Slide Up", "Pop").
   - Click the stopwatch / diamond button to record keyframes at the playhead.

### Step 3: Universal Timeline Layer Discovery (`src/editor/panels/timeline/TimelinePanel.tsx`)
1. In `TimelinePanel`, dynamically synchronize `treeLayers`:
   - Query all layers from `documentStore.getState().document.layers`.
   - Ensure every non-root layer has a corresponding entry in `comp.layers`.
   - Render lanes for all document layers so every layer is visible in the timeline, selectable, and animatable.

### Step 4: Live Stage Motion Evaluation (`src/editor/stage/Artboard.tsx`)
1. Subscribe `Artboard.tsx` to `useMotionModel((s) => s.playhead)` (and `s.playing`).
2. For each element `el`:
   - Look up `motionLayer = motionComp.layers.find((ml) => ml.id === el.id)`.
   - If `motionLayer` has active property tracks (`motionLayer.tr.length > 0`):
     - Sample animated values at `playhead`:
       - `animOpacity`: `valueAt(motionLayer, "opacity", playhead) / 100` (if track exists)
       - `animX`: `valueAt(motionLayer, "x", playhead)` (if track exists, else 0)
       - `animY`: `valueAt(motionLayer, "y", playhead)` (if track exists, else 0)
       - `animScale`: `valueAt(motionLayer, "scale", playhead) / 100` (if track exists, else 1)
       - `animRot`: `valueAt(motionLayer, "rot", playhead)` (if track exists, else 0)
     - Compose the animated transform with `elementTransform.transform`:
       `style.transform = [elementTransform.transform, motionTransform].filter(Boolean).join(" ")`
     - Apply animated opacity:
       `style.opacity = animOpacity !== undefined ? animOpacity : elementTransform.opacity`
3. When the playhead scrubs or plays via `frameScheduler`, `Artboard` dynamically transforms the rectangle and all other animated layers at 60 FPS in real time.

---

## 4. Verification Plan
1. **Automated Playwright E2E Verification:**
   - Launch Chromium, navigate to `http://localhost:3000/editor?projectId=prj_mw6dp1xd_nk05`.
   - Draw a new rectangle on the canvas using the rectangle tool.
   - Switch to the Motion tab.
   - Assert the rectangle lane is rendered in the timeline.
   - Assert the right panel displays `LayerInspector` with property tracks and Add Property dropdown.
   - Add a keyframe / preset (e.g. Position X or Opacity).
   - Advance playhead / trigger playback.
   - Assert the rectangle's computed DOM style (`transform` / `opacity`) changes in real time.
2. **Quality Gate:**
   - `npm run typecheck` passes with 0 errors.
   - `npm run lint` passes with 0 errors.
   - Existing unit test suites pass with 0 regressions.
