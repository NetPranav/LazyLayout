### Phase 122 (Image adjustments & filters): non-destructive adjustments on images and image fills

#### Added
- **A picture's look** (`core/paint/imageLook.ts`):
  - a simple tone curve;
  - a gradient map (duotone is two stops);
  - sharpen and blur;
  - **show original**, which keeps every setting and draws none.
- All of it is drawn as one SVG filter after FigCraft's seven adjustments, on image fills (the paint's `look`) and on Image layers (new properties `media.adjust` and `media.look`). The picture's file is never changed.
- Command `image.adjust` and seven look presets: two duotones, sepia, punchy, matte, crisp and soft focus.
- In the inspector, the image section and the image fill's popover gain an **Adjust** group:
  - show original and a preset;
  - the seven adjustment sliders and three curve sliders;
  - a duotone with its two colours;
  - sharpen and blur.
- `referenceImage`: the same filter worked out pixel by pixel.
- `imageLook.test.ts` (6 tests) and `tests/e2e/image-adjust.spec.ts`.

#### Not done
- The gradient map takes its stops from presets; the inspector edits two-stop duotones only.
- Firefox and WebKit not run locally.
