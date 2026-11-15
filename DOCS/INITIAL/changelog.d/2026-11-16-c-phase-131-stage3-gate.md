### Phase 131 (Stage 3 gate: the design-depth journeys)

#### Added
- `tests/e2e/stage3-gate.spec.ts`, two journeys through the editor:
  - **A (an Illustrator user):** a logo with the Shape Builder, a live boolean, smooth corners, a repeater and a wiggle, a masked conic over a picture, a variable-width stroke and text on a path.
  - **B (a web designer):** a hero with mesh and noise fills, a progressive-blur header, a 2.5D ring of cards with a depth camera, exported to Next.js, Vite and HTML, with HTML parity at five widths (0.00%).

#### Fixed
- `paint.setFills` and `paint.setStrokes` refused noise, pattern, mesh and live fills and dropped `mask`, `weight` and `align` when called through the command bus. They now take them and store what the renderer reads.
- `registerEditingCommands` works without a browser (clipboard events only where there is a window).
- `paintCommands.test.ts` (3 tests).

#### Not done
- Firefox and WebKit (CI runs them).
- The recorded manual run.
