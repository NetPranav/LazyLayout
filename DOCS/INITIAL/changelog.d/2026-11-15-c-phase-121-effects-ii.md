### Phase 121 (Layer effects II): glow, progressive blur, grain and frosted glass

#### Added
- **Outer and inner glow**: a shadow with no offset, marked `glow` in `paint.shadows`, so it draws exactly as a shadow does.
- In the new editor's Effects rows:
  - Outer glow, Inner glow and Grain;
  - a **Progressive** switch on layer and background blurs, with a start amount and a direction (stronger at the top, bottom, left or right);
  - a **Frosted glass** preset (command `effects.frostedGlass`): a background blur, a light tint, an edge light and a little grain.
- **Fallback without `backdrop-filter`**: a frame that blurs what is behind it carries a tint at least 85% opaque, and an `@supports not` rule swaps the tint in.
- `core/paint/effectsII.ts`, `effectsII.test.ts` (5 tests), `effectsModel.test.ts` (1 test) and `tests/e2e/effects-ii.spec.ts`.

#### Not done
- The fallback is on frames only, not on shapes or text.
- Firefox and WebKit not run locally.
- Real refraction waits for backdrop sampling (Stage 4).
