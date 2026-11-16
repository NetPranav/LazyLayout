# Decision 0025 — The anime pipeline (`ROADMAP_3D 3D-216 – 3D-226`)

**Status:** Accepted  
**Owner:** Lane F (Stage 6 & ROADMAP_3D)  
**Scope:** 2/3-tone cel ramp shaders, smoothed-normal unbroken ink outlines with paper boil, stepped animation clocks on ones/twos/threes, smears, impact frames, 12 procedural anime VFX, and multi-shot anime storyboards.

## Decision
Anime scenes decouple character animation evaluation from camera evaluation (`evaluateAnimeSteppedTime`): characters hold poses on `twos` (12 Hz inside a 24 fps timing grid) or `threes` (8 Hz) while cameras move at full 60 fps (`crash-zoom`, `dolly-zoom`, `whip-pan`, `dutch-angle`). Outlines compute smoothed corner normals so hard cubes never split corners, and 12 procedural VFX (`shadow-flames`, `energy-slash`, `aura`, etc.) run deterministically from kernel time.

## Consequences
- Authentic hand-drawn timing feel paired with silky-smooth 3D anime camera choreography.
- Deterministic impact frames and smear trails scrub identically forward and backward.
