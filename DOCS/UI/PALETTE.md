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

## Decisions log

- 2026-10-30: neutrals are the base of the whole UI (user). Light theme first.
- 2026-10-30: Apple-level **layout**, no glass or blur, no capsule or pill shapes (user).
- 2026-10-31: the UI is rebuilt from scratch in `src/editor`; the old one is `src/legacy-editor` (user).
- Proposed, **not confirmed by the user**: black (`--neutral-1000`) with white text for primary and active controls instead of teal, as in image 1. Orange `#FF811B` from image 1 is unused until the user picks an accent.
- Proposed, **not confirmed**: a lighter secondary-text step (`#5A5A5A`, 5.2:1 on the canvas) between `#464646` and the panel grays.

## Neutral ramp (from image 1)

| Role | Hex | Planned token | Status |
|---|---|---|---|
| Raised surface (cards, lists) | `#FFFFFF` | `--neutral-0` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |
| Floating bar (toolbar) | `#F1F1F1` | `--neutral-50` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |
| Canvas | `#DFDFDF` | `--neutral-100` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |
| Panels, side rails | `#C8C8C8` | `--neutral-200` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |
| Backdrop | `#929292` | `--neutral-400` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |
| Strong dark (primary buttons text on light, secondary button) | `#464646` | `--neutral-800` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |
| Black (pills, primary action) | `#000000` | `--neutral-1000` | approved 2026-10-30; not yet in the new `src/editor/styles/tokens.css` |

Token names are planned and follow the `tokens.css` style (no prefix). The new `src/editor/styles/tokens.css` is created fresh when the first new page starts, with only this ramp. The old `src/legacy-editor/styles/tokens.css` is not the source of truth.

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
