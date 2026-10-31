# Palette

The only colors workers may use. Light theme only. Values were sampled from the user's reference `DOCS/UI/palette-refs/ref-01-work-os.png`, so they are approximate. The user approved this whole table.

| Role | Hex | Token |
|---|---|---|
| Backdrop (outside the app) | `#8F8F8F` | `--ll-neutral-400` |
| Panels and side rails | `#C4C4C4` | `--ll-neutral-200` |
| Canvas | `#DFDFDF` | `--ll-neutral-100` |
| Toolbar and floating bars | `#F1F1F1` | `--ll-neutral-50` |
| Raised surfaces (cards, menus, popovers, inputs) | `#FFFFFF` | `--ll-neutral-0` |
| Secondary text | `#464646` | `--ll-neutral-800` |
| Primary text, and primary and active controls (white text on black) | `#000000` | `--ll-neutral-1000` |
| Border (hairline) | `#8F8F8F` at 50% | `--ll-border-color` (derived from `--ll-neutral-400`) |

## Rules
- Primary and active controls are black with white text. Use sparingly, because many black controls look heavy.
- No error, warning or success colors. Show state with an icon and text. No accent color. The orange in the reference is not approved.
- No dark theme until the user decides.
- Separate layers with the hairline border or a soft shadow. `#C4C4C4` on `#DFDFDF` is only about 1.3:1.
- `#8F8F8F` is not a text color. `#464646` on `#C4C4C4` is 5.6:1 and passes.
