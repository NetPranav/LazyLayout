# Revised Architecture: Canonical MDM v5 Integration for Motion Workspace & Stage Evaluation

## 1. Response to Architectural Feedback & Core Principles
We fully accept all architectural requirements specified in the review:
1. **Single Source of Truth (MDM v5):** `documentStore` (`doc.layers`, `doc.clips`, `doc.compositions`) is the sole authoritative persisted data store. The Motion UI (`useMotionModel`) acts strictly as a reactive projection and interaction controller, never as an independent or parallel data authority.
2. **Canonical Kernel as Sole Evaluation Engine:** The Stage (`Artboard.tsx`) will **not** independently compute `valueAt()` or append ad-hoc CSS transforms. All animated values and transforms on the Stage will be evaluated strictly through the canonical evaluation kernel: `evaluate(doc, compositionId, layerId, t)`.
3. **Single Synchronization Boundary:** A centralized, idempotent synchronization function (`syncDocumentToMotion`) driven by Document Store subscriptions will manage the lifecycle of Motion UI representations. Neither the inspector nor the timeline will ad-hoc construct uncommitted layers.
4. **Canonical Property Definitions & Document Transactions:** Keyframing in the UI (stopwatch, diamond, scrubbing, presets) will execute through `documentCommands` / `keyframeOps.setKeyframeAt()` inside undoable document transactions. All tracks use canonical MDM property paths (`"transform.x"`, `"transform.y"`, `"transform.rotate"`, `"transform.scale"`, `"appearance.opacity"`).

---

## 2. Revised Architecture & Data Flow

```
                      ┌────────────────────────────────────────┐
                      │        Document Store (MDM v5)         │
                      │  - doc.layers                          │
                      │  - doc.clips (tracks & keyframes)      │
                      │  - doc.compositions (MAIN_COMPOSITION) │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
   [1. Canonical Mutation]                             [2. Idempotent Projection]
   Typed Commands & keyframeOps                        syncDocumentToMotion(doc)
   (setKeyframeAt, deleteKeyframe)                               │
                 ▲                                               ▼
                 │                                    ┌─────────────────────┐
┌────────────────┴────────────────┐                   │   useMotionModel    │
│           Motion UI             │                   │   - comp.layers     │
│  - TimelinePanel (all layers)   │                   │   - playhead, zoom  │
│  - LayerInspector (properties)  │                   │   - transport / wa  │
│  - KeyframeInspector (curves)   │                   └──────────┬──────────┘
└─────────────────────────────────┘                              │
                                                                 │ Playhead Time t
                                                                 ▼
                                                      ┌─────────────────────┐
                                                      │  Canonical Kernel   │
                                                      │    evaluate()       │
                                                      └──────────┬──────────┘
                                                                 │ Evaluated Props
                                                                 │ (Matrix, Origin, Opacity)
                                                                 ▼
                                                      ┌─────────────────────┐
                                                      │     Stage Canvas    │
                                                      │    (Artboard.tsx)   │
                                                      └─────────────────────┘
```

---

## 3. Detailed Component Responsibilities & Implementation Plan

### A. Centralized Synchronization Bridge (`src/editor/motion-model/sync.ts`)
- Implements `syncDocumentToMotion(doc: MotionDocument, prevComp: Composition): Composition`:
  - Iterates over all non-root layers in `doc.layers`.
  - For each layer, maps existing canonical clips from `doc.clips[clipId]`:
    - Track `"appearance.opacity"` $\rightarrow$ UI track `p: "opacity"` (values scaled $0..1 \rightarrow 0..100\%$)
    - Track `"transform.x"` $\rightarrow$ UI track `p: "x"`
    - Track `"transform.y"` $\rightarrow$ UI track `p: "y"`
    - Track `"transform.rotate"` $\rightarrow$ UI track `p: "rot"`
    - Track `"transform.scale"` $\rightarrow$ UI track `p: "scale"` (values scaled $1.0 \rightarrow 100\%$)
  - If a layer has no clips yet, provides a default UI clip spanning composition duration (`clips: [{ s: 0, e: comp.dur }]`) with empty tracks, ready to receive keyframes.
  - Automatically removes layers that have been deleted in `doc.layers`.
  - Driven by `documentStore.subscribe` so layer creation, duplication, renaming, deletion, undo, redo, and project reload immediately update the motion projection.

### B. Timeline Panel Integration (`src/editor/panels/timeline/TimelinePanel.tsx`)
- Displays all eligible content layers from `comp.layers` as timeline lanes.
- Shows keyframe tick marks, property tracks, and clip bounds projected directly from canonical MDM state.
- Clicking any lane selects the layer via `useSelectionStore.getState().select(layerId)`.

### C. Inspector Activation & Canonical Keyframing (`src/editor/panels/inspectors/`)
- In `KeyframeInspector.tsx`, `activeLayer` resolves against the synchronized `comp.layers`.
- When an element is selected on the canvas or timeline, `LayerInspector` renders its properties (Opacity, Position X/Y, Scale, Rotation).
- Interacting with animation controls:
  - **Stopwatch toggle / Add keyframe / Diamond toggle / Value scrub / Presets:**
    Maps the UI property (`"x"`, `"y"`, `"rot"`, `"scale"`, `"opacity"`) to the canonical path (`"transform.x"`, `"transform.y"`, `"transform.rotate"`, `"transform.scale"`, `"appearance.opacity"`).
    Dispatches through `setKeyframeAt(layerId, canonicalPath, tInSeconds, { value, ease })` inside a document transaction.
  - Generates undo/redo history in `useHistoryStore` and updates `doc.clips` in MDM v5.

### D. Stage Rendering via Canonical `evaluate()` (`src/editor/stage/Artboard.tsx`)
- Subscribes to playhead updates from `useMotionModel((s) => s.playhead)` / `useTransportTime`.
- For each rendered stage element `el`:
  - Retrieves canonical evaluated properties:
    ```typescript
    const t = playhead / (comp.fps || 60);
    const evaluated = evaluate(doc, MAIN_COMPOSITION_ID, el.id, t);
    ```
  - Applies evaluated transform and opacity:
    - `style.transform = evaluated.transform || elementTransform.transform`
    - `style.transformOrigin = evaluated.transformOrigin || elementTransform.transformOrigin`
    - `style.opacity = typeof evaluated["appearance.opacity"] === "number" ? evaluated["appearance.opacity"] : (layer?.properties["appearance.opacity"] ?? 1)`
- Preserves Phase 72 anchor offsets and Phase 73 parent chain matrix composition automatically via the kernel's `propsToLocalMatrix` and `multiplyAffineMatrices`.

---

## 4. Addressing Acceptance Criteria (M1 – M10)

| ID | Acceptance Criterion | Architectural Solution |
| :--- | :--- | :--- |
| **M1** | Newly created document layers appear in Motion UI automatically | `syncDocumentToMotion` subscribes to `documentStore`; drawing any layer immediately projects into `comp.layers` without requiring prior selection. |
| **M2** | Duplicating, renaming and deleting layers update Motion UI | Synchronizer responds to `doc.layers` mutations: names are synced from `layer.name`, deleted layers are removed, duplicated layers receive default clip representations. |
| **M3** | Undo/redo and project restoration preserve synchronization | All clips/keyframes live in MDM v5; undo/redo restores `doc`, which immediately projects into `useMotionModel`. |
| **M4** | Inspector resolves selected layer and displays animation controls | `activeLayer` reliably matches the selected `docSelectedId` in `comp.layers`, activating `LayerInspector` and property controls. |
| **M5** | Timeline displays every eligible document layer | `TimelinePanel` renders all content layers in `comp.layers` as selectable lanes. |
| **M6** | Keyframe creation mutates canonical MDM via transactions | Stopwatch / diamond / scrubbing call `setKeyframeAt` with canonical property paths in document transactions. |
| **M7** | Stage evaluates exclusively through canonical `evaluate()` | `Artboard.tsx` queries `evaluate(doc, MAIN_COMPOSITION_ID, layerId, t)` and applies canonical matrix and opacity styles. |
| **M8** | Animated transforms preserve Phase 72 anchors and Phase 73 parenting | Handled directly by `evaluate()` kernel matrix composition (`formatCssMatrix(composedM)` and `synthesizeTransform`). |
| **M9** | Scrubbing, playback and seeking produce consistent evaluated results | All paths advance transport time `t` evaluated by the same deterministic kernel. |
| **M10** | Export and editor preview share identical animation semantics | Export compiler and editor Stage consume the exact same `evaluate()` kernel logic. |

---

## 5. Verification & Test Suite Plan

We will add a dedicated automated test suite `src/editor/motion-model/__tests__/documentMotionSync.test.ts` plus Chromium E2E verification:
1. **Unit / Integration Tests:**
   - **M1 / M2 / M3 Test:** Create layer $\rightarrow$ verify projected in `comp.layers`. Rename $\rightarrow$ verify name updated. Delete $\rightarrow$ verify removed. Undo $\rightarrow$ verify restored.
   - **M6 / M7 Test:** Add keyframe via `setKeyframeAt` $\rightarrow$ verify `evaluate()` produces interpolated values $\rightarrow$ verify stage style reflects evaluated properties.
   - **Parenting + Motion Test (Phase 72/73):** Animate parent transform $\rightarrow$ verify child world matrix follows parent animation through `evaluate()`.
   - **Anchor + Motion Test:** Animate rotation on layer with non-central anchor `[1, 1]` $\rightarrow$ verify `evaluate()` applies correct origin offset.
2. **Playwright E2E Verification:**
   - Run against dev server on `http://localhost:3000/editor?projectId=prj_mw6dp1xd_nk05`.
   - Draw rectangle $\rightarrow$ switch to Motion tab $\rightarrow$ assert rectangle lane exists.
   - Add opacity keyframes (0% at 0s, 100% at 1s) $\rightarrow$ scrub playhead $\rightarrow$ verify rectangle DOM opacity matches evaluate() at $t=0, 0.5, 1.0$.
3. **Typecheck & Lint:**
   - `npm run typecheck` (0 errors)
   - `npm run lint` (0 errors)
