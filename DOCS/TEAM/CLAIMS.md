# Claims: shared numbers

Claim a number here **before** you use it, in the same PR or an earlier one. Whoever gets merged to `main` first wins; the other person takes the next number. See `COLLABORATION.md` §4 and §6. This is the only thing to reserve; there are no folder limits.

## MDM schema versions & migrations

Current schema: **v6** (on `main`).

| Version | Lane | Phase | What changes | PR |
|---|---|---|---|---|
| v6 | B | 53 | Animation grammar gaps: `exit`/`focus`/`stagger`/`layout` clip types; `unmount`/`layoutChange` triggers. Additive, no data rewritten. | merged |
| v7 | A | ROADMAP_3D 3D-007 | 3D data blocks: top-level `scenes`, `objects`, `meshes`, `materials`, `lights`, `cameras`, `armatures`, `actions`, `worlds` tables; a `scene3d` layer points at a scene. Additive, no data rewritten. | |

## Decision records (`DOCS/INITIAL/decisions/`)

Next free number: **0026** (0008 is the threat model and 0009 the render host; 0010–0017 are named in ROADMAP §6, where 0014 is the MCP bridge and 0015–0017 were added by ROADMAP v4.1). (0006 is unused on purpose; v3 numbers clashed, see ROADMAP §6.)

| Number | Lane | Title | PR |
|---|---|---|---|
| 0006 | D | Stateful simulation and deterministic 2D physics (Phase 162, PR pending) | `0006-stateful-simulation-and-determinism.md` |
| 0008 | A | Threat model for the stage and user content (Phase 16) | |
| 0009 | A | Render host: live DOM frames, no HTML strings (Phase 18) | |
| 0012 | D | Code component isolation: opaque-origin sandboxed iframe bridge (Phase 195) | |
| 0014 | A | MCP bridge: a local MCP server paired with an open editor tab (Phase 50) | |
| 0015 | C | Path engine: curve-exact booleans (Phase 103); written 2026-11-14 | |
| 0016 | D | Scene rasteriser: any layer to pixels (Phase 172) | |
| 0022 | F | Export tiers and the scene IR: zero-script, micro, full (ROADMAP_3D 3D-192) | `0022-export-tiers-scene-ir.md` (PR #184) |
| 0023 | F | AI services and privacy: browser and server models, one gateway (ROADMAP_3D 3D-201) | `0023-ai-services-privacy.md` (PR #184) |
| 0024 | F | Photo to surface: proxy, depth, creases, text wrap (ROADMAP_3D 3D-209 – 3D-212) | `0024-photo-to-surface.md` (PR #184) |
| 0025 | F | The anime pipeline: toon, ink, twos, smears, effects, shots (ROADMAP_3D 3D-216 – 3D-226) | `0025-anime-pipeline.md` (PR #184) |
| 0017 | E | Rigging and deformation (Phase 203) | `0017-rigging-and-deformation.md` |
| 0018 | A | Surface rendering: one shared WebGL2 context, drawn into each surface's 2D canvas (Phases S2–S7) | |
| 0019 | F | 3D document model: shared data blocks (ROADMAP_3D 3D-007) | `0019-3d-document-model.md` (PR #184) |
| 0020 | F | Simulation and baking (ROADMAP_3D 3D-049) | `0020-simulation-and-baking.md` (PR #184) |
| 0021 | F | Path tracer in the editor and for baking only (ROADMAP_3D 3D-056) | `0021-editor-path-tracer.md` (PR #184) |

## New AUDIT IDs

Highest existing: check `DOCS/INITIAL/AUDIT.md` before claiming.

| ID | Lane | Finding | PR |
|---|---|---|---|
| | | | |
