# Decision 0020 — Simulation and baking (`ROADMAP_3D 3D-049 – 3D-055`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** Deterministic XPBD cloth/soft-body simulation clock, frame cache, and runtime baking (`keyframes`, `morphTargets`, `vat`, `restPoseWithPressClips`).

## Decision
Live physics and XPBD cloth run strictly off a seeded, fixed-timestep simulation clock with checkpoint replay inside `src/core/3d/roadmap3d/m1FoilButton.ts`. For shipped web embeds that need sub-25 KB JS budgets, the editor bakes simulations to compressed morph targets, VAT textures, or rest-pose + interactive press-dent clips so no physics solver needs to ship in the micro-runtime.

## Consequences
- Scrubbing backward uses nearest prior checkpoint rather than diverging across frames.
- Foil pillow buttons maintain enclosed volume within `1%` drift under pointer dents.
