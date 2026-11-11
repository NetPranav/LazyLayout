# I1 rollout: Phosphor Light everywhere (2026-11-10)

User approved the Position trial, then asked for the full rollout. Static icons only, no new dependency.

## Done
- `Icon` resolves every passed component (lucide or local forwardRef glyph) by displayName through `src/editor/components/icons/phosphorMap.ts` (166 names, 155 Phosphor glyphs in `phosphorGlyphs.ts`). Unmapped icons fall back to their own glyph and `console.warn` once in development. Sweep of /editor (design, motion, code, menus, context menus, Spotlight, Insert) and every /design-system page: zero warnings.
- Optical scale per glyph (see icon map). Position verified: align row 12.25 -> 14.33 px, rotation 11.15 -> 11.82 px.
- Generic icon-only hover: `.ll-ib > svg` scale 1.06, transform only, `--ll-dur-pop`/`--ll-ease-pop`, off under reduced motion (`phosphor-hover.css`). `IconButton` and `Button iconOnly` got the `ll-ib` class (it already existed on many bespoke icon buttons). Position trial hovers kept.
- `TextFormatBar` inline italic/underline/strike/link SVGs now use `PhosphorIcon`.
- Active states: Light everywhere (the prototype shows no filled glyphs).

## Not done / for the owner of those files
- `ViewOptionsPopover.tsx` lines 393 and 406 render lucide `Focus` and `Globe` directly (not through `Icon`): change to `<Icon icon={Focus} size={16} />` and `<Icon icon={Globe} size={16} />`.
- `FramePresetsPanel.tsx` lines 36 and 41 have two local stroke SVGs (not through `Icon`).
- Local copies in `ColorPickerIcons.tsx`, `pageSelectorIcons.tsx` and `canvas-chrome/glyphs.ts` kept: they resolve through displayName and still work; removing them touches files in use. `panels/timeline/icons.tsx` not edited (its names are mapped).
- Design system icons page (`IconDemos.tsx`) not built in this pass.
- Corner-radius and text-wrap have no Phosphor equal; closest matches used.

Screenshots: `screenshots/phosphor-all/` (paper and dark, 1440x900: design, motion, code, ship menu, design-system, layer and canvas menus, Spotlight, Insert).
