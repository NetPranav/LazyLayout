# Decision 0023 — AI services and privacy (`ROADMAP_3D 3D-201 – 3D-203`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** Unified `AiServiceGateway3D` for monocular depth, promptable cutouts, surface normals, edge creases, and optical tracking.

## Decision
All 3D vision models go through `AiServiceGateway3D` with a strict `keepOnDevice` privacy lock. When `keepOnDevice` is true, zero network requests are permitted and server adapters automatically fall back to permissive-licensed (`Apache-2.0`, `MIT`, `BSD-3-Clause`) local WebGPU/WASM vision pipelines cached by content hash.

## Consequences
- Client footage and product photos never leave the user's machine in default privacy mode.
- Every shipped vision model passes automated license verification.
