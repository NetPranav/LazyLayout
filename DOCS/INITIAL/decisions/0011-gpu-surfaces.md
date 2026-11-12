# Decision 0011: GPU surfaces — how everything that draws with the GPU shares it (ROADMAP_3D 3D-002, was Main 173)

**Status: written 2026-11-11 (Lane A).** **Owner:** ROADMAP_3D 3D-002. **Law:** 13 (only the compositor creates WebGL/WebGPU contexts). **Replaces:** decision 0018's private surface context (it now lives in the compositor).

## 1. The constraint
Surfaces and 3D scenes must sit **between page layers** (a button among other buttons, a 3D shoe under a heading). So one big overlay canvas drawing everything doesn't work. Browsers also limit live WebGL contexts (about 16, after which the oldest is lost with a warning), and contexts can't share textures.

## 2. The measurement (`scripts/benchmarks/gpu-surfaces.ts`)
20 small surfaces (908 × 320 px) and one large (1440 × 900), redrawn every frame for 120 frames:

| Strategy | Apple A18 Pro (Metal), mean / p95 | SwiftShader (CI's software GPU), mean / p95 |
|---|---|---|
| **copy:** one hidden context; each surface copies its result into its own 2D canvas (`drawImage`) | 0.6 ms / 1.0 ms | 368 ms / 385 ms |
| **bitmap:** one OffscreenCanvas context per surface size; hand over with `transferToImageBitmap` (no copy) | 1.4 ms / 0.6 ms (38 ms if one canvas is resized between sizes) | 186 ms / 194 ms |
| **one context per surface** (21 contexts) | 0.11 ms / 0.3 ms (CPU submit only) | 0.04 ms (submit only) |

**What the numbers say:**
- On a real GPU, every strategy fits in a frame. The copy adds about 25 µs per surface.
- The bitmap hand-over needs one context per distinct size, so it doesn't save contexts.
- One context per surface is the cheapest per frame, but it hits the browser's limit, and nothing can be shared between contexts.

## 3. The decision: two roles
| Role | Who | How | Limit |
|---|---|---|---|
| **surface** | 2.5D surfaces, effects, small GPU drawings | One shared hidden context. Each draws, then the compositor copies the result into the surface's own 2D canvas (`compositor.present`). | Unlimited in number. One context. |
| **scene** | 3D scenes (3D-012 on) | Each scene's own canvas and context. Off screen it **sleeps**: the compositor keeps its last frame as a poster and releases the context. When the budget is full, the longest-awake scene that is off screen is evicted. A visible scene with no free context waits, showing its poster. | `sceneBudget` contexts (6 by default; 3 on the low tier, 3D-005). |

**Total:** at most 1 + `sceneBudget` contexts, plus 1 kept spare for baking and the path tracer (3D-056). That leaves headroom under every browser's limit.

## 4. Context loss
- The compositor listens for loss on every context it owns and asks for it back.
- **Surfaces:** their 2D canvases keep showing their last frame. When the shared context returns, the surface drawer is rebuilt and each surface uploads its textures again on its next draw (`surfaceGeneration`).
- **Scenes:** get `onRelease` on loss, then `onReady` when the context is back.

## 5. Checked by
`tests/e2e/gpu-compositor.spec.ts`, on `/editor/gpu-lab`:
- 20 surfaces and 10 scenes stay within 1 + 6 contexts, and the browser never warns about too many.
- A scene scrolled away sleeps with its last frame as a poster, and wakes when scrolled back.
- A lost shared context and a lost scene context both come back within 1 s, and surfaces draw again.

Also, `scripts/surface-compare.ts` scores 0.6065 through the compositor, the same as before the move.

## 6. Not decided here
- **WebGPU** (opt-in through three.js's `WebGPURenderer`, 3D-042). A WebGPU device can be shared by many canvases, so the scene budget may rise there.
- **The memory ledger:** 3D-003.
