### Task E (No "ghost frame", and Desktop / Tablet / Mobile presets on user frames)

Eliminates the artboard page sheet "ghost frame" behind user-created frames on the canvas, drawing the page sheet only when loose shapes/text/images sit directly on the page, and wires the Desktop, Tablet, and Mobile viewport buttons and frame dropdowns directly into the core breakpoint system.

#### Added
- Pure logic helper `shouldDrawPageSheet` in `src/editor/stage/pageSheet.ts` with unit test suite in `src/editor/stage/__tests__/pageSheet.test.ts`.
- Pure preset/breakpoint synchronization logic in `src/editor/stage/presetBreakpoints.ts` mapping Desktop (base 1440), Tablet (768), and Mobile (375), with unit tests in `src/editor/stage/__tests__/presetBreakpoints.test.ts`.
- Segmented Desktop / Tablet / Mobile buttons in `TopBar.tsx` center column during Design mode, synchronized with `useBreakpointStore` and `executeStagePreset`.
- Frame preset commands in `ModeTabs.tsx` dropdown menu to trigger `executeStagePreset`.
- Playwright E2E spec in `tests/e2e/new-ui-frames-presets.spec.ts` covering bare canvas on frame creation, loose layer sheet display, Mobile click frame creation, Tablet override persistence, and Backspace frame deletion.

#### Fixed
- Removed ghost white artboard sheet when frames exist on empty canvas; page sheet renders transparently without shadows or borders when all direct children are container frames or when empty.
- Updated `targetFrameId()` in `src/core/breakpoints/breakpointOps.ts` and `isResponsiveFrame()` in `src/core/breakpoints/breakpoints.ts` to identify child container frames of active page roots as responsive target frames.
- Connected canvas viewport preset changes in `Stage.tsx`, `Artboard.tsx`, and `useEditorActions.ts` to `executeStagePreset`, allowing breakpoint overrides to be captured and rendered at device widths.
- Enabled `Backspace` key handling alongside `Delete` in `useEditorActions.ts` keyboard listener to delete selected frames and elements.
