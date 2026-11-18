### Phase 90 (Animation Playground): a panel on the live canvas to watch an animation and tune it

The Playground drives what the editor already has (speed, loop and stepping from the transport, the backdrop, the device screen, reduced motion, the frame rate) and adds holding a layer in a state and four overlays. The phase stays in progress: it does not show one animation alone, and the sweep over every reference animation is not built.

#### Added
- Commands `view.playground`, `playground.timeScale`, `playground.hold`, `playground.overlay`.
- A **Playground** button in the Preview bar and the panel: speed 0.1× to 2×, loop, play, step, backdrop, device screen, reduced motion, overlays (wireframes, box model, dimensions, touch targets under 44 px), FPS, state buttons and variant menus.
- `usePlaygroundStore` (not saved), `src/core/playground/playground.ts`, `StateDriver`'s `held` option.
- 10 unit tests and one browser test.

#### Changed (shared hot spots)
- `src/core/engine/stage/StateDriver.ts`: an optional `held` host option. Without it nothing changes.
- `src/editor/stage/useCanvasEngine.ts`: states, variants and layout are live while the Playground is open; the held state is passed in.
- `src/editor/shell/canvas-chrome/CanvasChrome.tsx`: the Playground panel, overlays and a button in the Preview bar. No schema change.

#### Not done
- One animation shown alone; knobs for text, boolean and slot properties; a click trigger button; picking a device; the automated sweep; AUD-20.
