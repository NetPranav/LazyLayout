import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { generatedModuleText } from "../../../../../scripts/export-runtime-source";
import { EXPRESSION_RUNTIME_SOURCE } from "../generated/expressionRuntime";
import { evaluateExpression, type ExprContext } from "../../../expressions/evaluate";
import { parseExpression } from "../../../expressions/parse";

describe("the exported expression runtime (D5)", () => {
  it("the generated file is up to date with the core's evaluator (run `npm run build:export-runtime` if this fails)", () => {
    const want = generatedModuleText().replace(/^[\s\S]*?export const EXPRESSION_RUNTIME_SOURCE = /, "").replace(/;\n$/, "");
    assert.equal(JSON.stringify(EXPRESSION_RUNTIME_SOURCE), want);
  });

  it("imports nothing and runs on its own", () => {
    assert.doesNotMatch(EXPRESSION_RUNTIME_SOURCE, /\bimport\b|\brequire\(/);
    const ctx = vm.createContext({ Math, Number, Error, Array });
    vm.runInContext(EXPRESSION_RUNTIME_SOURCE, ctx);
    assert.equal(typeof (ctx as unknown as { EXPR: { evaluateExpression: unknown } }).EXPR.evaluateExpression, "function");
  });

  it("gives the same number as the core's evaluator for a spread of expressions and contexts", () => {
    const ctxVm = vm.createContext({ Math, Number, Error, Array });
    vm.runInContext(EXPRESSION_RUNTIME_SOURCE, ctxVm);
    const run = (ctxVm as unknown as { EXPR: { evaluateExpression: (a: unknown, c: unknown) => number | undefined } }).EXPR.evaluateExpression;
    const texts = [
      "time * 40", "value + sin(time * 2) * 30", "linear(time, 0, 4, 0, 360)", "ease(time, 1, 3, 10, 90)", "wiggle(3, 12)", "wiggle(2, 5, 7)",
      "noise(time * 0.5)", "clamp(time * 20, 0, 90)", "time < 2 ? 10 : 50", "mod(time, 3) * 10 + abs(-5)", "smoothstep(0, 4, time) * 100", "pow(2, time) + sqrt(16)",
      "ref(\"Hero\", \"transform.x\") * 2", "valueAtTime(time - 1) + 1", "degrees(PI) + radians(90) + E", "min(time, 3) * max(time, 1)", "round(time * 3.3) + floor(2.7) + ceil(2.1)",
    ];
    for (const text of texts) {
      const parsed = parseExpression(text);
      assert.ok(parsed.ok, `${text} parses`);
      if (!parsed.ok) continue;
      for (let i = 0; i <= 40; i++) {
        const t = i * 0.15;
        const ctx: ExprContext = { time: t, value: 12.5, fps: 60, duration: 8, seed: 12345, valueAtTime: (x) => 3 + x, ref: (l, p) => (l === "Hero" && p === "transform.x" ? 7 : undefined), keys: () => null };
        const want = evaluateExpression(parsed.ast, ctx);
        const got = run(JSON.parse(JSON.stringify(parsed.ast)), ctx);
        assert.equal(got, want, `${text} at ${t}`);
      }
    }
  });
});
