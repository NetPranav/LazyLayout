### Phase 86 (Motion along paths): a layer travels along a drawn path at constant speed

Any layer can be put on a path layer and sent along it. The position is a share of the path's length, so the speed is even whatever the path's shape. The SVG filter half of the phase is only partly built, so the phase stays in progress.

#### Added
- `pathSampler` (the file `pathFollow.ts` in `src/core/paths`): the point and direction at a share of a path's length, by measuring the path in short straight pieces. No DOM.
- Layer properties `motionPath.source`, `motionPath.progress`, `motionPath.offset`, `motionPath.autoRotate` and `motionPath.rotate`. The kernel adds the place on the path to the layer's move before the single transform is made.
- Commands `path.follow` and `path.animateFollow`.
- A **Follow a path** section on every layer, in the Design inspector and under the Motion inspector.
- A performance class for each effect (`effectPerformance`: `compositor` or `repaint`), shown in the Effect stack section.
- Stage lab: **Load orbit scene**. 16 unit tests and two browser tests.

#### Changed (shared hot spots)
- `src/core/document/properties.ts`: five new paths (`motionPath.*`). `transform.motionPath` no longer names the CSS property `offset-path` (it was never drawn; the kernel now turns it into a move). No schema version change.
- `src/core/kernel/evaluate.ts`: `evaluateLocalProps` ends with `withPathFollow`. A layer with no path returns the same object, after two property reads.
- `src/core/engine/stage/styleWrites.ts`: a layer on a path counts as animated.
- `src/core/rules/effectRouting.ts`: `effectPerformance`, `performanceOf`, `PERFORMANCE_NOTES` added; the route table is unchanged.

#### Not done
- A colour-matrix effect, animated gradients and animated clip paths.
- A box that draws larger than its frame sits off the path by half the difference (the kernel works from the frame's size).
- Timeline rows for `motionPath.progress`; motion along a path in the exported code.
