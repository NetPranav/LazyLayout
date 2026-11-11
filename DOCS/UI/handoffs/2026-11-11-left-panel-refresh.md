# Left panel refresh on every edit (2026-11-11)

Cause: `LayersTree.tsx` had a "cascade rows" effect with `[layers]` as its dependency. `layers` (the tree built by `buildLayerTree`) is a new array on every document change, so every edit (opacity, fill, X, undo) re-ran the 16-row spring pop-in on all rows, which read as the panel refreshing. Rows were never remounted (keys are layer ids); the scroll container and expanded state were also stable.

Fix: the effect now depends on the ordered list of visible row ids. It runs on first paint and page switch (whole list, as before) and, when a layer is added or restored, only for the new rows. Plain edits no longer animate anything.

Measured with headless Chromium on /editor (rows tagged, MutationObserver on #p-layers, Element.animate counted inside #p-layers). `anims` = animations started in the tree, per action.

| action | anims before | anims after |
|---|---|---|
| select | 0 | 0 |
| opacity | 5 | 0 |
| fill hex | 5 | 0 |
| X position | 5 | 0 |
| rename | 6 | 1 (the name settle pop, intended) |
| hide layer | 6 | 1 (eye blink, intended) |
| show layer | 6 | 1 (eye blink, intended) |
| add layer (Ctrl+D) | 6 | 1 (the new row only) |
| undo | 5 | 0 |
| redo | 6 | 1 (the restored row only) |

In all runs, before and after: tree container identical, no existing row remounted, scrollTop unchanged, no added/removed row nodes except the genuinely new/removed row (and the rename input swap).

Not verified: drag-move of a layer on the canvas (no canvas DOM node with data-layer-id to drag in the probe; the X edit exercises the same document change); scroll position with a long tree (the demo document has only 5 rows).
