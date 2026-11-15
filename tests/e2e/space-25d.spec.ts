/**
 * ROADMAP Phase 127: 2.5D spaces. A frame made a 3D space holds four cards at different depths and tilts; at three
 * viewing angles the canvas and the exported site match within 0.5% of the space's pixels (real page layers in CSS
 * 3D, no 3D library). In the editor: the 3D space switch, a card's depth, the vanishing point dragged on the canvas,
 * and the orbit preview, which saves nothing and ends when something else is selected.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const run = (page: Page, id: string, args: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });

const CARDS = [
  { x: 40, y: 60, color: "#ef4444", z: -250, tx: 0, ty: 20 },
  { x: 200, y: 120, color: "#f59e0b", z: 0, tx: 10, ty: 0 },
  { x: 330, y: 70, color: "#10b981", z: 140, tx: -15, ty: -10 },
  { x: 140, y: 230, color: "#3b82f6", z: 260, tx: 0, ty: -25 },
];
const ANGLES = [
  { viewX: 0, viewY: 0 },
  { viewX: 18, viewY: -22 },
  { viewX: -12, viewY: 28 },
];

async function build(page: Page) {
  return page.evaluate((cards) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...(doc.get().layers[frame.id] as unknown as { children: string[] }).children]) doc.commands.removeLayer(c);
    const space = doc.commands.addLayer({ archetype: "container", parentId: frame.id, name: "Space", properties: { positioning: "absolute", "frame.x": 200, "frame.y": 150, "frame.width": 560, "frame.height": 400, "appearance.background.color": "#0f172a" } });
    const ids = cards.map((c) =>
      doc.commands.addLayer({ archetype: "container", parentId: space, properties: { positioning: "absolute", "frame.x": c.x, "frame.y": c.y, "frame.width": 170, "frame.height": 120, "appearance.background.color": c.color, "appearance.radius": 12 } }),
    );
    return { space, ids };
  }, CARDS);
}

test("at three viewing angles, the space on the canvas and in the export match within 0.5%", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const { space, ids } = await build(page);
  expect(await run(page, "space.make", { ids: [space], perspective: 900 })).toEqual({ changed: 1 });
  for (const [i, c] of CARDS.entries()) await run(page, "space.setDepth", { ids: [ids[i]], z: c.z, tiltX: c.tx, tiltY: c.ty });

  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
  const drawn = page.locator(`[data-stage=artboard] [data-archetype][data-element-id="${space}"]`).first();
  await page.waitForTimeout(300);
  const at = (await drawn.boundingBox())!;
  // (the space sits in the middle of the canvas, clear of the panels, with room around it)
  await page.mouse.move(800, 500);
  await page.mouse.wheel(at.x - 520, at.y - 200);
  await page.waitForTimeout(400);
  await page.mouse.move(5, 5);

  const results: string[] = [];
  const failures: string[] = [];
  for (const a of ANGLES) {
    await run(page, "space.set", { id: space, ...a });
    await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));
    await page.waitForTimeout(250);
    // the space's own box as laid out (its transform off for a moment), the same place on both sides; the clip around it
    const layoutBox = (pg: Page, sel: string) =>
      pg.evaluate((sel) => {
        const el = document.querySelector<HTMLElement>(sel)!;
        const was = el.style.transform;
        el.style.transform = "none";
        const r = el.getBoundingClientRect();
        el.style.transform = was;
        return { x: r.x, y: r.y };
      }, sel);
    const own = await layoutBox(page, `[data-stage=artboard] [data-archetype][data-element-id="${space}"]`);
    const clip = (b: { x: number; y: number }) => ({ x: Math.round(b.x) - 80, y: Math.round(b.y) - 80, width: 560 + 160, height: 400 + 160 });
    const onCanvas = PNG.sync.read(await page.screenshot({ clip: clip(own), animations: "disabled" }));

    const files = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
      return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => ({ path: f.path, text: f.text ?? "" }));
    });
    const site = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await site.route("http://export.test/**", (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
      const f = files.find((x) => x.path === path || x.path.endsWith("/" + path));
      return f ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body: f.text }) : route.fulfill({ status: 404, body: "" });
    });
    await site.goto(`http://export.test/${files.find((f) => f.path.endsWith("index.html"))!.path}`);
    await site.waitForTimeout(300);
    // the exported space: the 560 x 400 box holding the cards
    const marked = await site.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>("body *")].find((e) => e.offsetWidth === 560 && e.offsetHeight === 400);
      if (el) el.dataset.testSpace = "";
      return !!el;
    });
    expect(marked, "the space is in the export").toBe(true);
    const exportedOwn = await layoutBox(site, "[data-test-space]");
    const exported = PNG.sync.read(await site.screenshot({ clip: clip(exportedOwn), animations: "disabled" }));
    await site.close();
    const W = 720;
    const H = 560;
    const share = pixelmatch(onCanvas.data, exported.data, undefined, W, H, { threshold: 0.1 }) / (W * H);
    results.push(`view ${a.viewX}°/${a.viewY}°: ${(share * 100).toFixed(2)}%`);
    if (share > 0.005) failures.push(`view ${a.viewX}°/${a.viewY}°: ${(share * 100).toFixed(2)}% of pixels differ`);
  }
  console.log(`2.5D space: ${results.join(", ")}`);
  expect(failures).toEqual([]);
});

test("make a space in the inspector, give a card depth, drag the vanishing point, orbit without saving", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const { space, ids } = await build(page);
  const props = (id: string) => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties, id);
  const select = (id: string) => page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), id);

  await select(space);
  await page.getByRole("switch", { name: "3D space" }).click();
  await expect.poll(async () => (await props(space))["transform.style3d"]).toBe("preserve3d");
  expect((await props(space))["transform.perspective"]).toBe(900);

  // a card's depth in the inspector
  await select(ids[1]);
  const depth = page.getByLabel("Depth in space value");
  await depth.fill("200");
  await depth.press("Enter");
  await expect.poll(async () => (await props(ids[1]))["transform.translateZ"]).toBe(200);
  const card = page.locator(`[data-stage=artboard] [data-archetype][data-element-id="${ids[1]}"]`).first();
  expect(await card.evaluate((e) => getComputedStyle(e).transform)).not.toBe("none");

  // the vanishing point dragged 56 px right on the canvas (10% of the space's width at 100%)
  await select(space);
  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
  const vp = page.locator("[data-space-vanish]");
  await expect(vp).toBeVisible();
  const b = (await vp.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 56, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await props(space))["transform.origin"]).toBe("60% 50%");

  // orbit: the drawn space turns, the document doesn't change, and selecting outside the space ends it
  const before = JSON.stringify(await props(space));
  await page.getByRole("switch", { name: "Orbit preview" }).click();
  const area = page.locator("[data-space-orbit-area]");
  await expect(area).toBeVisible();
  const ab = (await area.boundingBox())!;
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move(ab.x + ab.width / 2 + 90, ab.y + ab.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  const drawn = page.locator(`[data-stage=artboard] [data-archetype][data-element-id="${space}"]`).first();
  await expect(drawn).toHaveAttribute("data-space-orbit", "");
  expect(await drawn.evaluate((e) => (e as HTMLElement).style.transform)).toMatch(/rotateY\(30deg\)/);
  expect(JSON.stringify(await props(space))).toBe(before);
  const frame = await page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].parentId!, space);
  await select(frame);
  await expect(drawn).not.toHaveAttribute("data-space-orbit", "");
  expect(await drawn.evaluate((e) => (e as HTMLElement).style.transform)).not.toMatch(/rotateY\(30deg\)/);
});
