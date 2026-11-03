### Phase 44 (Breakpoint canvas)

See Desktop, Tablet and Mobile of one page at once.

#### Added
- "All" in the breakpoint bar draws every breakpoint of a responsive page side by side: the one you are editing is the real frame, the others are live previews beneath it at their own widths.
- Selecting a layer outlines it in every view; clicking a layer in a preview selects it and switches to that breakpoint.
- Drag the right edge of any view to change that breakpoint's width; the page reflows live (one undo step).
- `StageHost` `breakpointId` and `ghost`; `useLayerAt`, `useDocumentAt`; `src/editor/canvas/BreakpointViews.tsx`.

#### Not done (added 2026-11-03)
- WebKit does not hold the frame rate while a breakpoint edge is dragged on a 200-layer page: p90 about 42 ms on a Mac and 300-320 ms on the CI runner. Its test ceiling only catches a collapse.
