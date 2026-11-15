import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingSchema } from "../../document/signals";
import { createReferenceFrame, REFERENCE_BINDINGS } from "../referenceBindings";
import { compileExpr, toNumber } from "../evaluate";
import { authorScriptedTape } from "../tape";
import {
  buildPlaygroundTapeSession,
  buildSignalNodeGraph,
  compileCssScrollTimeline,
  compileVendoredSignalsBundle,
  evaluateExportedBindingsParity,
} from "../exportCompiler";

describe("Stage 4 Phase 142: Pro Signals panel & binding export compiler", () => {
  it("builds a signal->operator->target node DAG and playground tape session", () => {
    const subset = REFERENCE_BINDINGS.slice(0, 3);
    const graph = buildSignalNodeGraph(subset, { [subset[0]!.id]: 12.5 });
    assert.ok(graph.nodes.length >= 6);
    assert.ok(graph.edges.length >= 3);

    const tape = authorScriptedTape({
      id: "pg_tape",
      name: "Playground preview",
      duration: 2,
      channels: [{ signal: { kind: "scroll", channel: "progress" }, samples: [{ t: 0, v: 0 }, { t: 2, v: 1 }] }],
    });
    const session = buildPlaygroundTapeSession(subset, tape);
    assert.equal(session.bindingsDsl.length, 3);
    assert.ok(session.serializedTape.includes("pg_tape"));
  });

  it("compiles pure scroll/view bindings to CSS scroll/view timelines when expressible", () => {
    const scrollOpacity = BindingSchema.parse({
      id: "scroll-fade",
      ownerLayerId: "hero",
      enabled: true,
      expr: {
        signal: { kind: "scroll", channel: "progress" },
        operators: [{ op: "remap", inMin: 0, inMax: 1, outMin: 0.2, outMax: 1, clamp: true }],
      },
      target: { kind: "property", on: { kind: "layer", ref: "hero" }, path: "appearance.opacity" },
    });
    const css = compileCssScrollTimeline(scrollOpacity);
    assert.ok(css);
    assert.ok(css.includes("animation-timeline: scroll(root block)"));
    assert.ok(css.includes("opacity: 0.2"));
    assert.ok(css.includes("opacity: 1"));
  });

  it("maintains tape parity across all 12 reference bindings in both Next and Vite vendored bundles", () => {
    const frames = [0, 10, 20, 30, 45, 60].map((t) => createReferenceFrame(t, 1 / 60));
    const expected: Record<string, number> = {};
    for (const b of REFERENCE_BINDINGS) {
      const rt = compileExpr(b.expr);
      let val = 0;
      for (const f of frames) val = toNumber(rt.step(f));
      expected[b.id] = val;
    }

    for (const target of ["next", "vite"] as const) {
      const bundle = compileVendoredSignalsBundle(REFERENCE_BINDINGS, target);
      assert.ok(bundle.files["ticker.ts"].includes("createExportTicker"));
      assert.ok(bundle.files["signals.ts"].includes("EXPORT_BINDINGS"));
      if (target === "next") assert.ok(bundle.files["ticker.ts"].startsWith('"use client";'));

      const actual = evaluateExportedBindingsParity(bundle, frames);
      for (const b of REFERENCE_BINDINGS) {
        assert.ok(
          Math.abs((actual[b.id] ?? Number.NaN) - expected[b.id]!) < 1e-6,
          `${target} parity mismatch on ${b.id}`
        );
      }
    }
  });
});
