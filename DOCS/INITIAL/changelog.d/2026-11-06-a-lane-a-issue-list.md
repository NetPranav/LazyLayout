### Fixed (Lane A issue list, LA-001 to LA-035, first batch)
- Stacking: the canvas paints in document order, so Arrange (Send to back and the rest) changes what is on top (LA-012).
- Frames: a frame can be drawn anywhere, layers drawn inside a frame become its children, and moving a frame moves them (LA-013, LA-031, LA-033).
- Align uses the frame, or the 1440 x 900 page, as its bounds (LA-001).
- Text: Wrap (No wrap, Pre, Normal) and Ellipsis are honoured, Font loading is stored, capitalisation shows while editing (LA-002, LA-004, LA-008).
- Transforms: scale, skew and 3D turn show on the canvas; Transform origin is a real property and stays chosen (LA-014, LA-016).
- Stroke: one-side strokes, colour pickers on Fill, Stroke and Shadow swatches, Fill opacity on text and boxes (LA-005, LA-007, LA-023, LA-024, LA-027).
- Lines and dividers: dash style, cap, thickness, colour and orientation write what the engine draws (LA-025, LA-026).
- Canvas: the drawing preview matches the shape, resize handles are larger on screen with a bigger grab area, Shift+wheel and right-button drag pan, scrubbing works while a field is focused, cursor style shows over a layer, tooltips on Blend, Cursor, Wrap, Overflow, Sizing, Font loading (LA-011, LA-015, LA-021, LA-022, LA-030, LA-032).
- Engine: new properties `transform.origin`, `layout.marginLeft`, `layout.marginRight`, `typography.fontLoading`.
