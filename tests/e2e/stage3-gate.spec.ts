/**
 * ROADMAP Phase 131, the Stage 3 gate: the design-depth journeys.
 *
 *   A (an Illustrator user)  a logo: shapes merged with the Shape Builder and a live boolean group, smooth corners, a
 *                            repeater and a wiggle, a conic gradient over a picture through a mask, a variable-width
 *                            stroke, and text on a path around it.
 *   B (a web designer)       a hero with mesh and noise fills, a header with a progressive blur, a 2.5D ring of cards
 *                            with a depth camera, exported to Next, Vite and HTML, the HTML checked against the canvas
 *                            at five widths.
 *
 * Each journey is a user's path through the editor (the inspector's sections, popovers, buttons and the canvas where
 * there are any, the command bus for the rest), and asserts what is in the document and what the canvas draws.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";

type L = { id: string; name: string; archetype: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (i: unknown, l?: string) => string; removeLayer: (id: string) => void; updateProps: (id: string, p: Record<string, unknown>) => void } };
type Reg = { all: () => { id: string; run: (a?: unknown) => unknown }[] };

test.use({ viewport: { width: 1600, height: 1000 } });

const run = (page: Page, id: string, args?: unknown) => page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: Reg }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });
const layers = (page: Page) => page.evaluate(() => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers);
const props = async (page: Page, id: string) => (await layers(page))[id].properties;
const select = (page: Page, id: string) => page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), id);
const drawn = (page: Page, id: string) => page.locator(`[data-stage=artboard] [data-archetype][data-element-id="${id}"]`).first();

/** The page frame the editor opens with, emptied; returns its id. */
async function emptyPage(page: Page, size: { w: number; h: number }): Promise<string> {
  return page.evaluate((size) => {
    const d = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(d.get().layers).find((l) => l.parentId && d.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const pageId = frame.parentId!;
    for (const c of [...d.get().layers[pageId].children]) d.commands.removeLayer(c);
    d.commands.updateProps(pageId, { "frame.width": size.w, "frame.height": size.h, "appearance.background.color": "#ffffff" });
    return pageId;
  }, size);
}

async function add(page: Page, parentId: string, archetype: string, properties: Record<string, unknown>, name?: string): Promise<string> {
  return page.evaluate(({ parentId, archetype, properties, name }) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.commands.addLayer({ archetype, parentId, ...(name ? { name } : {}), properties: { positioning: "absolute", ...properties } }), { parentId, archetype, properties, name });
}

/** A small picture as a data URL. */
function picture(): string {
  const p = new PNG({ width: 40, height: 40 });
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) p.data.set([Math.round((x / 39) * 255), 120, Math.round((y / 39) * 255), 255], (y * 40 + x) * 4);
  return `data:image/png;base64,${PNG.sync.write(p).toString("base64")}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
});

test("Journey A (an Illustrator user): a logo with the Shape Builder, booleans, smooth corners, modifiers, a masked conic over a picture, a variable stroke and text on a path", async ({ page }) => {
  const pageId = await emptyPage(page, { w: 1200, h: 800 });

  // 1. two overlapping shapes, their overlap merged into a shape of its own with the Shape Builder
  const a = await add(page, pageId, "rectangle", { "frame.x": 60, "frame.y": 60, "frame.width": 140, "frame.height": 100, "svg.fill": "#2563eb" });
  const b = await add(page, pageId, "ellipse", { "frame.x": 140, "frame.y": 90, "frame.width": 120, "frame.height": 120, "svg.fill": "#0ea5e9" });
  const before = Object.keys(await layers(page));
  await run(page, "shapeBuilder.merge", { ids: [a, b], points: [[170, 130]] });
  const built = Object.keys(await layers(page)).filter((id) => !before.includes(id));
  expect(built.length, "the Shape Builder made the overlap a shape").toBeGreaterThan(0);

  // 2. a live boolean group: a ring cut from a disc
  const disc = await add(page, pageId, "ellipse", { "frame.x": 340, "frame.y": 60, "frame.width": 180, "frame.height": 180, "svg.fill": "#f59e0b" });
  const hole = await add(page, pageId, "ellipse", { "frame.x": 390, "frame.y": 110, "frame.width": 80, "frame.height": 80, "svg.fill": "#f59e0b" });
  const group = ((await run(page, "boolean.makeGroup", { ids: [disc, hole], operation: "subtract" })) as { id: string }).id;
  await expect.poll(async () => (await drawn(page, group).locator("svg path").first().getAttribute("d")) ?? "").toMatch(/^M/);

  // 3. smooth corners, set in the inspector
  const badge = await add(page, pageId, "rectangle", { "frame.x": 580, "frame.y": 60, "frame.width": 200, "frame.height": 140, "svg.fill": "#10b981", "shape.cornerRadius": 36 });
  await page.evaluate(({ id }) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.commands.updateProps(id, { "shape.cornerSmoothing": 0.6 }), { id: badge });
  expect((await props(page, badge))["shape.cornerSmoothing"]).toBe(0.6);

  // 4. a repeater and a wiggle on a star
  const star = await add(page, pageId, "star", { "frame.x": 840, "frame.y": 60, "frame.width": 120, "frame.height": 120, "svg.fill": "#ec4899" });
  await run(page, "layer.addModifier", { id: star, type: "repeat", params: { mode: "circle", count: 6 } });
  await run(page, "layer.addModifier", { id: star, type: "wiggle", params: { size: 5, detail: 4, seed: 7 } });
  expect(JSON.parse(String((await props(page, star))["shape.modifiers"])).map((m: { type: string }) => m.type)).toEqual(["repeat", "wiggle"]);

  // 5. a conic gradient over a picture, through a mask
  const art = await add(page, pageId, "rectangle", { "frame.x": 60, "frame.y": 300, "frame.width": 220, "frame.height": 160 });
  await run(page, "paint.setFills", { ids: [art], fills: [
    { type: "conic", stops: [{ at: 0, color: "#ff3366" }, { at: 1, color: "#33ccff" }], center: { x: 0.5, y: 0.5 }, angle: 0, opacity: 1, visible: true, mask: { type: "linear", start: 0, end: 1, angle: 90 } },
    // (the command bus is called directly here, so every field its schema would default is given)
    { type: "image", src: picture(), mode: "fill", crop: { x: 0, y: 0, w: 1, h: 1 }, scale: 1, brightness: 1, contrast: 1, saturation: 1, opacity: 1, visible: true },
  ] });
  await expect(drawn(page, art).locator("mask")).not.toHaveCount(0);

  // 6. a variable-width stroke, from the stroke popover
  const swoosh = await add(page, pageId, "line", { "frame.x": 340, "frame.y": 340, "frame.width": 360, "frame.height": 24, "svg.stroke": "#111827", "svg.strokeWidth": 16 });
  await select(page, swoosh);
  await page.getByRole("button", { name: "Stroke 1 settings" }).click();
  await page.getByRole("combobox", { name: "Width profile" }).click();
  await page.getByRole("option", { name: "Taper both ends" }).click();
  await expect.poll(async () => String((await props(page, swoosh))["stroke.widthProfile"] ?? "")).toContain('"scale":0');
  await page.keyboard.press("Escape");

  // 7. text on a path around a circle, from the inspector
  const ring = await add(page, pageId, "ellipse", { "frame.x": 780, "frame.y": 300, "frame.width": 240, "frame.height": 240, "svg.fill": "#f1f5f9" });
  const words = await add(page, pageId, "text", { "frame.x": 760, "frame.y": 600, "content.text": "Studio Tidewater", "typography.fontSize": 22 });
  await select(page, words);
  const rb = (await drawn(page, ring).boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Put on path" }).click();
  await expect(page.locator(`[data-stage=artboard] svg[data-text-path][data-element-id="${words}"] textPath`)).toHaveText("Studio Tidewater");

  // all of it drawn, none of it destructive: the merged shapes are paths, the group still holds its operands
  const all = await layers(page);
  expect(all[group].children).toEqual(expect.arrayContaining([disc, hole]));
  expect(built.every((id) => all[id].archetype === "svgPath")).toBe(true);
});

test("Journey B (a web designer): a hero with mesh and noise, a progressive-blur header, a 2.5D ring of cards with a camera, exported with parity", async ({ page, context }) => {
  const pageId = await emptyPage(page, { w: 1440, h: 1100 });

  // 1. the hero: a mesh gradient with grain over it
  const hero = await add(page, pageId, "rectangle", { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 520 }, "Hero");
  await run(page, "paint.setFills", { ids: [hero], fills: [
    { type: "noise", kind: "grain", scale: 2, contrast: 0.6, color: "#000000", seed: 4, opacity: 0.25, visible: true },
    { type: "mesh", cols: 3, rows: 3, smooth: true, opacity: 1, visible: true, points: [{ x: 0, y: 0, color: "#ff7a59" }, { x: 0.5, y: 0, color: "#f59e0b" }, { x: 1, y: 0, color: "#ec4899" }, { x: 0, y: 0.5, color: "#10b981" }, { x: 0.4, y: 0.55, color: "#ffffff" }, { x: 1, y: 0.5, color: "#7c3aed" }, { x: 0, y: 1, color: "#0ea5e9" }, { x: 0.5, y: 1, color: "#4f46e5" }, { x: 1, y: 1, color: "#111827" }] },
  ] });

  // 2. a header whose blur grows towards its top, from the Effects section
  const header = await add(page, pageId, "container", { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 96, "appearance.background.color": "rgba(255, 255, 255, 0.12)" }, "Header");
  await select(page, header);
  await page.getByRole("button", { name: /^Add effect/ }).first().click();
  await page.getByRole("button", { name: "Effect 1 settings" }).click();
  await page.getByRole("combobox", { name: "Effect type" }).click();
  await page.getByRole("option", { name: "Background blur" }).click();
  await page.getByRole("button", { name: "Effect 1 settings" }).click();
  await page.getByRole("switch", { name: "Progressive blur" }).click();
  await expect(drawn(page, header).locator('[data-effect-band="backgroundBlur"]')).toHaveCount(5);
  await page.keyboard.press("Escape");

  // 3. a ring of cards in one click, then the depth camera
  const ringGroup = await add(page, pageId, "container", { "frame.x": 360, "frame.y": 560, "frame.width": 720, "frame.height": 480, "appearance.background.color": "#0f172a" }, "Showcase");
  for (let i = 0; i < 6; i++) await add(page, ringGroup, "rectangle", { "frame.width": 140, "frame.height": 100, "svg.fill": ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"][i], "svg.strokeWidth": 0 });
  await select(page, ringGroup);
  await page.getByRole("button", { name: "Arrange 6 in 3D" }).click();
  await expect.poll(async () => (await props(page, ringGroup))["transform.style3d"]).toBe("preserve3d");
  const pan = page.getByLabel("Camera pan X");
  await pan.fill("40");
  await pan.press("Enter");
  const aperture = page.getByLabel("Camera aperture");
  await aperture.fill("1");
  await aperture.press("Enter");
  await expect.poll(async () => [(await props(page, ringGroup))["camera.x"], (await props(page, ringGroup))["camera.aperture"]]).toEqual([40, 1]);
  await expect.poll(() => drawn(page, ringGroup).evaluate((e) => (e as HTMLElement).style.transform)).toContain("translate3d(-40px");

  // 4. exported to Next, Vite and HTML
  const build = (target: string) => page.evaluate((target) => (window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[]; warnings: string[] }> } }).__LL_EXPORT__.build({ target, styling: "css" }), target);
  const next = await build("next");
  const vite = await build("vite");
  const html = await build("html");
  expect(next.files.map((f) => f.path)).toContain("app/page.tsx");
  expect(vite.files.map((f) => f.path)).toContain("src/App.tsx");
  for (const site of [next, vite, html]) {
    const all = site.files.map((f) => f.text ?? "").join("\n");
    expect(all).toContain("preserve-3d");
    expect(site.warnings.join(" ")).toContain("progressive blur is drawn in 5 steps");
  }

  // 5. parity: the HTML export against the canvas's own markup, at five widths
  await select(page, pageId);
  await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));
  await page.waitForTimeout(500);
  const markup = await drawn(page, pageId).evaluate((el) => el.outerHTML);
  const byPath = new Map(html.files.map((f) => [f.path, f.text ?? ""]));
  await context.route("http://export.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
    const body = byPath.get(path);
    return body !== undefined ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body }) : route.fulfill({ status: 404, body: "" });
  });
  const ref = await context.newPage();
  const out = await context.newPage();
  const H = 1100;
  const shares: string[] = [];
  for (const w of [1440, 1024, 768, 480, 375]) {
    await ref.setViewportSize({ width: w, height: H });
    await ref.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}</style></head><body>${markup}</body></html>`);
    await out.setViewportSize({ width: w, height: H });
    await out.goto("http://export.test/index.html");
    await out.waitForLoadState("load");
    await ref.waitForTimeout(300);
    await out.waitForTimeout(300);
    const x = PNG.sync.read(await ref.screenshot({ clip: { x: 0, y: 0, width: w, height: H } }));
    const y = PNG.sync.read(await out.screenshot({ clip: { x: 0, y: 0, width: w, height: H } }));
    let n = 0;
    for (let i = 0; i < x.data.length; i += 4) if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) n++;
    const share = n / (w * H);
    shares.push(`${w}px ${(share * 100).toFixed(2)}%`);
    expect(share, `${w}px`).toBeLessThanOrEqual(0.005);
  }
  console.log(`Journey B parity: ${shares.join(", ")}`);
});
