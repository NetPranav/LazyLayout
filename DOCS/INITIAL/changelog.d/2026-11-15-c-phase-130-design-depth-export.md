### Phase 130 (Design-depth export)

#### Added
- `core/export/site/designDepth.ts`: export **warnings** for what Stage 3 can't draw exactly in an exported page (only when used), and **photo credits** (a CREDITS.md file in the exported site, plus a credits line on plain HTML pages).
- `tests/export-harness/design-depth-fixture.ts`: one page using every Stage 3 feature. The export harness builds it for Next.js and Vite and checks its plain HTML.
- `tests/e2e/design-depth-export.spec.ts`, the HTML parity gate: canvas against export at 1440, 1024, 768, 480 and 375 px, 0.00% different.
- `designDepth.test.ts` (3 tests).

#### Not done
- Animated text-path starts and camera moves are exported at rest.
- Firefox and WebKit not run locally.
