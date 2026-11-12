import type { Layer } from "@/core/document/schema";

/**
 * The reference scene: the collectui "Get Started" button at the video's framing. The button's box, corner radius,
 * label and shadow were measured from the video's frames; its look is only generic surface properties.
 * `overrides` lets the comparison try settings without a rebuild (`?s.surface.depth=24`).
 */
export function referenceScene(overrides: Record<string, string | number> = {}): Record<string, Layer> {
  const layer = (id: string, archetype: Layer["archetype"], parentId: string | null, children: string[], properties: Layer["properties"], name = id): Layer =>
    ({ id, name, archetype, parentId, children, properties }) as Layer;
  const button: Layer["properties"] = {
    positioning: "absolute",
    "frame.x": 133,
    "frame.y": 278,
    "frame.width": 454,
    "frame.height": 160,
    "appearance.radius": 30,
    "appearance.background.color": "#0b0b0b",
    "layout.display": "flex",
    "layout.flexDirection": "row",
    "layout.justifyContent": "center",
    "layout.alignItems": "center",
    "paint.shadows": JSON.stringify([{ kind: "drop", x: 0, y: 14, blur: 30, spread: -4, color: "rgba(0,0,0,0.28)", visible: true }]),
    "surface.mode": "inflated",
    // tuned against the reference, side by side (S8)
    "surface.depth": 55,
    "surface.fullness": 0,
    "surface.slack": 0.02,
    "surface.seed": 4,
    "surface.pressWrinkles": 1,
    "surface.dentSize": 60,
    "surface.dentDepth": 16,
    "surface.contentPull": 0.45,
    "surface.contentWarp": 0.15,
    "surface.give": 0.03,
    ...overrides,
  };
  return {
    root: layer("root", "container", null, ["button"], { "frame.width": 720, "frame.height": 720, "appearance.background.color": "#ffffff", "layout.display": "flex" }, "Page"),
    button: layer("button", "container", "root", ["label"], button, "Button"),
    label: layer("label", "text", "button", [], {
      "content.text": "Get Started",
      "text.sizing": "autoWidth",
      "typography.fontFamily": "Inter",
      "typography.fontSize": 44,
      "typography.fontWeight": 600,
      "typography.color": "#e4e4e4",
      "typography.letterSpacing": -0.4,
    }, "Label"),
  };
}
