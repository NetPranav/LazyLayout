# Component sources

Every third-party component used in the new UI. Add a row before finishing the task. The license must allow this use.

> [!WARNING]
> **Unverified licenses (blocker before merge):** `Cursor` and `Scroll Fade` have unknown / unverified licenses from Animate UI. `UI_RULES.md` §5 explicitly states: *"License unclear? Pick another component."* These two components MUST be replaced or their licenses confirmed before merging `ui/redesign` to `main`.

| Component | Site and URL | License | Copied to | What we changed |
|---|---|---|---|---|
| Cursor | Animate UI (https://animate-ui.com/docs/primitives/animate-ui/cursor) | unknown, unverified (MUST REPLACE OR CONFIRM) | `src/editor/components/imported/cursor/index.ts` | kept as-is; pending license verification or replacement |
| Scroll Fade | Animate UI (https://animate-ui.com/docs/primitives/animate-ui/scroll-fade) | unknown, unverified (MUST REPLACE OR CONFIRM) | `src/editor/components/imported/scroll-fade/index.ts` | kept as-is; pending license verification or replacement |
| Nook animation engine (`springEase`, `springAnim`, motion presets, FLIP, kicks, Surf) | Nook, the user's own product (`E:\Projects\Products\nook`, `src/lib/motion.ts`, `src/lib/motionPresets.ts`, `src/features/island/engine/`) | own code | `src/editor/motion/` (`spring.ts`, `presets.ts`, `loop.ts`, `ease.ts`, `feel.ts`, `flip.ts`, `surface.ts`, `index.ts`) | Ported exact Nook mass-1 physics, frame loop, and presets to TypeScript; reduced-motion 120ms fade fallback; credited on design system motion page |
| Lucide Icons (call-site component names only, no longer rendered) | Lucide (https://lucide.dev) | ISC | `src/editor/components/Icon.tsx` | Standardized wrapper enforcing `strokeWidth={1.5}` and token-based sizes across all UI and inspector panels |
| Phosphor Icons, Light weight (155 glyphs) | phosphor-icons/core (https://github.com/phosphor-icons/core, `assets/light/*.svg`) | MIT, Copyright (c) 2023 Phosphor Icons (full text below) | `src/editor/components/icons/phosphorGlyphs.ts`, `phosphorMap.ts`, `PhosphorIcon.tsx`; rendered through `Icon.tsx` | Only the path data of the glyphs in use was copied (no package, no install). `Icon` maps each lucide component to its Phosphor glyph by displayName; glyphs carry an optical scale (see PhosphorIcon.tsx). User approved the rollout 2026-11-10 |
| Geist & Geist Mono | Vercel (https://vercel.com/font) | SIL Open Font License 1.1 | `src/editor/styles/globals.css`, `tokens.css` | Mapped to `--ll-font-sans` and `--ll-font-mono` with legacy Inter overrides scoped out |

## Superseded and removed imported components (2026-11-03)
The following imported components were superseded or deleted from `src/editor/components/imported/`:
- `elastic-slider`: dropped on Retry 1 due to unverified license and non-token rules
- `squish-switch`: replaced by `src/editor/components/Toggle.tsx`
- `scrub-field`: replaced by `src/editor/components/NumberField.tsx`
- `avatar-group`: replaced by `src/editor/components/Avatar.tsx` (`AvatarStack`)
- `tooltip`: replaced by `src/editor/components/Tooltip.tsx`
- `select`: replaced by `src/editor/components/Select.tsx`
- `menubar`: replaced by `src/editor/components/Menu.tsx`
- `dropdown-menu`: replaced by `src/editor/components/Menu.tsx`
- `context-menu`: replaced by `src/editor/components/ContextMenu.tsx`
- `scroll-fade`: kept in `src/editor/components/imported/scroll-fade/`
- `file-tree` and `unlumen-ui`: replaced by `src/editor/components/TreeRow.tsx`

## Phosphor Icons license (MIT)

```
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
