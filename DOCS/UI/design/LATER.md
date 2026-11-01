# Design ideas saved for later

Not built yet. Status: proposed by Claude, parked by the user on 2026-11-01. Nothing here is approved.

## Resizable side panels that change layout

Both side panels can be resized. Panels change their layout as they get wider, not just stretch. The default right panel width of 304px is already applied.

**Right panel**

| Layout | Width | Fields per row |
|---|---|---|
| Compact | 264-319 | 2 |
| Comfortable | 320-399 | 3 |
| Wide | 400-480 | 4 to 5 |

**Left panel**

| Layout | Width | Shows |
|---|---|---|
| Icons | 56 | Type icons only |
| List | 200-299 | Icons and names |
| Preview | 300-420 | Small thumbnails of each layer |

**Dragging**

- The hairline brightens on hover, and a tag shows the width while dragging (`304 px`).
- Soft snap at each layout's width. `Alt` turns it off.
- The artboard stays in place while resizing. It re-centers only on Fit to screen.
- Double-click the handle to return to the default width.
- Dragging past the minimum collapses the panel to its edge tab.
- Width is remembered per mode.

**Cost:** every Inspector section needs a row layout for each width. Preview needs real layer thumbnails, which is the hardest part. Smaller version: all three right panel layouts, and only List and Icons on the left.
