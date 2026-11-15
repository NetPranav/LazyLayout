### Phase 126 (Icons, illustrations & stock media)

#### Added
- **Icons & Photos** (the toolbar's Image button, or "Icons & Photos…"):
  - search Lucide's ~4,100 icons and insert one as editable vector layers, recoloured like any shape;
  - search openly licensed photos on Openverse (no key) and insert one as an image layer named after its title.
- Every inserted icon and photo goes into the asset store with **`source`**: kind, provider, id, title, page, licence, licence link, author, and the credit line. Its layers keep `asset.source`.
- An icon's licence is exact: ISC, or "ISC and MIT (Feather)" for the 115 icons Lucide took from Feather.
- `DOCS/INITIAL/LICENSES.md` records Lucide (ISC; MIT for the Feather-derived icons) and Openverse (each photo's own licence).
- `mediaLibrary.test.ts` (5 tests) and `tests/e2e/icons-photos.spec.ts` (Openverse answered by a recorded reply).

#### Fixed
- An icon imported as an SVG lost its stroke width (the importer doesn't inherit it from the root `<svg>`). The width is written on each shape now.

#### Not done
- Credit lines are not yet shown in exported pages (Phase 130).
- One icon set and one photo provider; no illustration sets yet.
- Firefox and WebKit not run locally.
