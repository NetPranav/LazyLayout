# Palette

The only colors workers may use. **Dark is the primary theme, designed first.** Light is the second theme and keeps the colors the user approved earlier. Components use the semantic tokens below, never a raw color or a numbered neutral, so both themes work.

Dark values are sampled from the user's Figma screenshot `DOCS/UI/palette-refs/ref-02-figma-dark.png`. Light values are sampled from `ref-01-work-os.png`. Both are approximate. No accent color in either theme (the blue in the Figma screenshot is not used). No error, warning or success colors: show state with an icon and text.

| Role | Semantic token | Dark | Light |
|---|---|---|---|
| Backdrop (outside the app) | `--ll-surface-backdrop` | `#141414` | `#8F8F8F` |
| Canvas | `--ll-surface-canvas` | `#1E1E1E` | `#DFDFDF` |
| Panels and side rails | `--ll-surface-panel` | `#2C2C2C` | `#C4C4C4` |
| Top bar, toolbar, hover and selected rows | `--ll-surface-bar` | `#383838` | `#F1F1F1` |
| Raised surfaces (cards, menus, popovers, inputs) | `--ll-surface-raised` | `#383838` | `#FFFFFF` |
| Border (hairline) | `--ll-border-color` | `#444444` | `#8F8F8F` at 50% |
| Primary text | `--ll-text-primary` | `#FFFFFF` | `#000000` |
| Secondary text | `--ll-text-secondary` | `#BFBFBF` | `#464646` |
| Muted icons | `--ll-text-muted` | `#A1A1A1` | `#464646` |
| Primary and active control background | `--ll-control-primary-bg` | `#FFFFFF` | `#000000` |
| Primary and active control text | `--ll-control-primary-fg` | `#1E1E1E` | `#FFFFFF` |

`--ll-surface-backdrop` in dark (`#141414`) was not in the screenshot. It is a darker step chosen by Claude, pending the user's review.

## Rules
- Primary controls invert with the theme: black with white text in light, white with near-black text in dark. Use sparingly.
- Separate layers with the hairline border or a soft shadow.
- Contrast of at least 4.5:1 for text in both themes (`#BFBFBF` on `#2C2C2C` is about 7:1).
- Dark is the default. The theme is set by `data-theme="dark"` or `"light"` on `<html>`, with the dark values as the default when the attribute is missing.
