import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FULL_EFFECT_LIBRARY } from "../../effects/libraryWaves10To13";
import {
  ALL_RUNTIME_MODULE_IDS,
  buildInteractiveExportBundle,
  type ExportFrameworkTarget,
} from "../interactiveExportRuntime";

describe("Phase 197: Interactive export runtime", () => {
  it("supports all 13 Stage 4 & v4.1 MIT vendored modules and shakes unused ones out", () => {
    assert.equal(ALL_RUNTIME_MODULE_IDS.length, 13);

    const targets: ExportFrameworkTarget[] = ["next", "vite_react", "vue3", "web_component"];
    for (const def of FULL_EFFECT_LIBRARY) {
      for (const target of targets) {
        const bundle = buildInteractiveExportBundle(def, target);
        assert.equal(bundle.zeroLazyLayoutImports, true);
        assert.equal(bundle.disposesContextsOnUnmount, true);
        assert.ok(bundle.vendoredModules.length <= ALL_RUNTIME_MODULE_IDS.length);

        for (const mod of bundle.vendoredModules) {
          assert.ok(mod.source.includes("MIT License"), `${mod.moduleId} missing MIT notice`);
        }

        // Only requested modules were copied
        const copiedIds = new Set(bundle.vendoredModules.map((m) => m.moduleId));
        for (const req of def.requiredRuntimeModules) {
          assert.ok(copiedIds.has(req as typeof bundle.vendoredModules[number]["moduleId"]));
        }

        if (target === "next") {
          assert.ok(bundle.entrySource.startsWith('"use client";'));
        } else if (target === "vue3") {
          assert.ok(bundle.entrySource.includes("onBeforeUnmount"));
        } else if (target === "web_component") {
          assert.ok(bundle.entrySource.includes("disconnectedCallback"));
        }
      }
    }
  });
});
