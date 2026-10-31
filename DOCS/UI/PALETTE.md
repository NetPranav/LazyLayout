# Palette

Colors are defined **from reference images supplied by the user**.

**Status: the neutral ramp is approved (user, 2026-10-30). Accent and state colors are NOT decided.**

## Reference images

| # | Image | Stored at | Notes |
|---|---|---|---|
| 1 | "Work OS" app mock (soft gray UI, white cards, black pills, orange widget) | `DOCS/UI/palette-refs/ref-01-work-os.png` | Hex values below were sampled from the pixels, so they are approximate |

## Direction (from the user)

- Neutrals are the base of the whole UI.
- Light theme first. No second theme until the user decides.
- The accent and the state colors are **not decided**. They need their own reference image or a choice from options.

## Neutral ramp (from image 1)

| Role | Hex | Token name | Status |
|---|---|---|---|
| Raised surface (cards, lists) | `#FFFFFF` | `--neutral-0` | active in `tokens.css` (approved 2026-10-30) |
| Floating bar (toolbar) | `#F1F1F1` | `--neutral-50` | active in `tokens.css` (approved 2026-10-30) |
| Canvas | `#DFDFDF` | `--neutral-100` | active in `tokens.css` (approved 2026-10-30) |
| Panels, side rails | `#C8C8C8` | `--neutral-200` | active in `tokens.css` (approved 2026-10-30) |
| Backdrop | `#929292` | `--neutral-400` | active in `tokens.css` (approved 2026-10-30) |
| Strong dark (primary buttons text on light, secondary button) | `#464646` | `--neutral-800` | active in `tokens.css` (approved 2026-10-30) |
| Black (pills, primary action) | `#000000` | `--neutral-1000` | active in `tokens.css` (approved 2026-10-30) |

Token names follow the existing `tokens.css` style (no prefix). Recorded and implemented in `src/editor/styles/tokens.css`.

## Contrast checks (WCAG, computed)

| Text on background | Ratio | Verdict |
|---|---|---|
| `#000000` on canvas `#DFDFDF` | 15.8 | pass |
| `#464646` on canvas `#DFDFDF` | 7.1 | pass |
| `#464646` on panel `#C8C8C8` | 5.6 | pass |
| `#FFFFFF` on `#000000` | 21.0 | pass |
| `#FFFFFF` on `#464646` | 9.4 | pass |
| `#6E6E6E` on canvas `#DFDFDF` | 3.8 | **fails** for small text |
| panel `#C8C8C8` against canvas `#DFDFDF` | 1.3 | too close: separate layers with a border or shadow, not gray alone |
| `#FFFFFF` on orange `#FF811B` | 2.5 | **fails**: use black text on orange (8.4) |

Secondary text needs a gray no lighter than about `#5A5A5A` on the canvas (5.2).

## Open (user to decide)

- Accent color. Candidate from image 1: orange `#FF811B`. Others to be offered.
- State colors: selected, hover, focus ring, error, warning, success. Image 1 has only a muted green `#6E786D`.
- Whether the image's peach `#FFC8AE` and green `#6E786D` are used at all.
- Text scale (primary, secondary, disabled) on top of the neutrals.

Rules:
- Add a row before using any color.
- Every color becomes a token in `src/editor/styles/tokens.css`. No raw hex in components.
- Brand colors of third-party app icons in the image (Figma, Notion, Asana and so on) are not part of the palette.
