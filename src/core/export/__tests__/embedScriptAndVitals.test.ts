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
      assert.equal(res.audit.expectedCls, 0);
      assert.ok(res.audit.maxInitTaskMs < 50);
      assert.equal(res.audit.waitsForLcp, true);
      assert.equal(res.audit.pausesOffscreen, true);
      assert.equal(res.audit.strictNonceCspCompliant, true);
      assert.ok(res.htmlSnippet.includes(`data-fx="${def.id}"`));
      assert.ok(res.htmlSnippet.includes('type="module" nonce="nonce-xyz123"'));
      assert.ok(!res.htmlSnippet.includes("eval("));
    }
  });
});
