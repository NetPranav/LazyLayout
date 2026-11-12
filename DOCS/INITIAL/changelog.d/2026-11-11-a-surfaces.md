## Surfaces (Phases S1–S9): inflated, creased, pressable layers

- **S1 Reference image:** File > Place reference image, or Alt+drop. The picture goes behind everything at 50% opacity, locked, as a helper (never exported).
- **S2–S4b Shape:** any frame, rectangle or ellipse can be an inflated surface. Its resting shape comes from a cloth simulation: an inextensible sheet with a little extra material, sealed at its seam and inflated by pressure, so the pleats and pinched corners come from physics. A quick membrane shape is the alternative. The simulation runs in a worker and is cached.
- **S3, S3b Light:** foil, plastic and satin, lit by a studio environment map with gloss blur and Fresnel. The colour is the layer's fill.
- **S5 Text on the surface:** a frame's text is printed on its surface, bends with it and is pulled into a press. It stays real text: selectable, editable and read by screen readers.
- **S6 Press physics:** a damped membrane. A press dents the surface at the pointer, the foil crumples round it, the rest rises and it springs back. This works on the editor's live canvas (Motion, Preview) and in the lab, and never takes the pointer in Design.
- **S8 Comparison harness:** `scripts/surface-compare.ts` replays a reference video's presses frame by frame and writes a side-by-side page with SSIM scores. The reference button is at 0.61, up from 0.41.
- **S9 The 3D face:** a 2D | 3D switch at the top right of the right panel. The 3D side has Looks (one click), Shape, Material & light, Press and Reference.
- One shared WebGL2 context for every surface (decision 0018).
- `npm run demo`-style scripts: `scripts/demo-balloon-steps.ts` makes the button in 7 steps, slowly, and leaves the window open.
