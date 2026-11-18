### Phase 91 (Motion library infrastructure): search the 51 ready-made effects, put one on a layer, tune it, detach it

The 51 presets of Sub-Phase 7.3 become versioned library effects. The presets themselves are not copied. The phase stays in progress: detach makes plain clips (not layers) and the Layers panel does not show an instance as a row.

#### Added
- `src/core/motionLibrary/library.ts`: `fx_` ids with a version, category and tags, ranked search, Rule 6.1 refusals, props (duration, delay, strength, stagger), pre-rendered thumbnails.
- Commands `library.insert`, `library.setProps`, `library.detach`, `library.remove`.
- A **Motion library** section in the Motion inspector: search, category, hover-to-play thumbnails, Insert, and one collapsible card per effect on the layer.
- 17 unit tests and one browser test.

#### Changed (shared hot spots)
- `src/core/store`: none changed. The existing document `effects` record is used (no schema change, no migration). `src/editor/panels/layers/useLeftPanelData.ts` registers the commands.

#### Not done
- Detach into layers (needs effects with a layer template: Phase 92); the Layers-panel row; the surface effect SDK is unchanged.
