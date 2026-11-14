import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import type { Layer } from "../../../document/schema";
import { buildSiteExport } from "../index";

const page = (children: string[]): Layer =>
  ({ ...(createLayer({ id: "p", archetype: "container", parentId: null, name: "Home", children, properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 900, "appearance.background.color": "#ffffff" } }) as Layer), page: { route: "/" } });
const button = (): Layer =>
  createLayer({ id: "b", archetype: "container", parentId: "p", name: "Buy", properties: { positioning: "absolute", "frame.x": 10, "frame.y": 10, "frame.width": 200, "frame.height": 80, "appearance.background.color": "#2563eb" } }) as Layer;

const doc = () => {
  const d = createDocumentFromLayers([page(["b"]), button()]);
  d.states = {
    s1: { id: "s1", layerId: "b", name: "hover", props: { "appearance.opacity": 0.5, "appearance.background.color": "#1d4ed8" } },
    s2: { id: "s2", layerId: "b", name: "pressed", props: { "appearance.opacity": 0.3 } },
    s3: { id: "s3", layerId: "b", name: "open", props: { "appearance.opacity": 0.1 } },
  };
  return d;
};
const sheet = (r: { files: { path: string; content: string | Uint8Array }[] }, path: string) => String(r.files.find((f) => f.path === path)?.content);

describe("states in the export (D15)", () => {
  it("Hover and Pressed become :hover and :active rules with only the difference, eased, with reduced motion honoured", async () => {
    const r = await buildSiteExport(doc(), { target: "html", styling: "css" });
    const css = sheet(r, "styles.css");
    assert.match(css, /\.buy_[a-z0-9]+:hover \{[^}]*opacity: 0\.5;/);
    assert.match(css, /\.buy_[a-z0-9]+:hover \{[^}]*background-color: #1d4ed8|\.buy_[a-z0-9]+:hover \{[^}]*background: #1d4ed8/);
    assert.match(css, /\.buy_[a-z0-9]+:active \{[^}]*opacity: 0\.3;/);
    assert.doesNotMatch(css, /:hover \{[^}]*width/); // only what differs
    assert.match(css, /transition: [^;]*opacity 0\.14s ease/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*transition: none/);
  });

  it("a custom state is not CSS, and the export says so", async () => {
    const r = await buildSiteExport(doc(), { target: "html", styling: "css" });
    assert.ok(r.warnings.some((w) => /State "open" is not exported/.test(w)));
  });

  it("a layer without states is exported as before: no transition, no pseudo rule", async () => {
    const d = createDocumentFromLayers([page(["b"]), button()]);
    const css = sheet(await buildSiteExport(d, { target: "html", styling: "css" }), "styles.css");
    assert.doesNotMatch(css, /:hover|:active|transition/);
  });

  it("Tailwind gets hover: and active: utilities, and motion-reduce:", async () => {
    const r = await buildSiteExport(doc(), { target: "next", styling: "tailwind" });
    const all = r.files.map((f) => String(f.content)).join("\n");
    assert.match(all, /hover:\[opacity:0\.5\]/);
    assert.match(all, /active:\[opacity:0\.3\]/);
    assert.match(all, /motion-reduce:\[transition:none\]/);
  });
});
