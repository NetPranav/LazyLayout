import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importCodeComponent } from "../codeComponents";

const FIXTURES = [
  { id: "cmp_01", name: "MagneticTicker", license: "MIT", src: `export interface TickerProps { /** @min 0 @max 10 */ speed: number; label: string; }` },
  { id: "cmp_02", name: "GlitchHeadline", license: "Apache-2.0", src: `export interface Props { text: string; accentColor: string; active?: boolean; }` },
  { id: "cmp_03", name: "RadialGauge", license: "MIT", src: `export interface GaugeProps { value: number; mode: "arc" | "ring"; onReachMax?: () => void; }` },
  { id: "cmp_04", name: "TiltCard", license: "BSD-3-Clause", src: `export interface Props { maxDeg: number; glare: boolean; onFlip?: () => void; }` },
  { id: "cmp_05", name: "ConfettiTrigger", license: "MIT", src: `export interface Props { count: number; onComplete?: () => void; }` },
  { id: "cmp_06", name: "WaveShader", license: "ISC", src: `export interface Props { frequency: number; tintColor: string; }` },
  { id: "cmp_07", name: "PricingSwitch", license: "MIT", src: `export interface Props { annual: boolean; onChange?: () => void; }` },
  { id: "cmp_08", name: "Typewriter", license: "GPL-3.0", src: `export interface Props { copy: string; delayMs: number; }` },
  { id: "cmp_09", name: "MagneticBadge", license: "Proprietary", src: `export interface Props { text: string; radius: number; }` },
  { id: "cmp_10", name: "ParallaxStack", license: "MIT", src: `export interface Props { depth: number; variant: "soft" | "deep"; onHover?: () => void; }` },
];

describe("Phase 196: Code components", () => {
  it("imports 10 TSX fixtures, infers controls & Blueprint events, pins deps, and isolates in sandbox", () => {
    for (const fx of FIXTURES) {
      const cmp = importCodeComponent({
        id: fx.id,
        componentName: fx.name,
        source: fx.src,
        license: fx.license,
        dependencies: [{ name: "lucide-react", version: "0.460.0" }],
        bindings: fx.id === "cmp_01" ? { speed: { source: "signal", path: "pointer.speed" } } : undefined,
      });

      assert.ok(cmp.controls.length >= 2, `${fx.id} inferred controls`);
      assert.equal(cmp.sandbox.sandboxAttr, "allow-scripts");
      assert.equal(cmp.sandbox.allowsSameOrigin, false);
      assert.equal(cmp.bundleManifest.pinnedDependencies[0]?.integritySha256.length, 16);
      assert.ok(cmp.nextExportTsx.startsWith('"use client";'));
    }

    const gauge = importCodeComponent({
      id: "cmp_03",
      componentName: "RadialGauge",
      source: FIXTURES[2]!.src,
      license: "MIT",
    });
    assert.deepEqual(
      gauge.controls.find((c) => c.name === "mode")?.options,
      ["arc", "ring"]
    );
    assert.deepEqual(gauge.blueprintEvents, [{ propName: "onReachMax", eventName: "cmp:onReachMax" }]);
  });

  it("enforces GATE-03 by keeping restricted or unknown licences private", () => {
    const gpl = importCodeComponent({
      id: "cmp_08",
      componentName: "Typewriter",
      source: FIXTURES[7]!.src,
      license: "GPL-3.0",
    });
    assert.equal(gpl.licenseStatus.publicLibraryAllowed, false);
    assert.equal(gpl.licenseStatus.keepPrivate, true);

    const mit = importCodeComponent({
      id: "cmp_01",
      componentName: "MagneticTicker",
      source: FIXTURES[0]!.src,
      license: "MIT",
    });
    assert.equal(mit.licenseStatus.publicLibraryAllowed, true);
    assert.equal(mit.licenseStatus.keepPrivate, false);
  });
});
