# Option popovers: write, close, reopen, undo (2026-11-12)

Headless Chromium 1600x1400 against the dev server. For every control in each popover: change it, check the document changed, close, select another layer and come back, reopen and read the control, then Ctrl+Z and check the document is back. Layers: text (Headline), button (Get started), image (Hero image), frame (Hero), shape (a rectangle added by script), vector (a svgPath added by script). The harness was a throwaway script; the controls counted below are every enabled input, select, segmented button and switch in the popover.

| popover | layers | controls | persisted | undo | note |
|---|---|---|---|---|---|
| Position (type, z, offsets, scale, skew, rotate, origin, 3D, constraints, mesh) | text, button, vector | 20 | yes | yes | |
| Layout (min/max, padding, margin, overflow, unit, box, self, grow, shrink, reverse direction) | text, button, frame | 18 to 19 | yes | yes | Unit takes 2 undo steps (it also converts the value). Reverse direction is a hidden checkbox: proved by clicking its label |
| Appearance (4 corners, blend, cursor, pointer events) | text, button, image, frame, shape, vector | 4 to 7 | yes | yes | Fixed: per-corner radius was dropped on every layer except a rectangle. Now the first corner writes `appearance.radius`, the other three are disabled with a tooltip |
| Typography (case, decoration, word spacing, overflow, white space, loading) | text, button | 11 | yes | yes | |
| Image (fit, position, filters, placeholder, loading, overlay colour/opacity/blend) | image | 12 | yes | yes | Overlay blend proved with a non-default value |
| States (size, type, focus ring, disabled opacity, loading, spinner, ripple, ripple duration) | button | 9 | yes | yes | Disabled opacity and ripple proved by hand |
| Page: Theme & Tokens (feedback) | page | 1 | yes | n/a | Fixed: it used localStorage and a data attribute, nothing in the project. Now the engine's `environment.theme.feedback` (5 values), saved with the project (survives reload). Environment is not in document history, so no undo |
| Page body: radius, font, scale, shadow | page | 4 | yes | n/a | Fixed: local state only. Now `environment.theme` (default radius, type family, scale, elevation). The Primary, Surface and Text colours have no engine field: still local, blocked |
| Fill row (paint type, hex, opacity) | text, button, image, frame, shape | 3 | yes | yes | Fixed: an image's fill row reopened showing `0F172A` (it read the text-colour default first). Non-text layers now read their background first |
| Stroke row (colour, position, width, style, sides, cap, join, dash) | shape, button | 14 | yes | yes | Fixed: style reopened as Solid after Dashed (a shape stores a dash array; it is now read back as Solid/Dashed/Dotted). Cap, join and dash persist on shapes and are disabled with a tooltip on button, frame, text, image. Miter is disabled everywhere: no engine property (see INTEGRATION.md) |
| Effects row (type, colour, x, y, blur, spread) | button | 6 | yes | yes | Changing the type rebuilds the row and closes the popover; the document change and undo are correct |
| Vector (corner radius + Round, Join paths) | vector | 2 | yes | yes | Round rewrites the path nodes once (known, INTEGRATION.md pen item 3); undo restores it. Join paths is disabled with one path |

Not covered: the Accessibility and Constraints sections of a few layer kinds that have no popover trigger in this build; the Frame popovers of auto layout bands (Stage G handoff).

Blocked (engine): Stroke miter limit, per-corner radius on non-rectangles, theme colours. All in `DOCS/UI/INTEGRATION.md`, "Option popovers: engine-side gaps".
