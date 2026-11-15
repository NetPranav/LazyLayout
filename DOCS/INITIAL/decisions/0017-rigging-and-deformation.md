# Decision 0017: 2D Rigging, Skinning & Deformation (Phase 203)

**Status:** Decided & Implemented (`Lane E`, Stage 5 Phase 203).  
**Law:** 3 (Pure deterministic evaluation shared between live stage and exported runtime), 15 (Deterministic secondary motion replay).

## 1. Rig Hierarchy & Transforms
- A `RigDefinition` owns a parent-ordered bone array (`Bone2D`) anchored to a character's `rootLayerId`, plus `RigSkinBinding` entries mapping layer/mesh vertices to weighted bone indices (`sum(weights) === 1.0`).
- Local bone transforms compose in 2D affine form (`[a, b, c, d, tx, ty]`, matching 2D parent transform conventions):
  - `localMatrix = T(restHead + poseDelta) * R(restRotation + poseRotation) * S(poseScale)`
  - `worldMatrix(bone) = parent ? worldMatrix(parent) * T(parent.length, 0) * localMatrix(bone) : localMatrix(bone)`
- Evaluators remain pure (`evaluateRigWorldTransforms(rig, pose)`), so live canvas posing, timeline scrubbing, Playwright checks, and exported runtimes match within `< 0.01 px`.

## 2. Skinning & Vector vs Raster Deformation
- **Vectors:** Control points and Bezier handles deform via Linear-Blend Skinning (`evaluateSkinnedPoint`) and emit crisp SVG path commands (`M`, `L`, `C`, `Z`).
- **Images & Meshes:** Automatically triangulated into `DeformableMesh2D` grids with normalized bone weights (`<= 4` influences per vertex, guaranteed `sum = 1.0`), supporting brush painting and Laplacian smoothing.

## 3. IK, Constraints & Secondary Motion
- **IK:** Two-bone chains solve analytically via the Law of Cosines with deterministic `bendDirection` (`+1` / `-1`), optional stretch, angle limits, and `fkIkBlend`. Multi-bone chains (`>= 3`) use clamped FABRIK.
- **Secondary Motion (Jiggle):** Fixed-timestep damped harmonic spring driven by parent joint linear/angular acceleration (`replayJiggleOnTape`), ensuring scrubbed timeline playback and live pointer reactivity produce identical angles.
