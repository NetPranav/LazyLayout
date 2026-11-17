import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FULL_EFFECT_LIBRARY } from "../../effects/libraryWaves10To13";
import {
  buildFrameworkFreeEmbedSnippet,
  type EmbedPlatformKind,
} from "../embedScriptAndVitals";

describe("Phase 198: Embed script, size budgets & Web Vitals", () => {
  it("keeps every library effect within per-family size budgets, CLS 0, init < 50 ms, and nonce-CSP clean", () => {
    const platforms: EmbedPlatformKind[] = ["webflow", "framer", "wix", "wordpress", "html"];

    for (let i = 0; i < FULL_EFFECT_LIBRARY.length; i += 1) {
      const def = FULL_EFFECT_LIBRARY[i]!;
      const res = buildFrameworkFreeEmbedSnippet(def, {
        platform: platforms[i % platforms.length],
        cspNonce: "nonce-xyz123",
      });

      assert.equal(
        res.audit.withinSizeBudget,
        true,
        `${def.id} (${def.family}) exceeded budget: ${res.audit.estimatedGzipKb}KB > ${res.audit.budgetKb}KB`
      );
      assert.equal(res.audit.expectedCls, 0, "the poster box is reserved with aspect-ratio");
      assert.ok(res.audit.maxInitTaskMs < 50);
      // The embed runtime isn't built yet, so the audit doesn't claim LCP deferral or offscreen pausing.
      assert.equal(res.audit.runtimeBuilt, false);
      assert.equal(res.audit.waitsForLcp, false);
      assert.equal(res.audit.pausesOffscreen, false);
      assert.equal(res.audit.strictNonceCspCompliant, true, "a nonce was given");
      assert.ok(res.htmlSnippet.includes(`data-fx="${def.id}"`));
      assert.ok(res.htmlSnippet.includes('type="module" nonce="nonce-xyz123"'));
      assert.ok(!res.htmlSnippet.includes("eval("));
    }
  });

  it("is not CSP-compliant without a nonce", () => {
    const def = FULL_EFFECT_LIBRARY[0]!;
    assert.equal(buildFrameworkFreeEmbedSnippet(def).audit.strictNonceCspCompliant, false);
  });
});
