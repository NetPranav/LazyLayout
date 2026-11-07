### Task A (Text with image or gradient fill): background-clip text effect

Allows text layers to accept fill lists (`paint.fills`) with image and gradient paints, rendering the text letters with `background-image`, `background-clip: text`, and transparent text color while preserving solid color fallback via `typography.color`.

#### Added
- Legal scope for `paint.fills` on `text` archetype in `properties.ts`.
- `useTextFillStyle` hook in `paintStyle.tsx` and integration into `Text.tsx` archetype render to apply text clipping, background images, and transparent fill colors.
- Image and gradient fill support in `FillSection` for text layers with single-step undo and asset resolution.
- Export pipeline support preserving `-webkit-background-clip: text` and `-webkit-text-fill-color: transparent` in static export and layer code views.
- Unit tests in `src/core/export/site/__tests__/textFill.test.ts` and Playwright E2E spec in `tests/e2e/new-ui-text-fill.spec.ts`.
