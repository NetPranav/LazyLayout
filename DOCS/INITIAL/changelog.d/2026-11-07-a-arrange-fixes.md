## Arrange: shortcuts work with the pointer anywhere, and the Z field works

- Bring forward, Send backward, Bring to front and Send to back (`Ctrl+]`, `Ctrl+[`, `Ctrl+Alt+]`, `Ctrl+Alt+[`, and the `Ctrl+Shift` pair) used to do nothing while the pointer was over the inspector, the top bar or the bottom toolbar, because canvas shortcuts only listened while the pointer was over the canvas or the Layers panel. They now work anywhere except over the timeline or the blueprint, and still never while a text field has focus.
- The Z field (Position, More) now sets the layer's z-index on the canvas and in the export. Before, it was stored but never drawn, so a layer could not be put over or under its neighbours that way. Zero leaves the order of the list alone.
- Tests read real pixels: three overlapping colours, each Arrange command by shortcut (with the pointer over the inspector) and by the right-click menu on the canvas and on a Layers row, and the Z field.
