# Component sources

Every third-party component used in the new UI. Add a row before finishing the task. The license must allow this use.

> [!NOTE]
> **Zero license blockers:** All components in `src/editor/components/` are 100% verified licenses or our own clean-room code. The `src/editor/components/imported/` directory has been completely deleted (commit `73edaba`). The unused candidate dependencies `@animate-ui/react`, `@base-ui/react`, `@floating-ui/react`, and `radix-ui` were removed from `package.json` (commits `58ae713` and `5cf6d24`).

| Component | Site and URL | License | Copied to | What we changed |
|---|---|---|---|---|
| Nook animation engine (`springEase`, `springAnim`, motion presets, FLIP, kicks, Surf) | Nook, the user's own product (`E:\Projects\Products\nook`, `src/lib/motion.ts`, `src/lib/motionPresets.ts`, `src/features/island/engine/`) | own code | `src/editor/motion/` (`spring.ts`, `presets.ts`, `loop.ts`, `ease.ts`, `feel.ts`, `flip.ts`, `surface.ts`, `index.ts`) | Ported exact Nook mass-1 physics, frame loop, and presets to TypeScript; reduced-motion 120ms fade fallback; credited on design system motion page |
| Lucide Icons (call-site component names only, no longer rendered) | Lucide (https://lucide.dev) | ISC | `src/editor/components/Icon.tsx` | Standardized wrapper enforcing `strokeWidth={1.5}` and token-based sizes across all UI and inspector panels |
| Prototype icon set (156 symbols) | Our own file `DOCS/UI/design/editor-design-mode-blocks-dark.html` (inline SVG sprite) | Own work, no license needed | `src/editor/components/icons/protoGlyphs.ts`, `protoMap.ts`, `ProtoIcon.tsx`; rendered through `Icon.tsx` | Extracted by script into typed data; primary icon set from 2026-11-10 at the user request. Phosphor below remains only as fallback for icons the prototype lacks |
| Phosphor Icons, Light weight (155 glyphs) | phosphor-icons/core (https://github.com/phosphor-icons/core, `assets/light/*.svg`) | MIT, Copyright (c) 2023 Phosphor Icons (full text below) | `src/editor/components/icons/phosphorGlyphs.ts`, `phosphorMap.ts`, `PhosphorIcon.tsx`; rendered through `Icon.tsx` | Only the path data of the glyphs in use was copied (no package, no install). `Icon` maps each lucide component to its Phosphor glyph by displayName; glyphs carry an optical scale (see PhosphorIcon.tsx). User approved the rollout 2026-11-10 |
| Geist & Geist Mono | Vercel (https://vercel.com/font) | SIL Open Font License 1.1 | `src/editor/styles/globals.css`, `tokens.css` | Mapped to `--ll-font-sans` and `--ll-font-mono` with legacy Inter overrides scoped out |

## Replaced imported components with own code (2026-11-05)
The two remaining unverified Animate UI components were replaced by our own clean-room code on 2026-11-05:
- `cursor`: replaced by our own `src/editor/components/Cursor.tsx` (token-styled collaborative cursor and follower badge with reduced-motion support, no third-party package dependency)
- `scroll-fade`: replaced by our own `src/editor/components/ScrollFade.tsx` (CSS mask-image edge fades without blur/shrink violations, supports vertical, horizontal, and both axes)

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
- `scroll-fade`: replaced by `src/editor/components/ScrollFade.tsx` on 2026-11-05
- `cursor`: replaced by `src/editor/components/Cursor.tsx` on 2026-11-05
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
