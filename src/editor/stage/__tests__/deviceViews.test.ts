import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Layer } from "@/core/document/schema";
import {
  normalizeDeviceKind,
  deviceOfFrame,
  isMirrorFrame,
  getMirroredFrameId,
  getSelectedFrameId,
  planDeviceChoiceAction,
  DEVICE_SPECS,
} from "../deviceViews";

function makeContainer(id: string, name: string, props: Record<string, unknown> = {}, parentId: string | null = "page_root"): Layer {
  return {
    id,
    archetype: "container",
    name,
    parentId,
    children: [],
    properties: {
      positioning: "absolute",
      "frame.x": 0,
      "frame.y": 0,
      "frame.width": 1440,
      "frame.height": 900,
      ...props,
    },
  };
}

function makeShape(id: string, name: string, parentId: string, props: Record<string, unknown> = {}): Layer {
  return {
    id,
    archetype: "rectangle",
    name,
    parentId,
    children: [],
    properties: {
      "frame.x": 20,
      "frame.y": 20,
      "frame.width": 200,
      "frame.height": 100,
      ...props,
    },
  };
}

describe("deviceViews: device kind and frame inspection", () => {
  it("normalizes device strings accurately", () => {
    assert.equal(normalizeDeviceKind("desktop"), "desktop");
    assert.equal(normalizeDeviceKind("1440"), "desktop");
    assert.equal(normalizeDeviceKind("tablet"), "tablet");
    assert.equal(normalizeDeviceKind("768"), "tablet");
    assert.equal(normalizeDeviceKind("mobile"), "mobile");
    assert.equal(normalizeDeviceKind("375"), "mobile");
  });

  it("determines device of frame from properties and dimensions", () => {
    assert.equal(deviceOfFrame(makeContainer("c1", "Desktop", { "frame.device": "desktop" })), "desktop");
    assert.equal(deviceOfFrame(makeContainer("c2", "Tablet", { "frame.device": "tablet" })), "tablet");
    assert.equal(deviceOfFrame(makeContainer("c3", "Mobile", { "frame.device": "mobile" })), "mobile");

    // Fallback by frame.width
    assert.equal(deviceOfFrame(makeContainer("c4", "W1440", { "frame.width": 1440 })), "desktop");
    assert.equal(deviceOfFrame(makeContainer("c5", "W768", { "frame.width": 768 })), "tablet");
    assert.equal(deviceOfFrame(makeContainer("c6", "W375", { "frame.width": 375 })), "mobile");
  });

  it("identifies mirror frames and links to main frame", () => {
    const regular = makeContainer("main_1", "Main");
    const mirror = makeContainer("mirror_1", "Tablet", { "frame.mirrorOf": "main_1" });

    assert.equal(isMirrorFrame(regular), false);
    assert.equal(getMirroredFrameId(regular), null);

    assert.equal(isMirrorFrame(mirror), true);
    assert.equal(getMirroredFrameId(mirror), "main_1");
  });

  it("finds selected frame id directly or via descendants", () => {
    const rootId = "page_root";
    const main = makeContainer("main_1", "Desktop", {}, rootId);
    const child = makeShape("rect_1", "Rect", "main_1");
    const layers: Record<string, Layer> = {
      [rootId]: { id: rootId, archetype: "container", name: "Page", parentId: null, children: ["main_1"], properties: {} },
      [main.id]: main,
      [child.id]: child,
    };

    // Selecting frame directly
    assert.equal(getSelectedFrameId(layers, rootId, ["main_1"]), "main_1");

    // Selecting child layer inside frame
    assert.equal(getSelectedFrameId(layers, rootId, ["rect_1"]), "main_1");

    // Nothing selected
    assert.equal(getSelectedFrameId(layers, rootId, []), null);
  });
});

describe("deviceViews: planDeviceChoiceAction (Requirements 2a, 2b, 2c)", () => {
  const rootId = "page_root";

  it("2(a) Empty canvas: creates a new frame at origin of clicked device size", () => {
    const layers: Record<string, Layer> = {
      [rootId]: { id: rootId, archetype: "container", name: "Page", parentId: null, children: [], properties: {} },
    };

    const action = planDeviceChoiceAction({
      device: "mobile",
      layers,
      rootId,
      selectedIds: [],
    });

    assert.equal(action.kind, "create_frame");
    assert.equal(action.device.id, "mobile");
    assert.equal(action.device.width, 375);
    assert.equal(action.device.height, 812);
    assert.deepEqual(action.placement, { x: 0, y: 0 });
  });

  it("2(b) Different device selected: opens a live linked mirror to the right (120px gap, same top)", () => {
    const desktop = makeContainer("desk_1", "Desktop", {
      "frame.x": 100,
      "frame.y": 50,
      "frame.width": 1440,
      "frame.height": 900,
      "frame.device": "desktop",
    }, rootId);

    const layers: Record<string, Layer> = {
      [rootId]: { id: rootId, archetype: "container", name: "Page", parentId: null, children: ["desk_1"], properties: {} },
      [desktop.id]: desktop,
    };

    const action = planDeviceChoiceAction({
      device: "tablet",
      layers,
      rootId,
      selectedIds: ["desk_1"],
    });

    assert.equal(action.kind, "create_mirror");
    assert.equal(action.device.id, "tablet");
    assert.equal(action.device.width, 768);
    assert.equal(action.device.height, 1024);
    assert.equal(action.mainFrameId, "desk_1");
    // 100 + 1440 + 120 = 1660
    assert.deepEqual(action.placement, { x: 1660, y: 50 });
  });

  it("2(b) Clicking another device while a mirror is selected links to the main frame", () => {
    const desktop = makeContainer("desk_1", "Desktop", {
      "frame.x": 0,
      "frame.y": 0,
      "frame.width": 1440,
      "frame.height": 900,
      "frame.device": "desktop",
    }, rootId);

    const tabletMirror = makeContainer("mirror_tab", "Tablet", {
      "frame.x": 1560,
      "frame.y": 0,
      "frame.width": 768,
      "frame.height": 1024,
      "frame.device": "tablet",
      "frame.mirrorOf": "desk_1",
    }, rootId);

    const layers: Record<string, Layer> = {
      [rootId]: { id: rootId, archetype: "container", name: "Page", parentId: null, children: ["desk_1", "mirror_tab"], properties: {} },
      [desktop.id]: desktop,
      [tabletMirror.id]: tabletMirror,
    };

    // Selecting the tablet mirror and clicking Mobile creates a Mobile mirror of the desktop main frame
    const action = planDeviceChoiceAction({
      device: "mobile",
      layers,
      rootId,
      selectedIds: ["mirror_tab"],
    });

    assert.equal(action.kind, "create_mirror");
    assert.equal(action.mainFrameId, "desk_1");
    assert.equal(action.device.id, "mobile");
    // 1560 + 768 + 120 = 2448
    assert.deepEqual(action.placement, { x: 2448, y: 0 });
  });

  it("2(c) Same device selected: opens a new independent frame placed to the right", () => {
    const desktop = makeContainer("desk_1", "Desktop", {
      "frame.x": 0,
      "frame.y": 0,
      "frame.width": 1440,
      "frame.height": 900,
      "frame.device": "desktop",
    }, rootId);

    const layers: Record<string, Layer> = {
      [rootId]: { id: rootId, archetype: "container", name: "Page", parentId: null, children: ["desk_1"], properties: {} },
      [desktop.id]: desktop,
    };

    const action = planDeviceChoiceAction({
      device: "desktop",
      layers,
      rootId,
      selectedIds: ["desk_1"],
    });

    assert.equal(action.kind, "create_independent_frame");
    assert.equal(action.device.id, "desktop");
    assert.equal(action.device.width, 1440);
    // 0 + 1440 + 120 = 1560
    assert.deepEqual(action.placement, { x: 1560, y: 0 });
  });
});
