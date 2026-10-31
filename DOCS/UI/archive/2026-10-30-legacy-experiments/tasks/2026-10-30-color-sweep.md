# Worker task: Color sweep (make the whole editor match the reference image)

- **Scope:** colors only, across all editor CSS. No layout, spacing, copy or component changes.
- **Given by:** the user: "fix all the color things ... make the ui colors exact as the ref image". Run **after** `2026-10-30-neutral-tokens.md` and `2026-10-30-top-bar.md`.
- **Reference:** `DOCS/UI/palette-refs/ref-01-work-os.png` and `DOCS/UI/PALETTE.md`.

Read first: `AGENTS.md`, `DOCS/UI/UI_RULES.md`, `DOCS/UI/PALETTE.md`, `DOCS/UI/INTEGRATION.md`, and the tokens handoff in `DOCS/UI/handoffs/`.

## What the user saw

The editor still shows the teal accent everywhere (active buttons, toggles, chips, selected rows, the focus ring), a dark canvas backdrop, hardcoded slate and indigo colors, and a leftover tint here and there. The reference image is soft gray with white raised surfaces, **black** for primary and active controls, and no teal.

## Instructions

1. **Replace the teal accent with the reference look.** In the reference, active and primary controls are solid black (`--neutral-1000`) with white text. Selected rows and chips use a light neutral fill (`--neutral-50` or `--neutral-100`) with a dark text color and a hairline border. Toggles on = black track, off = a mid neutral. Update the accent tokens in `src/editor/styles/tokens.css` so `--accent-primary` is `--neutral-1000`, `--accent-primary-hover` is `--neutral-800`, `--accent-primary-light` is `--neutral-50`, `--text-accent` is `--neutral-1000`. Keep the token names. Do **not** use orange anywhere: the accent color is not decided and the user has not approved orange.
2. **Remove every hardcoded color from `src/editor/styles/*.css`** (hex, `rgb`, `rgba`, `hsl`). Replace each with an existing token. If no token fits, map to the nearest ramp token. Do not invent new colors and do not add gray steps outside the approved ramp. Translucent `rgba` used for **overlays, scrims and shadows** may use black or white at an alpha; add a shadow or scrim token if one is missing.
3. **Leave semantic state colors alone** (error, warning, success, the wire data-type colors, selection of the user's own design content such as the stage's content colors). List any you were unsure about in the handoff.
4. **Canvas backdrops** (`.whiteboard-stage[data-backdrop=...]` in `src/editor/styles/whiteboard.css`): "light" is the theme background, now the canvas gray `#DFDFDF`. "dark" must use a ramp token (`--neutral-1000` or `--neutral-800`), not `#1b1c22`. "checker" uses `--neutral-0` and `--neutral-100`. The grid style default is now "none" (no dots), already changed by Claude in `src/core/types/environment.ts`: do not touch `src/core`.
5. **Focus ring:** keep a clearly visible focus ring that meets contrast on the gray canvas (black, 2px). Define it through the existing focus tokens.
6. **Check contrast:** text on every surface at least 4.5:1. Panels (`#C8C8C8`) and the canvas (`#DFDFDF`) are 1.3:1 apart, so make sure panel edges have a hairline border token or shadow.
7. **TSX inline colors:** list every hardcoded color you find in `src/editor/**/*.tsx` and `src/editor/**/*.ts` in the handoff (file, line, value). Fix the ones that are plain UI chrome. Do **not** touch colors that are user content (design layers, paint, color pickers, theme palette previews).
8. Log every changed or added token in `INTEGRATION.md` section 6.

## Files you may touch

- `src/editor/styles/*.css`, including `tokens.css`
- Inline UI-chrome colors in `src/editor/**/*.tsx`
- `DOCS/UI/PALETTE.md`, `DOCS/UI/INTEGRATION.md`

Off limits: `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**`, config files.

## Screenshots (Playwright, headless only)

Capture the editor at 1440 wide: default view, the right panel open on Design, a menu open, a toggle on and off. Save to `DOCS/UI/handoffs/screenshots/color-sweep/`. Compare with the reference image yourself and fix obvious mismatches before finishing.

## Done means

- A grep for hex or `rgb(a)` colors in `src/editor/styles/*.css` finds them **only** in the ramp primitives in `tokens.css` (and any approved state colors you kept).
- Handoff from `TEMPLATE.md` in `DOCS/UI/handoffs/`, with the TSX color list and your uncertain mappings.
- Do not run phase checks. Do not commit. No browser by hand.
