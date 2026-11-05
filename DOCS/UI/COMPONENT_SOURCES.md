# Component sources

Every third-party component used in the new UI. Add a row before finishing the task. The license must allow this use.

| Component | Site and URL | License | Copied to | What we changed |
|---|---|---|---|---|
| Nook animation engine (`springEase`, `springAnim`, motion presets, FLIP, kicks, Surf) | Nook, the user's own product (`E:\Projects\Products\nook`, `src/lib/motion.ts`, `src/lib/motionPresets.ts`, `src/features/island/engine/`) | own code | `src/editor/motion/` (`spring.ts`, `presets.ts`, `loop.ts`, `ease.ts`, `feel.ts`, `flip.ts`, `surface.ts`, `index.ts`) | Ported exact Nook mass-1 physics, frame loop, and presets to TypeScript; reduced-motion 120ms fade fallback; credited on design system motion page |
| Lucide Icons | Lucide (https://lucide.dev) | ISC | `src/editor/components/Icon.tsx` | Standardized wrapper enforcing `strokeWidth={1.5}` and token-based sizes across all UI and inspector panels |
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
