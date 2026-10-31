# Handoff: Neutral palette tokens

- **Date / time:** 2026-10-30 22:00 IST
- **Worker:** Antigravity worker
- **Branch:** ui/redesign
- **Page / phase:** Global / Tokens setup (pre-Phase 1)
- **Task given by:** `DOCS/UI/tasks/2026-10-30-neutral-tokens.md` ("Add the approved neutral ramp from PALETTE.md to src/editor/styles/tokens.css, and point the existing semantic tokens at it, so the whole editor moves to the soft-gray look without touching any component.")

## What changed
- `src/editor/styles/tokens.css`: Added primitive neutral ramp tokens (`--neutral-0` through `--neutral-1000`) approved by user in `PALETTE.md`; repointed semantic surface, border, text, code, and shadow tokens to the ramp; removed surface translucencies.
- `DOCS/UI/PALETTE.md`: Recorded final neutral token names and confirmed status as active in `src/editor/styles/tokens.css`.
- `DOCS/UI/INTEGRATION.md`: Added Section 6 entry documenting all added, changed, and preserved tokens for Lanes A and B.

## Design decisions made (by the user)
- Neutral ramp approved by user (2026-10-30):
  - Raised surface: `--neutral-0` (`#FFFFFF`)
  - Floating bar: `--neutral-50` (`#F1F1F1`)
  - Canvas: `--neutral-100` (`#DFDFDF`)
  - Panels, side rails: `--neutral-200` (`#C8C8C8`)
  - Backdrop: `--neutral-400` (`#929292`)
  - Strong dark: `--neutral-800` (`#464646`)
  - Black: `--neutral-1000` (`#000000`)
- Accent and state colors were left undecided and untouched.

## Tokens / palette touched
- Primitive ramp tokens added from `ref-01-work-os.png` (`PALETTE.md`):
  - `--neutral-0`: `#FFFFFF`
  - `--neutral-50`: `#F1F1F1`
  - `--neutral-100`: `#DFDFDF`
  - `--neutral-200`: `#C8C8C8`
  - `--neutral-400`: `#929292`
  - `--neutral-800`: `#464646`
  - `--neutral-1000`: `#000000`
- Semantic tokens repointed to ramp:
  - Canvas: `--canvas-bg`, `--canvas-dot-color`
  - Surfaces: `--surface-panel`, `--surface-panel-solid`, `--surface-panel-hover`, `--surface-panel-active`, `--surface-panel-selected`, `--surface-dock-bar`, `--surface-toolbar`, `--surface-statusbar`, `--surface-overlay`, `--surface-tooltip`, `--surface-disabled`
  - Code: `--surface-code`, `--surface-code-toolbar`, `--surface-code-statusbar`, `--surface-code-hover`, `--text-code`, `--text-code-muted`, `--border-code`
  - Borders: `--border-subtle`, `--border-default`, `--border-strong`, `--border-disabled`
  - Typography: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-tertiary`, `--text-disabled`, `--text-inverse`
  - Wire: `--wire-exec`
  - Elevation: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-floating-dock`, `--shadow-divider`

## Integration notes added
- Added entry in `DOCS/UI/INTEGRATION.md` under Section 6: "Neutral ramp primitive tokens and semantic token repointing".

## Not done / blocked
- None. Task completed fully within specified scope.

## Questions for the user
- **Muted & Tertiary Text Gray:** Per task instruction 3 ("No text token lighter than about #5A5A5A on the canvas. If a muted or tertiary text token needs a gray that is not on the ramp, do not invent one: map it to `--neutral-800` and list it in the handoff as a question"), `--text-muted`, `--text-tertiary`, and `--text-disabled` were mapped to `var(--neutral-800)` (`#464646`). Because `--neutral-400` (`#929292`) has only ~2.3:1 contrast against canvas `#DFDFDF`, does the user want to add a `--neutral-600` step (e.g., `#5A5A5A` or `#606060`, ~5.2:1 contrast) to the ramp for secondary/tertiary text, or keep `--neutral-800` for all non-primary text?
- **Canvas Dot Grid Contrast:** `--canvas-dot-color` was mapped to `var(--neutral-400)` (`#929292`) which yields subtle but distinct 1.5px grid dots on `#DFDFDF` canvas (2.4:1 contrast). Does the user prefer this, or a softer dot grid using `var(--neutral-200)` (`#C8C8C8`, ~1.3:1 contrast)?
- **Statusbar Surface:** `--surface-statusbar` was mapped to `var(--neutral-50)` (`#F1F1F1`) matching the floating bar aesthetic of the toolbar and dock bar. Does the user prefer `--neutral-50` or raised white `--neutral-0` (`#FFFFFF`) for the bottom statusbar?

## Phase checks
- typecheck: not run (worker task mid-phase; checks run at end of phase per UI_RULES §7)
- lint: not run
- build: not run
- Playwright: not run

## Screenshots
- none (no headless browser run needed; token-only change mid-phase)

## Orchestrator sign-off
- [ ] Signed off   - [ ] Sent back (reason):
