# Component sources

Every third-party component used in the new UI. Add a row before finishing the task. The license must allow this use.

| Component | Site and URL | License | Copied to | What we changed |
|---|---|---|---|---|
| SquishSwitch | React Bits (https://reactbits.dev) | unknown, unverified | `src/editor/components/imported/squish-switch/SquishSwitch.tsx` | no changes |
| ScrubField | React Bits (https://reactbits.dev) | unknown, unverified | `src/editor/components/imported/scrub-field/ScrubField.tsx`, `ScrubField.css` | no changes |
| ElasticSlider | React Bits (https://reactbits.dev) | unknown, unverified | `src/editor/components/imported/elastic-slider/ElasticSlider.tsx`, `ElasticSlider.css` | no changes |
| Cursor | Animate UI (https://animate-ui.com/docs/primitives/animate-ui/cursor) | unknown, unverified | `src/editor/components/imported/cursor/index.ts` | no changes |
| Avatar Group | Animate UI (https://animate-ui.com/docs/primitives/animate-ui/avatar-group) | unknown, unverified | `src/editor/components/imported/avatar-group/index.ts` | no changes |
| Tooltip | Animate UI (https://animate-ui.com/docs/primitives/animate-ui/tooltip) | unknown, unverified | `src/editor/components/imported/tooltip/index.ts` | no changes |
| Select | Base UI / Animate UI (https://animate-ui.com/docs/primitives/base-ui/select) | unknown, unverified | `src/editor/components/imported/select/index.ts` | no changes |
| Menubar | Base UI / Animate UI (https://animate-ui.com/docs/primitives/base-ui/menubar) | unknown, unverified | `src/editor/components/imported/menubar/index.ts` | no changes |
| Dropdown Menu | Base UI / Animate UI (https://animate-ui.com/docs/primitives/base-ui/dropdown-menu) | unknown, unverified | `src/editor/components/imported/dropdown-menu/index.ts` | no changes |
| Context Menu | Base UI / Animate UI (https://animate-ui.com/docs/primitives/base-ui/context-menu) | unknown, unverified | `src/editor/components/imported/context-menu/index.ts` | no changes |
| Scroll Fade | Animate UI (https://animate-ui.com/docs/primitives/animate-ui/scroll-fade) | unknown, unverified | `src/editor/components/imported/scroll-fade/index.ts` | no changes |
| File Tree | Unlumen UI (https://unlumen.com/docs/components/file-tree) | unknown, unverified | `src/editor/components/imported/unlumen-ui/file-tree.tsx`, `src/editor/components/imported/file-tree/index.ts` | inlined `cn` helper because `@/lib/utils` is not present; no other changes |
| Nook animation engine (`springEase`, `springAnim`, motion presets, FLIP, kicks, Surf) | Nook, the user's own product (`E:\Projects\Products\nook`, `src/lib/motion.ts`, `src/lib/motionPresets.ts`, `src/features/island/engine/`) | own code | `src/editor/motion/` (`spring.ts`, `presets.ts`, `loop.ts`, `ease.ts`, `feel.ts`, `flip.ts`, `surface.ts`, `index.ts`) | Ported exact Nook mass-1 physics, frame loop, and presets to TypeScript; reduced-motion 120ms fade fallback; credited on design system motion page |
