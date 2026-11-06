/**
 * Which property an inspector field is for the layer it is shown for: a shape is painted by svg.fill, svg.stroke and
 * svg.strokeWidth, a box by its background and border, and a field the layer has not set shows the engine's default,
 * never "Mixed".
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Layer } from "@/core/document/schema";
import { isSvgPainted, propertyFor, readFor, valueFor } from "../shapeProps";

const layer = (archetype: string, properties: Record<string, unknown> = {}) => ({ archetype, properties }) as unknown as Layer;

describe("inspector fields on shapes and boxes", () => {
  it("rectangle, ellipse, polygon, star, line and arrow are painted as shapes; frames, text and buttons are boxes", () => {
    for (const a of ["rectangle", "ellipse", "polygon", "star", "line", "arrow", "svgPath"]) assert.equal(isSvgPainted(layer(a)), true, a);
    for (const a of ["container", "text", "button", "image"]) assert.equal(isSvgPainted(layer(a)), false, a);
  });

  it("a shape's fill and stroke fields are its svg properties; a box keeps the box properties", () => {
    const shape = layer("rectangle");
    assert.equal(propertyFor(shape, "appearance.background.color"), "svg.fill");
    assert.equal(propertyFor(shape, "backgroundColor"), "svg.fill");
    assert.equal(propertyFor(shape, "appearance.border.color"), "svg.stroke");
    assert.equal(propertyFor(shape, "appearance.border.width"), "svg.strokeWidth");
    assert.equal(propertyFor(shape, "appearance.opacity"), "appearance.opacity");
    const box = layer("container");
    for (const k of ["appearance.background.color", "appearance.border.color", "appearance.border.width", "appearance.border.style"]) assert.equal(propertyFor(box, k), k);
  });

  it("a border style is a dash pattern on a shape, and unchanged on a box", () => {
    const shape = layer("ellipse");
    assert.equal(propertyFor(shape, "appearance.border.style"), "svg.strokeDasharray");
    assert.equal(valueFor(shape, "appearance.border.style", "solid"), "none");
    assert.notEqual(valueFor(shape, "appearance.border.style", "dashed"), "none");
    assert.equal(valueFor(layer("container"), "appearance.border.style", "dashed"), "dashed");
    assert.equal(valueFor(shape, "appearance.background.color", "#ff0000"), "#ff0000");
  });

  it("reads the property the layer is painted by, and no colour for none or currentColor", () => {
    assert.equal(readFor(layer("rectangle", { "svg.fill": "#cbd5e1" }), "appearance.background.color"), "#cbd5e1");
    assert.equal(readFor(layer("line", { "svg.fill": "none" }), "appearance.background.color"), undefined);
    assert.equal(readFor(layer("star", { "svg.stroke": "currentColor" }), "appearance.border.color"), undefined);
    assert.equal(readFor(layer("container", { "appearance.background.color": "#fff" }), "appearance.background.color"), "#fff");
  });

  it("rotation, opacity and radius that a layer has not set show the engine's default, not Mixed; other unset fields stay unset", () => {
    const fresh = layer("rectangle");
    assert.equal(readFor(fresh, "frame.rotation"), 0);
    assert.equal(readFor(fresh, "appearance.opacity"), 1);
    assert.equal(readFor(fresh, "appearance.radius"), 0);
    assert.equal(readFor(layer("rectangle", { "appearance.opacity": 0.4 }), "appearance.opacity"), 0.4);
    assert.equal(readFor(fresh, "frame.width"), undefined, "an unset size is not guessed");
  });
});
