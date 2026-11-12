import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import type { PropValue } from "../../document/registry";
import { evaluate } from "../../kernel/evaluate";
import { animatedLayers, animatedPaths } from "../../engine/stage/styleWrites";
import { tryRunCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { findLinkCycle } from "../../links/linkModel";
import { EXPR_LIMITS } from "../ast";
import { compileExpression, EXPRESSION_RUNTIME_SOURCE } from "../compile";
import { evaluateExpression, type ExprContext } from "../evaluate";
import { exprPath, readExpressions } from "../exprModel";
import { hashInt, lattice, noise1, seedFromText } from "../noise";
import { expressionRefs, parseExpression } from "../parse";
import { registerExpressionCommands } from "../expressionCommands";

const ctxOf = (over: Partial<ExprContext> = {}): ExprContext => ({
  time: 1, value: 10, fps: 60, duration: 5, seed: 0,
  valueAtTime: (t) => 10 + t, ref: (layer, prop, t) => (layer === "Ghost" ? undefined : layer.length + prop.length + (t ?? 0)),
  keys: () => ({ first: 1, last: 3, firstValue: 0, lastValue: 100 }), ...over,
});
const run = (text: string, over: Partial<ExprContext> = {}): number | undefined => {
  const parsed = parseExpression(text);
  assert.ok(parsed.ok, `${text}: ${JSON.stringify(!parsed.ok && parsed.errors)}`);
  return evaluateExpression(parsed.ast, ctxOf(over));
};
const errs = (text: string) => { const p = parseExpression(text); return p.ok ? [] : p.errors; };

describe("Phase 77: the language, parsed and checked before anything runs", () => {
  it("arithmetic follows the usual order, with ** binding tighter than a unary minus", () => {
    assert.equal(run("2 + 3 * 4"), 14);
    assert.equal(run("(2 + 3) * 4"), 20);
    assert.equal(run("-2 ** 2"), -4);
    assert.equal(run("2 ** 3 ** 2"), 512, "** goes to the right");
    assert.equal(run("10 - 4 - 3"), 3);
    assert.equal(run("7 % 4"), 3);
    assert.equal(run("-7 % 4"), 1, "a remainder is never negative");
    assert.equal(run("1.5e1 + .5"), 15.5);
  });
  it("comparisons, true and false, and the condition give numbers (true is 1)", () => {
    assert.equal(run("time > 0.5 ? 100 : 0"), 100);
    assert.equal(run("time > 2 ? 100 : 0"), 0);
    assert.equal(run("time >= 1 && time <= 1"), 1);
    assert.equal(run("!(time == 1) || false"), 0);
    assert.equal(run("value != 10 ? 1 : 2"), 2);
  });
  it("time, value, fps, duration and PI are known", () => {
    assert.deepEqual([run("time"), run("value"), run("fps"), run("duration")], [1, 10, 60, 5]);
    assert.equal(run("PI"), Math.PI);
  });
  it("a mistake is refused where it is written, with where", () => {
    assert.deepEqual(errs("2 +"), [{ code: "EXPR_SYNTAX", message: "The expression ends too soon.", at: 3 }]);
    assert.equal(errs("(1 + 2")[0].code, "EXPR_SYNTAX");
    assert.equal(errs("1 + 2)")[0].at, 5);
    assert.equal(errs("2 $ 3")[0].at, 2);
    assert.equal(errs("")[0].message, "The expression is empty.");
    assert.match(errs("foo + 1")[0].message, /"foo" isn't known/);
    assert.match(errs("sparkle(1)")[0].message, /isn't a function/);
  });
  it("it is typed: numbers where numbers go, and a count of values for each function", () => {
    assert.equal(errs("1 + (2 > 1)")[0].code, "EXPR_TYPE");
    assert.equal(errs("!5")[0].code, "EXPR_TYPE");
    assert.equal(errs("1 ? 2 : 3")[0].code, "EXPR_TYPE");
    assert.equal(errs("true ? 1 : false")[0].code, "EXPR_TYPE");
    assert.equal(errs('"hello"')[0].message, "An expression gives a number, not text.");
    assert.match(errs("wiggle(1)")[0].message, /wiggle\(\) takes 2 to 3 values, not 1/);
    assert.match(errs("clamp(1, 2)")[0].message, /takes 3 values, not 2/);
    assert.match(errs('abs("x")')[0].message, /wants a number for value 1/);
    assert.match(errs('ref(time, "x")')[0].message, /text in quotes/);
    assert.match(errs('loopOut("sideways")')[0].message, /A loop is one of/);
  });
  it("it is small: long, deep and large expressions are refused", () => {
    assert.equal(errs("1+".repeat(400) + "1")[0].code, "EXPR_LIMIT");
    assert.equal(errs("(".repeat(EXPR_LIMITS.depth + 2) + "1" + ")".repeat(EXPR_LIMITS.depth + 2))[0].code, "EXPR_LIMIT");
    assert.equal(errs(Array.from({ length: 200 }, () => "1").join(" + "))[0].code, "EXPR_LIMIT", "more than 300 parts");
  });
  it("finds the references to other layers", () => {
    const p = parseExpression('ref("Hero", "transform.x") * 2 + refAtTime("Null", "transform.y", time - 1)');
    if (!p.ok) throw new Error("parse");
    assert.deepEqual(expressionRefs(p.ast), [{ layer: "Hero", property: "transform.x" }, { layer: "Null", property: "transform.y" }]);
  });
  it("there is no eval and no Function anywhere in the language", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) { if (name !== "__tests__") walk(path); continue; }
        const text = readFileSync(path, "utf8").split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
        if (/\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(/.test(text.replace(EXPRESSION_RUNTIME_SOURCE, ""))) hits.push(path);
      }
    };
    walk(join(process.cwd(), "src/core/expressions"));
    assert.deepEqual(hits, []);
  });
});

describe("Phase 77: functions, golden values", () => {
  it("min, max, clamp, abs, floor, ceil, round, sqrt, pow, mod", () => {
    assert.deepEqual([run("min(3, 8)"), run("max(3, 8)"), run("clamp(12, 0, 10)"), run("clamp(-5, 10, 0)"), run("abs(-4.5)"), run("floor(2.9)"), run("ceil(2.1)"), run("round(2.5)"), run("sqrt(81)"), run("pow(2, 10)"), run("mod(-1, 3)")], [3, 8, 10, 0, 4.5, 2, 3, 3, 9, 1024, 2]);
    assert.equal(run("sqrt(-1)"), undefined);
    assert.equal(run("mod(1, 0)"), undefined);
  });
  it("linear and ease carry t from one range to another and hold outside it", () => {
    assert.equal(run("linear(time, 0, 2, 0, 100)", { time: 1 }), 50);
    assert.equal(run("linear(time, 0, 2, 0, 100)", { time: -3 }), 0);
    assert.equal(run("linear(time, 0, 2, 0, 100)", { time: 9 }), 100);
    assert.equal(run("linear(time, 2, 0, 0, 100)", { time: 0.5 }), 75, "a reversed range reverses it");
    assert.equal(run("ease(time, 0, 2, 0, 100)", { time: 1 }), 50);
    assert.equal(run("ease(time, 0, 2, 0, 100)", { time: 0.5 }), 15.625, "smoothstep(0.25) = 0.15625");
    assert.equal(run("smoothstep(0, 10, 5)"), 0.5);
  });
  it("radians, degrees, sin and cos", () => {
    assert.equal(run("degrees(PI)"), 180);
    assert.equal(run("radians(180)"), Math.PI);
    assert.ok(Math.abs((run("sin(radians(30))") as number) - 0.5) < 1e-12);
    assert.ok(Math.abs((run("cos(0)") as number) - 1) < 1e-12);
  });
  it("valueAtTime reads this property's keyframes at another time; ref and refAtTime read other layers", () => {
    assert.equal(run("valueAtTime(time - 0.5)"), 10.5);
    assert.equal(run('ref("Hero", "transform.x")'), 4 + 11);
    assert.equal(run('refAtTime("Hero", "transform.x", 2)'), 4 + 11 + 2);
    assert.equal(run('ref("Ghost", "transform.x")'), undefined, "a layer that isn't there can't be read");
  });
  it("something that isn't a finite number is 'can't be worked out', never a crash", () => {
    assert.equal(run("1 / 0"), undefined);
    assert.equal(run("0 / 0"), undefined);
    assert.equal(run("pow(10, 400)"), undefined);
  });
});

describe("Phase 77: wiggle is deterministic: the same on every run and in every browser", () => {
  it("the hash and the noise are pinned (integer hashing and plain arithmetic only)", () => {
    assert.deepEqual([hashInt(0, 0), hashInt(1, 0), hashInt(-1, 7), hashInt(12345, 99)], [3758786527, 506926621, 1548122465, 1747106651]);
    assert.deepEqual([lattice(0, 0), lattice(1, 0), lattice(2, 0)], [0.7503213732853349, -0.7639438970396164, 0.7659527705437394]);
    assert.deepEqual([0, 0.5, 1, 1.25, 2.75, -0.4].map((x) => noise1(x, 0)), [0.7503213732853349, -0.006811261877140762, -0.7639438970396164, -0.5248975427297171, -0.3203256385768358, 0.5173964889863032]);
    assert.deepEqual([0, 0.5, 1.25].map((x) => noise1(x, 7)), [0.4150099352502752, 0.14647480965277054, -0.2470070321426045]);
    assert.equal(seedFromText("hero|transform.x"), 1967150943);
  });
  it("wiggle(freq, amp) is the value plus amp times noise at time * freq", () => {
    assert.equal(run("wiggle(2, 10, 0)", { time: 0, value: 50 }), 50 + 10 * noise1(0, 0));
    assert.equal(run("wiggle(2, 10, 0)", { time: 1.25, value: 50 }), 50 + 10 * noise1(2.5, 0));
    assert.ok(Math.abs((run("wiggle(1, 10, 0)", { time: 0, value: 0 }) as number) - 7.503213732853349) < 1e-12);
    assert.ok(Math.abs((run("wiggle(1, 10, 0)", { time: 1, value: 0 }) as number) + 7.639438970396164) < 1e-12);
  });
  it("the same inputs give the same number every time, however often it is asked", () => {
    const first = Array.from({ length: 50 }, (_, i) => run("wiggle(3, 25)", { time: i / 7, seed: 1234 }));
    for (let k = 0; k < 3; k++) assert.deepEqual(Array.from({ length: 50 }, (_, i) => run("wiggle(3, 25)", { time: i / 7, seed: 1234 })), first);
  });
  it("it stays inside its amplitude, is smooth, and is not constant", () => {
    const xs = Array.from({ length: 2000 }, (_, i) => run("wiggle(2, 10)", { time: i / 100, value: 0, seed: 5 }) as number);
    assert.ok(xs.every((x) => Math.abs(x) <= 10 + 1e-9));
    assert.ok(Math.max(...xs) > 5 && Math.min(...xs) < -5, "it uses its range");
    const jump = Math.max(...xs.slice(1).map((x, i) => Math.abs(x - xs[i])));
    assert.ok(jump < 1.5, `no jumps between hundredths of a second (${jump})`);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(Math.abs(mean) < 2, `zero mean (${mean})`);
  });
  it("a different seed wiggles differently; an explicit seed in the text beats the layer's own", () => {
    assert.notEqual(run("wiggle(2, 10)", { time: 0.3, seed: 1 }), run("wiggle(2, 10)", { time: 0.3, seed: 2 }));
    assert.equal(run("wiggle(2, 10, 9)", { time: 0.3, seed: 1 }), run("wiggle(2, 10, 9)", { time: 0.3, seed: 2 }));
  });
});

describe("Phase 77: loopOut and loopIn repeat the property's keyframes", () => {
  // the keyframes run 1 s to 3 s, from 0 to 100; valueAtTime here is a straight line through them (10 + t is just a stand-in, so use a line)
  const line = { valueAtTime: (t: number) => ((Math.min(3, Math.max(1, t)) - 1) / 2) * 100 };
  it("before the end nothing changes; after it the animation cycles", () => {
    assert.equal(run('loopOut("cycle")', { ...line, time: 2, value: 50 }), 50, "still inside the keyframes: the value");
    assert.equal(run('loopOut("cycle")', { ...line, time: 4, value: 100 }), 50, "3 s to 5 s plays the keyframes again");
    assert.equal(run('loopOut("cycle")', { ...line, time: 3.5, value: 100 }), 25);
    assert.equal(run("loopOut()", { ...line, time: 3.5, value: 100 }), 25, "cycle is the default");
  });
  it("pingpong runs it back and forth", () => {
    assert.equal(run('loopOut("pingpong")', { ...line, time: 3.5, value: 100 }), 75);
    assert.equal(run('loopOut("pingpong")', { ...line, time: 4.5, value: 100 }), 25);
    assert.equal(run('loopOut("pingpong")', { ...line, time: 5.5, value: 100 }), 25);
  });
  it("offset adds what each pass travelled; continue carries on at the final speed", () => {
    assert.equal(run('loopOut("offset")', { ...line, time: 4, value: 100 }), 150);
    assert.equal(run('loopOut("offset")', { ...line, time: 6, value: 100 }), 250, "two full passes (200) plus the 50 reached by 6 s");
    const c = run('loopOut("continue")', { ...line, time: 4, value: 100 }) as number;
    assert.ok(Math.abs(c - 150) < 1e-6, `50 per second after 1 s: ${c}`);
  });
  it("loopIn repeats before the first keyframe; a property without two keyframes just has its value", () => {
    assert.equal(run('loopIn("cycle")', { ...line, time: 0.5, value: 0 }), 75);
    assert.equal(run('loopOut("cycle")', { ...line, time: 4, value: 7, keys: () => null }), 7);
  });
});

describe("Phase 77: expressions in the kernel", () => {
  const layer = (id: string, name: string, properties: Record<string, PropValue> = {}): Layer => createLayer({ id, archetype: "container", parentId: null, name, properties: { "frame.width": 100, "frame.height": 100, ...properties } }) as Layer;
  const expr = (slot: number, target: string, text: string, enabled = true): Record<string, PropValue> => ({ [exprPath(slot, "target")]: target, [exprPath(slot, "text")]: text, [exprPath(slot, "enabled")]: enabled });
  const doc = (layers: Layer[], clips: ReturnType<typeof attachClip>[] = []): MotionDocument => createDocumentFromLayers(layers, clips);
  const ev = (d: MotionDocument, id: string, path: string, t = 0) => evaluate(d, "comp_main", id, t)[path];
  const slide = (layerId: string, property: string, from: number, to: number) => attachClip(hydrateClip({ name: "Move", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property, keyframes: [{ time: 0, value: from }, { time: 1, value: to }] }] }), layerId);

  it("wiggle(2, 10) on a property moves it around its value, and the same at the same time", () => {
    const d = doc([layer("a", "Hero", { ...expr(1, "transform.x", "wiggle(2, 10)"), "transform.x": 100 })]);
    const xs = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((t) => ev(d, "a", "transform.x", t) as number);
    assert.ok(xs.every((x) => Math.abs(x - 100) <= 10 + 1e-9));
    assert.ok(new Set(xs).size > 3, "it moves");
    assert.deepEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5].map((t) => ev(d, "a", "transform.x", t)), xs);
  });
  it("two layers wiggle differently (their own seed), each the same every time", () => {
    const d = doc([layer("a", "A", expr(1, "transform.x", "wiggle(2, 10)")), layer("b", "B", expr(1, "transform.x", "wiggle(2, 10)"))]);
    assert.notEqual(ev(d, "a", "transform.x", 0.3), ev(d, "b", "transform.x", 0.3));
  });
  it("`value` is what the keyframes gave: the expression rides on the animation", () => {
    const d = doc([layer("a", "Hero", expr(1, "transform.x", "value * 2 + 5"))], [slide("a", "transform.x", 0, 100)]);
    for (const t of [0, 0.5, 1]) assert.equal(ev(d, "a", "transform.x", t), 100 * t * 2 + 5);
  });
  it("an expression sees a link's result as `value`, and refers to other layers' properties", () => {
    const d = doc([
      layer("a", "Hero", { ...expr(1, "transform.rotate", "value + ref('Null', 'transform.y')".replace(/'/g, '"')), "link.1.target": "transform.rotate", "link.1.source": "b", "link.1.sourceProperty": "transform.x" }),
      layer("b", "Null", { "transform.x": 30, "transform.y": 5 }),
    ]);
    assert.equal(ev(d, "a", "transform.rotate"), 35, "the link gave 30, the expression added the null's y");
  });
  it("loopOut repeats the layer's own keyframes in the real document", () => {
    const d = doc([layer("a", "Hero", expr(1, "transform.x", 'loopOut("cycle")'))], [slide("a", "transform.x", 0, 100)]);
    assert.equal(ev(d, "a", "transform.x", 0.5), 50);
    assert.equal(ev(d, "a", "transform.x", 1.5), 50, "after the last keyframe (1 s) it plays again");
    assert.ok(Math.abs((ev(d, "a", "transform.x", 1.25) as number) - 25) < 1e-6);
  });
  it("valueAtTime, and time in the expression, follow the composition's clock", () => {
    const d = doc([layer("a", "Hero", expr(1, "transform.x", "valueAtTime(time - 0.5) + time"))], [slide("a", "transform.x", 0, 100)]);
    assert.ok(Math.abs((ev(d, "a", "transform.x", 0.75) as number) - (25 + 0.75)) < 1e-9);
  });
  it("a bad expression, a disabled one, or one that can't be worked out leaves the property alone", () => {
    const own = { "transform.x": 42 };
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...expr(1, "transform.x", "2 +") })]), "a", "transform.x"), 42);
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...expr(1, "transform.x", "value + 1", false) })]), "a", "transform.x"), 42);
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...expr(1, "transform.x", "1 / 0") })]), "a", "transform.x"), 42);
    assert.equal(ev(doc([layer("a", "Hero", { ...own, ...expr(1, "transform.x", 'ref("Nobody", "transform.x")') })]), "a", "transform.x"), 42);
  });
  it("expressions that refer to each other in a loop stop where it closes, and the loop is found", () => {
    const d = doc([layer("a", "A", { ...expr(1, "transform.x", 'ref("B", "transform.x") + 1'), "transform.x": 3 }), layer("b", "B", { ...expr(1, "transform.x", 'ref("A", "transform.x") + 1'), "transform.x": 4 })]);
    assert.equal(typeof ev(d, "a", "transform.x"), "number");
    assert.ok(findLinkCycle(d));
  });
  it("a driven layer is planned on the kernel and written every frame", () => {
    const d = doc([layer("a", "Hero", expr(1, "transform.x", "wiggle(1, 5)"))]);
    assert.ok(animatedPaths(d, "a").has("transform.x"));
    assert.ok(animatedLayers(d).has("a"));
  });
});

describe("Phase 77: compiled to plain functions, the same as the evaluator", () => {
  const runtime = new Function(`${EXPRESSION_RUNTIME_SOURCE}; return createExpressionRuntime();`)();
  const TEXTS = [
    "2 + 3 * 4", "-2 ** 2", "7 % 4", "-7 % 4", "time > 0.5 ? 100 : 0", "time >= 1 && time <= 1", "!(time == 1) || false",
    "min(3, 8) + max(3, 8) + clamp(12, 0, 10)", "linear(time, 0, 2, 0, 100)", "ease(time, 0, 2, 0, 100)", "smoothstep(0, 10, time)",
    "wiggle(3, 25)", "wiggle(2, 10, 9)", "noise(time * 4) * 50", "valueAtTime(time - 0.5)", 'ref("Hero", "transform.x") * 2', 'refAtTime("Hero", "transform.x", 2)',
    'loopOut("cycle")', 'loopOut("pingpong")', 'loopOut("offset")', 'loopOut("continue")', 'loopIn("cycle")', "sqrt(value) + abs(-3) + floor(2.9)", "1 / 0", 'ref("Ghost", "transform.x")', "pow(2, time)", "mod(-1, 3)",
  ];
  it("27 expressions at 12 times: every one gives the evaluator's number (or both give nothing)", () => {
    const line = (t: number) => ((Math.min(3, Math.max(1, t)) - 1) / 2) * 100;
    for (const text of TEXTS) {
      const compiled = compileExpression(text);
      assert.ok(compiled.ok, text);
      const fn = new Function(`return ${(compiled as { source: string }).source}`)() as (c: ExprContext, h: unknown) => number;
      for (const time of [0, 0.25, 0.5, 1, 1.5, 2, 2.75, 3, 3.5, 4.25, 5.5, 7]) {
        const ctx = ctxOf({ time, value: 10 + time, seed: 321, valueAtTime: line });
        const expected = run(text, { time, value: 10 + time, seed: 321, valueAtTime: line });
        const got = fn(ctx, runtime);
        if (expected === undefined) assert.ok(!Number.isFinite(got), `${text} at ${time}: expected nothing, got ${got}`);
        else assert.ok(Math.abs(got - expected) < 1e-9, `${text} at ${time}: ${got} vs ${expected}`);
      }
    }
  });
  it("a bad expression doesn't compile, and says why", () => {
    const r = compileExpression("1 +");
    assert.equal(r.ok, false);
    assert.match((r as { message: string }).message, /^\[EXPR_SYNTAX\]/);
  });
  it("the compiled function has no eval in it", () => {
    const r = compileExpression("wiggle(2, 10) + ref(\"Hero\", \"transform.x\")");
    assert.ok(r.ok && !/eval|Function\(/.test(r.source));
  });
});

describe("Phase 77: the expression commands", () => {
  const fresh = (comp: { fps: number; duration: number } = { fps: 10, duration: 1 }) => {
    const base = createDocumentFromLayers([createLayer({ id: "a", archetype: "container", parentId: null, name: "Hero", properties: { "frame.width": 100 } }) as Layer, createLayer({ id: "b", archetype: "container", parentId: null, name: "Null", properties: { "frame.width": 100, "transform.x": 8 } }) as Layer], []);
    const main = base.compositions.comp_main;
    setDocument({ ...base, compositions: { ...base.compositions, comp_main: { ...main, fps: comp.fps, duration: comp.duration, workArea: { start: 0, end: comp.duration } } } });
    return registerExpressionCommands();
  };
  const outcome = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { ok: boolean; result: Record<string, unknown> }).result;

  it("puts an expression on a property in one undo step; the property follows it", () => {
    const off = fresh();
    try {
      assert.deepEqual(outcome("layer.setExpression", { id: "a", property: "transform.x", text: "value + 5" }), { ok: true, slot: 1, description: "Hero.transform.x" });
      assert.equal(evaluate(getDocument(), "comp_main", "a", 0)["transform.x"], 5);
      historyCommands.undo();
      assert.deepEqual(readExpressions(getDocument().layers.a.properties), []);
    } finally { off(); }
  });
  it("refuses a bad expression with its code and where, and writes nothing", () => {
    const off = fresh();
    try {
      const r = outcome("layer.setExpression", { id: "a", property: "transform.x", text: "wiggle(1" });
      assert.equal(r.ok, false);
      assert.equal(r.code, "EXPR_SYNTAX");
      assert.match(String(r.message), /^\[EXPR_SYNTAX\] .* \(at character \d+\)$/);
      assert.deepEqual(readExpressions(getDocument().layers.a.properties), []);
      assert.equal(outcome("layer.setExpression", { id: "a", property: "transform.x", text: "wiggle(1)" }).code, "EXPR_TYPE");
      assert.equal(outcome("layer.setExpression", { id: "a", property: "appearance.background.color", text: "1" }).code, "NOT_LINKABLE");
    } finally { off(); }
  });
  it("refuses a cycle through the layers it refers to, with the chain", () => {
    const off = fresh();
    try {
      assert.equal(outcome("layer.setExpression", { id: "a", property: "transform.x", text: 'ref("Null", "transform.x") * 2' }).ok, true);
      const r = outcome("layer.setExpression", { id: "b", property: "transform.x", text: 'ref("Hero", "transform.x")' });
      assert.equal(r.code, "LINK_CYCLE");
      assert.equal(r.message, "[LINK_CYCLE] Null.transform.x ← Hero.transform.x ← Null.transform.x");
      assert.equal(readExpressions(getDocument().layers.b.properties).length, 0);
    } finally { off(); }
  });
  it("replaces the expression on a property in the same slot, and removes by slot or property", () => {
    const off = fresh();
    try {
      outcome("layer.setExpression", { id: "a", property: "transform.x", text: "1" });
      outcome("layer.setExpression", { id: "a", property: "transform.x", text: "2" });
      assert.deepEqual(readExpressions(getDocument().layers.a.properties).map((e) => [e.slot, e.text]), [[1, "2"]]);
      outcome("layer.setExpression", { id: "a", property: "transform.y", text: "3" });
      assert.deepEqual(outcome("layer.removeExpression", { id: "a", property: "transform.x" }), { removed: 1 });
      assert.deepEqual(readExpressions(getDocument().layers.a.properties).map((e) => e.target), ["transform.y"]);
      assert.equal(getDocument().layers.a.properties[exprPath(1, "text")], undefined, "the slot is clear");
    } finally { off(); }
  });
  it("bakes an expression to keyframes: the same values at every frame, then the expression is gone", () => {
    const off = fresh();
    try {
      outcome("layer.setExpression", { id: "a", property: "transform.x", text: "wiggle(4, 20, 3)" });
      const before = Array.from({ length: 11 }, (_, f) => evaluate(getDocument(), "comp_main", "a", f / 10)["transform.x"] as number);
      const r = outcome("layer.bakeExpression", { id: "a", property: "transform.x" });
      assert.deepEqual(r, { ok: true, keyframes: 11 });
      assert.deepEqual(readExpressions(getDocument().layers.a.properties), []);
      const after = Array.from({ length: 11 }, (_, f) => evaluate(getDocument(), "comp_main", "a", f / 10)["transform.x"] as number);
      // the clip the bake writes ends at its last key (1 s), where a clip hands back to the layer's own value, so compare the frames inside it
      before.slice(0, 10).forEach((v, i) => assert.ok(Math.abs(v - after[i]) < 1e-6, `frame ${i}: ${after[i]} vs ${v}`));
      historyCommands.undo();
      assert.equal(readExpressions(getDocument().layers.a.properties).length, 1, "one undo puts the expression back");
    } finally { off(); }
  });
  it("refuses to bake what has no expression, or more frames than it will write", () => {
    const off = fresh({ fps: 10, duration: 400 });
    try {
      assert.equal(outcome("layer.bakeExpression", { id: "a", property: "transform.x" }).code, "NO_EXPRESSION");
      outcome("layer.setExpression", { id: "a", property: "transform.x", text: "time" });
      assert.equal(outcome("layer.bakeExpression", { id: "a", property: "transform.x" }).code, "TOO_LONG");
    } finally { off(); }
  });
});
