import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePresetId,
  presetForBreakpoint,
  findBreakpointForPreset,
  findActiveFrameId,
  planPresetAction,
  PRESET_DEFS,
} from "../presetBreakpoints";
import type { Breakpoint } from "@/core/breakpoints/breakpoints";
import type { Layer } from "@/core/document/schema";

const DEFAULT_BPS: readonly Breakpoint[] = [
  { id: "desktop", name: "Desktop", width: 1440 },
  { id: "tablet", name: "Tablet", width: 768 },
  { id: "mobile", name: "Mobile", width: 375 },
];

describe("Task E: presetBreakpoints pure logic", () => {
  describe("normalizePresetId", () => {
    it("maps strings to 1440, 768, 375", () => {
      assert.equal(normalizePresetId("Desktop"), "1440");
      assert.equal(normalizePresetId("desktop"), "1440");
      assert.equal(normalizePresetId("1440"), "1440");
      assert.equal(normalizePresetId("Tablet"), "768");
      assert.equal(normalizePresetId("tablet"), "768");
      assert.equal(normalizePresetId("768"), "768");
      assert.equal(normalizePresetId("Mobile"), "375");
      assert.equal(normalizePresetId("mobile"), "375");
      assert.equal(normalizePresetId("375"), "375");
      assert.equal(normalizePresetId("unknown"), "1440");
    });
  });

  describe("findBreakpointForPreset", () => {
    it("finds the base breakpoint for Desktop", () => {
      const bp = findBreakpointForPreset(DEFAULT_BPS, "1440");
      assert.equal(bp?.id, "desktop");
      assert.equal(bp?.width, 1440);
    });

    it("finds the Tablet breakpoint for Tablet", () => {
      const bp = findBreakpointForPreset(DEFAULT_BPS, "768");
      assert.equal(bp?.id, "tablet");
      assert.equal(bp?.width, 768);
    });

    it("finds the Mobile breakpoint for Mobile", () => {
      const bp = findBreakpointForPreset(DEFAULT_BPS, "375");
      assert.equal(bp?.id, "mobile");
      assert.equal(bp?.width, 375);
    });
  });

  describe("presetForBreakpoint", () => {
    it("returns 1440 for base breakpoint or null", () => {
      assert.equal(presetForBreakpoint(DEFAULT_BPS, null), "1440");
      assert.equal(presetForBreakpoint(DEFAULT_BPS, "desktop"), "1440");
    });

    it("returns 768 for Tablet breakpoint", () => {
      assert.equal(presetForBreakpoint(DEFAULT_BPS, "tablet"), "768");
    });

    it("returns 375 for Mobile breakpoint", () => {
      assert.equal(presetForBreakpoint(DEFAULT_BPS, "mobile"), "375");
    });
  });

  describe("findActiveFrameId", () => {
    it("returns the frame when the frame itself is selected", () => {
      const layers = {
        root: { id: "root", archetype: "container", parentId: null, children: ["f1"] },
        f1: { id: "f1", archetype: "container", parentId: "root", children: [] },
      };
      assert.equal(findActiveFrameId(layers, "root", ["f1"]), "f1");
    });

    it("returns the parent frame when a child inside the frame is selected", () => {
      const layers = {
        root: { id: "root", archetype: "container", parentId: null, children: ["f1"] },
        f1: { id: "f1", archetype: "container", parentId: "root", children: ["c1"] },
        c1: { id: "c1", archetype: "rectangle", parentId: "f1", children: [] },
      };
      assert.equal(findActiveFrameId(layers, "root", ["c1"]), "f1");
    });

    it("falls back to the first container frame child of root when nothing is selected", () => {
      const layers = {
        root: { id: "root", archetype: "container", parentId: null, children: ["f1", "f2"] },
        f1: { id: "f1", archetype: "container", parentId: "root", children: [] },
        f2: { id: "f2", archetype: "container", parentId: "root", children: [] },
      };
      assert.equal(findActiveFrameId(layers, "root", []), "f1");
    });
  });

  describe("planPresetAction", () => {
    it("plans create_frame when page is empty", () => {
      const layers: Record<string, Layer> = {
        root: { id: "root", archetype: "container", parentId: null, name: "Root", children: [], properties: {} } as Layer,
      };
      const plan = planPresetAction("375", layers, "root", []);
      assert.equal(plan.kind, "create_frame");
      if (plan.kind === "create_frame") {
        assert.equal(plan.preset.label, "Mobile");
        assert.equal(plan.preset.width, 375);
      }
    });

    it("plans activate_breakpoint when a frame exists", () => {
      const layers: Record<string, Layer> = {
        root: { id: "root", archetype: "container", parentId: null, name: "Root", children: ["f1"], properties: {} } as Layer,
        f1: { id: "f1", archetype: "container", parentId: "root", name: "Frame", children: [], properties: {} } as Layer,
      };
      const plan = planPresetAction("768", layers, "root", ["f1"]);
      assert.equal(plan.kind, "activate_breakpoint");
      if (plan.kind === "activate_breakpoint") {
        assert.equal(plan.frameId, "f1");
        assert.equal(plan.preset.label, "Tablet");
      }
    });

    it("plans resize_page when there are only loose layers (no frames)", () => {
      const layers: Record<string, Layer> = {
        root: { id: "root", archetype: "container", parentId: null, name: "Root", children: ["r1"], properties: {} } as Layer,
        r1: { id: "r1", archetype: "rectangle", parentId: "root", name: "Rect", children: [], properties: {} } as Layer,
      };
      const plan = planPresetAction("1440", layers, "root", []);
      assert.equal(plan.kind, "resize_page");
    });
  });
});
