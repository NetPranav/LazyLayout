# Decision 0022 — Export tiers and the Scene IR (`ROADMAP_3D 3D-191 – 3D-200`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** Compact Scene IR (`scene-ir-0022-v1`), Tier 1 Zero-Script CSS (`0 B JS`), Tier 2 WebGL2 Micro-Renderer (`<= 25 KB` gzip, zero `three.js`), and Tier 3 Full Runtime (`<= 150 KB` gzip).

## Decision
Exports target the smallest capable tier automatically: CSS/WAAPI-only 3D tilt/hover/press reactions emit `0 B JS`, interactive WebGL2 scenes compile to a sliced custom WebGL2 micro-renderer (`buildWebgl2MicroRenderer`) consuming compact `CompactSceneIr` stripped of editor selection/gizmo/undo metadata, and only complex rigs/live physics pull in the full runtime. All exports enforce the 5-recipe CI size gate (`evaluateFiveRecipeSizeGate`).

## Consequences
- Typical reactive hero buttons ship in `<= 45 KB` gzip total (under 1/3 the size of the Rive runtime alone).
- Zero editor-only symbols ever leak into production builds.
