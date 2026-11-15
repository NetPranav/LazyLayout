/**
 * ROADMAP Phase 126: icons and stock media. An icon's shapes become a clean SVG; icon search ranks names well; a
 * Feather-derived icon names both licences; Openverse's results are read with their licence, author and credit line
 * (and anything without a licence, an https picture or an id is dropped); an inserted icon's asset keeps its source
 * and licence, and survives the file being saved and loaded.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import { parseMotionDocument, type Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { AssetStore, setAssetStore } from "../AssetStore";
import { MemoryAssetBackend } from "../backend";
import { FEATHER_DERIVED, iconSource, iconSvg, licenceName, openverseSearchUrl, parseOpenverse, searchIcons } from "../mediaLibrary";
import { insertIcon, setAssetSource } from "../mediaOps";

const ARROW = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }],
] as const;

describe("Phase 126: icons", () => {
  it("an icon's shapes as a clean SVG: only shapes and their geometry, stroked like the set", () => {
    const svg = iconSvg([...ARROW, ["script", { src: "x" }], ["circle", { cx: 12, cy: 12, r: 3, onclick: "x()" as unknown as string }]] as never);
    assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">/);
    assert.match(svg, /<path d="M5 12h14" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\/><path d="m12 5 7 7-7 7" /);
    assert.doesNotMatch(svg, /script|key=|onclick/);
    assert.match(svg, /<circle cx="12" cy="12" r="3" fill="none"/);
  });

  it("search: the name itself, then names starting with it, then a word starting with it, then containing it", () => {
    const names = ["arrow", "arrow-right", "move-arrow", "narrow", "circle", "arrow-up-right", "square-arrow-up"];
    assert.deepEqual(searchIcons(names, "arrow"), ["arrow", "arrow-right", "arrow-up-right", "move-arrow", "square-arrow-up", "narrow"]);
    assert.deepEqual(searchIcons(names, "arrow up"), ["arrow-up-right", "square-arrow-up"]);
    assert.equal(searchIcons(names, "").length, names.length);
  });

  it("each icon's licence: ISC, and ISC and MIT for the Feather-derived ones", () => {
    assert.equal(iconSource("sparkles").licence, "ISC");
    assert.ok(FEATHER_DERIVED.has("arrow-right"));
    assert.equal(iconSource("arrow-right").licence, "ISC and MIT (Feather)");
    assert.equal(FEATHER_DERIVED.size, 115);
  });
});

describe("Phase 126: stock photos", () => {
  it("Openverse's results with their licence, author and credit; the rest dropped", () => {
    const photos = parseOpenverse({
      results: [
        { id: "a1", title: "Harbour at dawn", url: "https://img.example/a1.jpg", thumbnail: "https://api.openverse.org/v1/images/a1/thumb/", creator: "Ana", creator_url: "https://example.org/ana", license: "by-sa", license_version: "4.0", license_url: "https://creativecommons.org/licenses/by-sa/4.0/", foreign_landing_url: "https://example.org/a1", attribution: '"Harbour at dawn" by Ana is licensed under CC BY-SA 4.0.', width: 1200, height: 800 },
        { id: "a2", url: "https://img.example/a2.jpg", license: "cc0", license_version: "1.0" },
        { id: "bad1", url: "http://insecure.example/x.jpg", license: "by" },
        { id: "bad2", url: "https://img.example/x.jpg" },
        { url: "https://img.example/y.jpg", license: "by" },
      ],
    });
    assert.deepEqual(photos.map((p) => p.id), ["a1", "a2"]);
    assert.deepEqual(photos[0].source, { kind: "photo", provider: "Openverse", id: "a1", title: "Harbour at dawn", url: "https://example.org/a1", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", author: "Ana", authorUrl: "https://example.org/ana", attribution: '"Harbour at dawn" by Ana is licensed under CC BY-SA 4.0.' });
    assert.equal(photos[1].source.licence, "CC0 1.0");
    assert.equal(photos[1].source.attribution, '"Untitled", licensed under CC0 1.0.');
    assert.equal(licenceName("pdm"), "Public Domain Mark");
    assert.equal(openverseSearchUrl("red  fox ", 2), "https://api.openverse.org/v1/images/?q=red++fox&page=2&page_size=20&mature=false");
  });
});

describe("Phase 126: in the asset store", () => {
  beforeEach(() => {
    setAssetStore(new AssetStore(new MemoryAssetBackend()));
    setDocument(createDocumentFromLayers([createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: [], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer]));
  });

  it("an inserted icon's asset keeps its source and licence, through save and load; its layers point at it", async () => {
    const ids = await insertIcon("arrow-right", ARROW as never, { x: 100, y: 100, parentId: "pg", parentOrigin: { x: 0, y: 0 } });
    assert.ok(ids.length >= 1, "editable vector layers");
    for (const id of ids) assert.ok(Number(getDocument().layers[id].properties["svg.strokeWidth"]) > 0, "drawn with a stroke");
    const assets = Object.values(getDocument().assets ?? {});
    assert.equal(assets.length, 1);
    assert.equal(assets[0].kind, "svg");
    assert.deepEqual(assets[0].source, iconSource("arrow-right"));
    for (const id of ids) assert.equal(getDocument().layers[id].properties["asset.source"], assets[0].id);
    const reloaded = parseMotionDocument(JSON.parse(JSON.stringify(getDocument())));
    assert.deepEqual(Object.values(reloaded.assets ?? {})[0].source, iconSource("arrow-right"));
    assert.equal(setAssetSource("0".repeat(64), iconSource("x")), false, "no asset, nothing recorded");
  });
});
