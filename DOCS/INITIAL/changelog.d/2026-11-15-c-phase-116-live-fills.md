### Phase 116 (Live fills): a frame or component as a fill

#### Added
- A `live` paint: another frame or component drawn inside a shape, following every edit to it, with scale, offset and tiling. Drawn as a clone with prefixed ids, so selecting and measuring are unaffected; self-references are refused.
- `SubtreeContext` (`core/render/layersContext.ts`) and `cloneSubtree` (`core/render/liveFill.ts`).
- Live in the fill popover; `liveFill.test.ts` and `tests/e2e/live-fills.spec.ts`.

#### Not done
- Live fills on frames (CSS backgrounds); undistorted live fills on path layers; Firefox and WebKit not run.
