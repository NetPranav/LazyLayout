### Phase 89 (Page transitions): Preview moves between pages with a fade, slide, push or zoom, and shared elements travel

A page says how it is entered; a layer given the same shared name on two pages travels from one to the other. The browser's View Transitions API draws it where it exists; a Web Animations fallback draws the same recipe elsewhere. The phase stays in progress: Phase 88 is, and the new editor has no Preview navigation between pages yet.

#### Added
- `pageTransitions.ts` in `src/core/pages`: the recipe (`sampleTransition`), shared-element pairing, the style sheet for the native path, `runPageTransition`, `playFallback`.
- Properties `pageTransition.type`, `pageTransition.duration`, `sharedElement.id`. Commands `page.setTransition`, `layer.setSharedElement`.
- `previewShow` and `previewStep`: every way Preview goes to a page (links, routes, Back, Forward) now runs the transition.
- A **Page transition** section in the inspector (on a page: **Entering**, **Time**; on a layer in a page: **Shared name**).
- 11 unit tests and one browser test.

#### Changed (shared hot spots)
- `src/core/document/properties.ts`: three new paths. No schema version change.
- `src/core/pages/pageCommands.ts`: two new commands; Back and Forward go through `previewStep`.

#### Not done
- Cross-document (multi-page export) transitions: they belong to the export phases (94 onwards).
- Preview navigation between pages in the new editor (only the older editor at `/editor/legacy` follows links in Preview).
- Shared elements are drawn by the native path only; the fallback moves whole pages.
