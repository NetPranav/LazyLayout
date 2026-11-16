# Decision 0019 — 3D document model: shared data blocks (`ROADMAP_3D 3D-007`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** MDM v7 top-level shared data blocks (`scenes`, `objects`, `meshes`, `materials`, `lights`, `cameras`, `armatures`, `actions`, `worlds`).

## Decision
Every 3D scene element uses Blender-style separated data blocks stored at the MDM document root and referenced by ID from `scene3d` layers. Linking or unlinking a mesh, material, or action updates all instanced objects atomically without duplicating geometry buffers.

## Consequences
- Additive MDM v7 tables require zero migration of existing 2D projects.
- `Object3D` transforms remain lightweight while shared mesh/material assets reuse GPU buffers and cache keys.
