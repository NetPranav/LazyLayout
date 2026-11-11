# Decision 0018: Surfaces (Phases S2–S7) — one shared WebGL2 context, drawn into each surface's 2D canvas

**Status: written 2026-11-11.** **Owner:** Surfaces track (ROADMAP S2–S7), Lane A. **Law:** 13 (surface budget), 5 (core stays pure).

## 1. The decision
- **The maths is pure** (`src/core/surface/`): the shape's mask and distance field, the membrane height (a Poisson solve), creases and wrinkles, and the press physics (a damped membrane). No DOM, unit-tested, the same code in the editor and the exported site.
- **One WebGL2 context draws every surface.** It lives on a canvas that is never in the page. A surface is drawn there at its own size, then copied (`drawImage`) into that surface's own `<canvas>` in the layer's box. Many surfaces never open many contexts, so Law 13 holds before the Phase 173 compositor exists. This is the "one hidden context blitting to 2D" option that decision 0011 lists. When 173 lands, the surfaces become one of its roles.
- **Only what changes is redrawn**: a surface whose settings, size or content changed, or whose physics is moving.
- **The pointer:** a surface listens to presses only in Preview and on the exported site. In Design the layer's middle still selects and moves it (COLLABORATION §10).

## 2. Not decided here
- WebGPU, and drawing surfaces inside the scene rasteriser (Phase 172): later.
- Arbitrary paths as surfaces use a rasterised mask from the editor; analytic shapes (rectangles, rounded rectangles, ellipses) don't need one.
