### Phase 106 (Path operations): offset, simplify, smooth, divide, knife, join and reverse

#### Added
- `src/core/paths/pathTools.ts`: offset (round, mitre or bevel corners; the result is curves), simplify and smooth by a strength from 0 to 1, divide, knife (straight or bent), join two open paths, reverse.
- `src/core/editing/pathToolOps.ts`: the same on layers, one undo step each; closed shapes keep their place and style, open paths are edited as their nodes.
- Typed commands: `vector.offset`, `vector.simplify`, `vector.smooth`, `vector.reverse`, `vector.divide`, `vector.knife`, `vector.join`.
- `layerCanvasArea`, `canReshape`, `reshapeLayer` and `addShapeAbove` exported from `shapeBuilder.ts` for reuse.

#### Not done
- No knife tool on the canvas and no inspector controls in the new editor; the operations are reached through the command palette and the agent bridge.
