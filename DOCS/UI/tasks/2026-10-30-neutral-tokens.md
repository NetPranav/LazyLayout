# Worker task: Neutral palette tokens

- **Scope:** shared design tokens, no page work
- **Given by:** the user ("run workers to update tokens"). This is the one task allowed to edit `src/editor/styles/tokens.css`.
- **Run this task BEFORE `2026-10-30-top-bar.md`.**

Read first: `AGENTS.md`, `DOCS/UI/UI_RULES.md`, `DOCS/UI/PALETTE.md`, `DOCS/UI/INTEGRATION.md`.

## Goal

Add the approved neutral ramp from `PALETTE.md` to `src/editor/styles/tokens.css`, and point the existing semantic tokens at it, so the whole editor moves to the soft-gray look without touching any component.

## Instructions

1. Add primitive tokens for the approved ramp: `--neutral-0` `#FFFFFF`, `--neutral-50` `#F1F1F1`, `--neutral-100` `#DFDFDF`, `--neutral-200` `#C8C8C8`, `--neutral-400` `#929292`, `--neutral-800` `#464646`, `--neutral-1000` `#000000`. Use exactly these values. Do not invent other colors.
2. Repoint the existing semantic tokens (surfaces, borders, text, hover / active states, status bar, toolbar, dock bar) to the ramp where a ramp step fits. Layers must be separable: panels `#C8C8C8` against the canvas `#DFDFDF` are only 1.3:1, so use hairline border tokens and shadow tokens to separate them.
3. **Text contrast:** primary text uses `--neutral-1000`, secondary text uses `--neutral-800`. No text token lighter than about `#5A5A5A` on the canvas. If a muted or tertiary text token needs a gray that is not on the ramp, **do not invent one**: map it to `--neutral-800` and list it in the handoff as a question.
4. **No translucency:** replace translucent `rgba(...)` surface tokens (panel, dock bar, toolbar, code toolbar) with solid ramp values. Overlay and scrim tokens may stay translucent (they dim content).
5. **Leave unchanged:** the accent tokens (`--accent-*`, `--text-accent`) and all state colors (error, warning, success). They are not decided. Do not add a dark theme.
6. Keep every existing token name working. Do not rename or remove any. New tokens are additions. If you must change a value that changes behaviour (not just color), note it in `INTEGRATION.md` section 6.
7. Update the token name column in `DOCS/UI/PALETTE.md` if you used different step names.

## Files you may touch

- `src/editor/styles/tokens.css`
- `DOCS/UI/PALETTE.md`, `DOCS/UI/INTEGRATION.md`

Nothing else. Do not edit components or other CSS files. Do not edit `src/core`, `src/compiler`, `src/runtime`, `src/ai` or config files.

## Done means

- Hex values appear **only** in the new primitive ramp tokens (every other token references them with `var(...)`), except accent and state colors that you left as they were.
- `INTEGRATION.md` section 6 lists the new tokens, every existing token whose value changed, and any old token that A / B code may still reference.
- Handoff written from `TEMPLATE.md` in `DOCS/UI/handoffs/`, listing any token you could not map and why.
- Do not run phase checks. Do not commit. Do not open a browser by hand. If you take a Playwright screenshot to look at the result, save it under `DOCS/UI/handoffs/screenshots/tokens/`.
