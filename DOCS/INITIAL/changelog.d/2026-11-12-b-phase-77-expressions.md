### Phase 77 (Expressions): type `wiggle(2, 10)` on a property and it moves

#### Added
- **Expressions.** A short typed formula on a numeric property of a layer: `wiggle(2, 10)`, `value * 2 + time`, `loopOut("pingpong")`, `ref("Null", "transform.x") * 0.5`. Up to eight per layer, stored on the layer, so they save, undo and keyframe like any other setting. No schema change.
- **A small language, no `eval`.** Numbers, arithmetic, comparisons, conditions, the constants `time`, `value`, `fps`, `duration`, `PI`, `E` and functions `abs floor ceil round sqrt min max pow mod clamp sin cos radians degrees linear ease smoothstep noise wiggle loopOut loopIn valueAtTime ref refAtTime`. It is parsed and type-checked first; a mistake is refused with its position (`[EXPR_SYNTAX] ... (at character 8)`), and expressions are limited in size.
- **`wiggle` is deterministic.** It uses an integer-hash noise and plain arithmetic, so it gives the same numbers on every run and in every browser. Each layer and property has its own default seed.
- **`loopOut` / `loopIn`** repeat the property's own keyframes: cycle, pingpong, offset, continue.
- **Order and cycles:** keyframes, then a link, then the expression (which sees that result as `value`). An expression that refers to another layer in a loop is refused with `[LINK_CYCLE]` and the chain. A bad or disabled expression leaves the property alone.
- Commands: `layer.setExpression`, `layer.removeExpression`, `layer.bakeExpression` (converts an expression to one keyframe per frame, in one undo step).
- `compileExpression` turns an expression into a plain function for exported code.
- Tests: 40 unit tests and `tests/e2e/expressions.spec.ts`. The scene is in the stage lab ("Load expression scene").

#### Not done
- The expression field in the inspector and timeline (the commands are ready; the UI pipeline wires them). Exporters emitting the compiled code. Expressions on colours or text. Firefox and WebKit runs (CI).
