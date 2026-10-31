# Palette

The only colors workers may use. Taken from the user's reference image `DOCS/UI/palette-refs/ref-01-work-os.png` (sampled, so approximate). Light theme only. In Tailwind these are `ll:bg-neutral-100`, `ll:text-neutral-800` and so on.

| Role | Hex | Token | Status |
|---|---|---|---|
| Raised surface (cards, lists) | `#FFFFFF` | `--ll-neutral-0` | approved by the user |
| Floating bar, toolbar | `#F1F1F1` | `--ll-neutral-50` | approved by the user |
| Canvas | `#DFDFDF` | `--ll-neutral-100` | approved by the user |
| Panels, side rails | `#C8C8C8` | `--ll-neutral-200` | approved by the user |
| Backdrop | `#929292` | `--ll-neutral-400` | approved by the user |
| Strong dark, secondary text | `#464646` | `--ll-neutral-800` | approved by the user |
| Black, primary text | `#000000` | `--ll-neutral-1000` | approved by the user |

## Working defaults (not confirmed by the user)

- Primary and active controls: black with white text. Use it sparingly, because many black controls together look heavy.
- Secondary text: `#464646`.
- Error, warning and success: no colors exist yet. Show state with an icon and text.
- No accent color. Orange `#FF811B` from the image is not approved.

## Contrast

- `#000000` on `#DFDFDF` 15.8:1, `#464646` on `#DFDFDF` 7.1:1, `#464646` on `#C8C8C8` 5.6:1: pass.
- `#929292` is not a text color.
- `#C8C8C8` against `#DFDFDF` is 1.3:1, so separate layers with a hairline border or soft shadow.
