### Phase 112 (Shape generators): scatter, Voronoi and Delaunay cells, grids, rings, flow lines

#### Added
- Five seeded generator modifiers (`core/paths/generators.ts`) with a Shuffle button in the Modifiers section.
- `generators.test.ts` and `tests/e2e/generators.spec.ts` (2,000 stars dragged at a median 16.7 ms a frame).

#### Changed
- The modifier cache ignores where a layer sits, so dragging doesn't regenerate its modifiers.

#### Fixed
- A dropdown reopened while its list was still animating out showed no list.

#### Not done
- Generated pieces can't be detached into layers; only four built-in particle shapes.
