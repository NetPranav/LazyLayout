### Phase 105 (Shape Builder tool): a 12-step journey, and merges of curved pieces no longer fail

#### Added
- `src/core/editing/__tests__/shapeBuilderJourney.test.ts`: three overlapping circles; seven regions whose areas match the analytic lenses; merge, drag-merge, remove, merge all, undo and redo, with the area and node count of every result.

#### Fixed
- Merging regions cut from curves could throw in the polygon clipper ("Unable to complete output ring"): a result path now keeps the exact polygons it was made from, and the clipper retries on a 1/1024 px and then a 1/64 px grid.

#### Not done
- The journey is a unit test, not a three-browser test; the tool is reachable only in the legacy editor; results are plain path layers, not live boolean groups.
