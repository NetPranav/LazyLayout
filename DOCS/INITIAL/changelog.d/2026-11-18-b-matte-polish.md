### Added

- **Matte feather.** A track matte has its own **Feather** field, so what it reveals fades in instead of being cut. Before, the feather showed only for a drawn mask.
- **A matte follows its copies' effector.** When a matte's source is a cloned shape with an **Effector**, the matte's copies change size and place as the drawn copies do: by number, by noise, or near the pointer. So one dot with Clone → Fill area and Effector → Pointer makes dots that grow round the mouse and shrink away from it.

### Fixed

- **No hover outline in Preview.** In Preview and Motion, moving the mouse over the canvas no longer draws a layer's hover outline, and no longer redraws the canvas each time it crosses a layer.
- **Hidden matte sources aren't restyled.** A pointer effector no longer restyles the copies of a layer inside a hidden matte source on every frame (a dot grid of thousands made hovering slow). The matte reads the effector itself.
- **A very long matte keeps what fits.** A matte too long for the renderer keeps as many shapes as fit, instead of being dropped whole. A dot is about 30 characters, so a grid of about 3,000 dots fits.
