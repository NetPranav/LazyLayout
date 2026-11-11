# Decision 0013: The 3D stack (ROADMAP_3D 3D-001, was Main 218)

**Status: written 2026-11-11 (Lane A); waiting for review in its pull request.** **Owner:** ROADMAP_3D 3D-001. **Laws:** 7 (licences), 13 (one GPU, shared), 3D laws 1, 5, 6.

## 1. The decision

| Need | Choice | Licence (read from the package) | When it is added |
|---|---|---|---|
| Renderer | **three.js** r186 (installed 0.186.1): `WebGPURenderer` with TSL first, WebGL2 fallback, one renderer per compositor context, shared by every 3D layer (3D-002) | MIT | installed |
| React export | **@react-three/fiber** 9.8.1, **@react-three/drei** 10.7.8 | MIT, MIT | installed |
| Raycasts, BVH | **three-mesh-bvh** 0.8.3 | MIT | installed |
| Path tracer (editor's Rendered view and baking only, decision 0021) | **three-gpu-pathtracer** 0.0.28 | MIT | 3D-056 |
| Rigid physics | **Rapier** (`@dimforge/rapier3d-compat`, or the `-deterministic-compat` build if cross-browser determinism needs it) | Apache-2.0 | 3D-135 |
| Light rigid physics fallback | **cannon-es** 0.20.0 (only if a project needs physics under Rapier's size) | MIT | not planned |
| Cloth, soft bodies, pressure | **Our own XPBD solver** (`src/core/surface/cloth.ts` today, on the GPU at 3D-050). No library handles balloon pressure with a fixed seam. | ours | 3D-050 |
| Post-processing | three.js's own passes first; **postprocessing** only if they fall short | zlib | 3D-093 |
| Mesh compression | **meshoptimizer** 1.3.0; **draco3d** 1.5.9 decoder for imported files | MIT, Apache-2.0 | 3D-172, 3D-158 |
| Textures | KTX2 / Basis transcoder (ships with three.js's examples) | Apache-2.0 | 3D-159 |

## 2. The physics benchmark (archived: `scripts/benchmarks/physics-3d.mjs`)

100 bodies (balls and boxes) fall into a pile, 600 steps at 60 Hz, two runs each, Node 26 on this Apple-silicon laptop:

| | Rapier 0.14.0 (compat) | cannon-es 0.20.0 |
|---|---|---|
| 600 steps | 126 ms first run, 57 ms second (0.1–0.2 ms a step) | 614 ms, 480 ms (0.8–1 ms a step) |
| Both runs end identically (position hash) | yes (`4b2f601113e0cf86`) | yes (`4e3982a9f8cc0b37`) |
| Size, gzipped | 749 KB (the WASM is inlined as base64) | 74 KB |

**Rapier** is 5–10 times faster, deterministic in-process, and has a cross-platform deterministic build. It is also 10 times larger, so:
- it is **loaded lazily**, only when a scene has rigid bodies;
- the export uses its non-inlined build (a separate `.wasm` file, fetched in parallel and cached).

The benchmark is re-run on the newest version (0.21 at the time of writing) when it is added at 3D-135, and on a phone profile.

## 3. Size budgets in the exported site (checked from 3D-174)

| Part | Budget (gzipped) | Loaded when |
|---|---|---|
| three.js core used by a scene | 160 KB | the page has a 3D layer, after the poster |
| R3F glue (React exports) | 40 KB | same |
| The 3D runtime (bindings, states, pointer forces on baked clips) | 30 KB | the scene is interactive |
| Rapier | 800 KB | the scene has live rigid bodies (baked ones don't need it) |
| Path tracer | never shipped | editor only |

## 4. If a licence changes
Every choice above has a replacement:
- three.js has no single replacement, but it is MIT and forkable at the last MIT version.
- Rapier → cannon-es.
- The path tracer → our real-time renderer with baked light.
- meshoptimizer → Draco.

`LICENSES.md` lists each dependency. The licence scanner (Main 262) blocks restrictive licences.

## 5. Not decided here
- **GPU surfaces** (how contexts are shared): decision 0011, 3D-002.
- **The 3D document model:** decision 0019, 3D-007.
- **Simulation and baking:** decision 0020, 3D-049.
- **The path tracer's scope:** decision 0021, 3D-056.
