# Reconnecting Lane A (phases 13–52) to the new UI

Measured 2026-11-06 by counting files that import each `src/core` area (`src/editor` vs `src/legacy-editor`). "New = 0" means the new UI cannot reach the feature at all.

| Core area (phases) | New UI files | Legacy files | Existing new-UI control to reconnect | Needs a NEW element? |
|---|---|---|---|---|
| viewport/camera, frames (20–21) | 3 / 4 | 10 / 9 | Zoom controls, artboard | no (done in PR #63 for wheel/hand) |
| tools, creation (24–25) | 0→done in #63 | 3 | bottom bar | pen/pencil/bucket/shape builder buttons |
| selection, hit (22, 26) | 1 / 0 | 4 / 8 | stage select, marquee | no |
| editing, clipboard (29) | 2 / 0 | 16 / 0 | context menu, Edit menu, shortcuts | no |
| align/distribute/tidy (30) | via ids in #63 | - | Position row align icons | no |
| text (31), fonts (38) | 0 / 0 | 3 / 3 | Typography section | font picker/upload |
| layers (32) | 2 | 2 | Layers tree | no |
| inspector Simple/Pro (33–34) | done | - | sections | no |
| paint: gradients, shadows, blur (35) | 0 | 8 | Fill / Stroke / Effects sections (display only today) | gradient editor |
| assets, image layers (36–37) | 1 | 8 | Assets section (sample data) | Image tool upload |
| pen, vector, boolean (39–40) | 0 | 5 | none | yes (tools + boolean menu) |
| auto-layout, grid, constraints (41–42) | 0 | 6 | Layout section (writes layout.mode, not layout.auto) | grid controls |
| breakpoints (43–44) | 0 | 4 | Preset dropdown (artboard width only) | breakpoint overrides UI |
| tokens, styles (45) | 0 | 3 | Theme & Tokens (display only) | yes |
| components, variants (46–47) | 0 | 1 | Insert > Components tiles (sample) | yes |
| pages, sections (48) | 0 | 4 | Page switcher, Page section | yes (pages manager) |
| export (49) | 0 | 4 | Export menu item (disabled) | yes (export dialog) |
| agent bridge (50) | 0 | 1 | none | yes (pairing dialog) |
| templates (51) | 0 | 1 | Insert > Sections tiles (sample) | no (data only) |

## Order of work
1. Batch 1, existing controls only: Edit/clipboard/shortcuts, Fill/Stroke/Effects paint, Layout stack/grid, Typography + fonts, Assets + Image, Insert tiles, Ctrl+K, canvas toggles.
2. Batch 2, needs approval for new UI: pen/vector, tokens, components/variants, pages, breakpoints, export, pairing.
