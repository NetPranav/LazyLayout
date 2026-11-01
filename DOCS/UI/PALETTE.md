# Palette

The only colors workers may use. There are five official themes, approved by the user on 2026-11-01. **Paper is the default.** Components use the semantic tokens below, never a raw color or a numbered neutral, so every theme works.

The prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` shows them all. `src/editor/styles/tokens.css` still holds the earlier dark and light colors until a worker task updates it.

**Sources:** Dark is sampled from the user's Figma screenshot, `palette-refs/ref-02-figma-dark.png`. Warm uses the user's Off white, Ivory, Nude and Obsidian reference. Lilac and Paper are sampled from the user's Paper, Graphite and Lilac reference. White was proposed by Claude and chosen by the user. Mid-tone text colors and the dark backdrop were added by Claude.

**Accent:** only Lilac has an accent, `#CEB4F5`. No other theme has one. No theme has error, warning or success colors: show state with an icon and text.

## Surfaces and text

| Role | Semantic token | Paper | Dark | White | Warm | Lilac |
|---|---|---|---|---|---|---|
| Backdrop (outside the app) | `--ll-surface-backdrop` | `#E7E6E1` | `#141414` | `#F5F5F5` | `#F3F0E9` | `#E7E6E1` |
| Canvas | `--ll-surface-canvas` | `#E7E6E1` | `#1E1E1E` | `#F5F5F5` | `#F3F0E9` | `#E7E6E1` |
| Panels and top bar | `--ll-surface-panel` | `#F4F3EF` | `#2C2C2C` | `#FFFFFF` | `#FDFCF8` | `#F4F3EF` |
| Input fields | `--ll-surface-bar` | `#EEEDE8` | `#383838` | `#F0F0F0` | `#F3F0E9` | `#EEEDE8` |
| Floating surfaces (toolbar, menus, popovers) | `--ll-surface-raised` | `#F4F3EF` | `#383838` | `#FFFFFF` | `#FDFCF8` | `#F4F3EF` |
| Hover on rows and menus | `--ll-surface-hover` | `#E7E6E1` | `#2C2C2C` | `#F0F0F0` | `#E3DBCC` | `#E7E6E1` |
| Border (hairline) | `--ll-border-color` | `#CECDC8` | `#444444` | `#E3E3E3` | `#E3DBCC` | `#CECDC8` |
| Primary text | `--ll-text-primary` | `#22231E` | `#FFFFFF` | `#000000` | `#101010` | `#22231E` |
| Secondary text | `--ll-text-secondary` | `#55554F` | `#BFBFBF` | `#5C5C5C` | `#5A5549` | `#55554F` |
| Muted text and icons | `--ll-text-muted` | `#66665F` | `#A1A1A1` | `#6B6B6B` | `#6E6859` | `#66665F` |

## Controls

| Role | Semantic token | Paper | Dark | White | Warm | Lilac |
|---|---|---|---|---|---|---|
| Primary control background | `--ll-control-primary-bg` | `#22231E` | `#FFFFFF` | `#000000` | `#101010` | `#22231E` |
| Primary control text | `--ll-control-primary-fg` | `#F4F3EF` | `#1E1E1E` | `#FFFFFF` | `#FDFCF8` | `#F4F3EF` |
| Active option in switches, icon button hover | `--ll-control-active` | `#E7E6E1` | `#444444` | `#F0F0F0` | `#E3DBCC` | `#E7E6E1` |
| Selected row and active tool | `--ll-select-bg` | `#E7E6E1` | `#383838` | `#F0F0F0` | `#E3DBCC` | `#CEB4F5` |
| Text on selected | `--ll-select-fg` | `#22231E` | `#FFFFFF` | `#000000` | `#101010` | `#22231E` |
| Ship, not ready | `--ll-ship-bg` | `#E7E6E1` | `#383838` | `#F0F0F0` | `#F3F0E9` | `#CEB4F5` |
| Text on Ship | `--ll-ship-fg` | `#22231E` | `#FFFFFF` | `#000000` | `#101010` | `#22231E` |
| Avatar background | `--ll-avatar-bg` | `#E7E6E1` | `#444444` | `#F0F0F0` | `#E3DBCC` | `#E7E6E1` |
| Avatar text | `--ll-avatar-fg` | `#22231E` | `#FFFFFF` | `#000000` | `#101010` | `#22231E` |

## Canvas content

| Role | Semantic token | Paper | Dark | White | Warm | Lilac |
|---|---|---|---|---|---|---|
| Artboard | `--ll-board-bg` | `#FFFFFF` | `#383838` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| Artboard border | `--ll-board-line` | `#CECDC8` | `#444444` | `#E3E3E3` | `#E3DBCC` | `#CECDC8` |
| Image placeholder | `--ll-placeholder` | `#E7E6E1` | `#2C2C2C` | `#F0F0F0` | `#E3DBCC` | `#E7E6E1` |
| Color swatch border | `--ll-swatch-line` | `#CECDC8` | `#444444` | `#C8C8C8` | `#E3DBCC` | `#CECDC8` |
| Insert card thumbnail | `--ll-thumb-bg` | `#EEEDE8` | `#1E1E1E` | `#F5F5F5` | `#F3F0E9` | `#EEEDE8` |
| Insert card wireframe | `--ll-thumb-line` | `#CECDC8` | `#444444` | `#E3E3E3` | `#E3DBCC` | `#CECDC8` |

## Shadow

| Theme | `--ll-shadow-soft` |
|---|---|
| Paper | `0 4px 16px rgba(34,35,30,.1)` |
| Dark | `0 4px 16px rgba(0,0,0,.5)` |
| White | `0 4px 16px rgba(0,0,0,.12)` |
| Warm | `0 4px 16px rgba(16,16,16,.08)` |
| Lilac | `0 4px 16px rgba(34,35,30,.1)` |

## Rules

- The primary control is the strongest color in a theme. Use it sparingly.
- Ship uses `--ll-ship-bg` until it is ready, then the primary control colors.
- Separate layers with the hairline border or a soft shadow.
- Text needs a contrast of at least 4.5:1 in every theme. These values have not all been measured, so a worker must check them when building.
- The theme is set by `data-theme` on `<html>`, one of `paper`, `dark`, `white`, `warm` or `lilac`. Paper applies when the attribute is missing.
