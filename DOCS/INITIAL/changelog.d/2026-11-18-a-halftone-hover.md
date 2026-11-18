### Added

- **Halftone that follows the pointer.** It's a new effect in the inspector's effect stack, listed as "Halftone (follows the pointer)":
  - In Motion and Preview, the layer breaks into a 45° grid of dots inside a soft circle round the pointer. Toward the circle's edge the dots grow back into solid colour. Between the dots you see whatever is behind the layer, such as a sticker's white border.
  - The circle trails the pointer a little and fades away when the pointer leaves.
  - Settings: dot spacing, reach (how far the dots spread) and gap (how small the dots get under the pointer). All three can be keyframed.
  - Like the other SVG effects, it isn't drawn in Design, and exported sites don't include it yet.
