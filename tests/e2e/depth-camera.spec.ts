/**
 * ROADMAP Phase 129: the depth camera. Five cards at different depths in a space; at 10 camera positions (pans and
 * dollies) every card's centre on screen matches the projection formula within 0.5 px (layers further away move
 * less: parallax from depth alone), and the exported site places them the same. Depth of field blurs each card by its
 * distance from the focus. Dragging the camera on the canvas pans it, one undo step.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const SW = 640;
const SH = 420;
const P = 1000;
const CARDS = [
  { x: 60, y: 80, z: -600 },
  { x: 220, y: 200, z: -250 },
  { x: 380, y: 60, z: 0 },
  { x: 120, y: 280, z: 150 },
  { x: 460, y: 250, z: 300 },
];
const CAMERAS = [
  { x: 0, y: 0, z: 0 },
  { x: 60, y: 0, z: 0 },
  { x: -80, y: 30, z: 0 },
  { x: 0, y: -50, z: 0 },
  { x: 0, y: 0, z: 200 },
  { x: 0, y: 0, z: -300 },
  { x: 40, y: 40, z: 150 },
  { x: -120, y: -20, z: -150 },
  { x: 90, y: -70, z: 250 },
  { x: -30, y: 80, z: 100 },
];

const run = (page: Page, id: string, args: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });

/** The projection formula (as `cameraProject`): the card's centre through the camera, from the space's top left. */
function formula(c: { x: number; y: number; z: number }, w: number, h: number, cam: { x: number; y: number; z: number }) {
  const vp = { x: SW / 2, y: SH / 2 };
  const k = P / (P - c.z - cam.z);
  return { x: vp.x + (c.x + w / 2 - vp.x - cam.x) * k, y: vp.y + (c.y + h / 2 - vp.y - cam.y) * k };
}

/** Each card's centre on screen, from the space's untransformed top left, found by its size. */
async function centres(pg: Page, spaceSel: string) {
  return pg.evaluate((spaceSel) => {
    const space = document.querySelector<HTMLElement>(spaceSel)!;
    const was = space.style.transform;
    space.style.transform = "none";
    const o = space.getBoundingClientRect();
    space.style.transform = was;
    const out: Record<number, { x: number; y: number; filter: string }> = {};
    for (const el of space.querySelectorAll<SVGSVGElement>("svg")) {
      const w = Number(el.getAttribute("width"));
      if (w >= 80 && w < 85) {
        const r = el.getBoundingClientRect();
        out[w] = { x: (r.left + r.right) / 2 - o.left, y: (r.top + r.bottom) / 2 - o.top, filter: getComputedStyle(el).filter };
      }
    }
    return out;
  }, spaceSel);
}

test("at 10 camera positions every card is where the projection formula says; the export the same; depth of field", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const { space, cards } = await page.evaluate(({ SW, SH, cards }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...doc.get().layers[frame.id].children]) doc.commands.removeLayer(c);
    const space = doc.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 280, "frame.y": 200, "frame.width": SW, "frame.height": SH, "appearance.background.color": "#e2e8f0" } });
    const ids = cards.map((c, i) => doc.commands.addLayer({ archetype: "rectangle", parentId: space, properties: { positioning: "absolute", "frame.x": c.x, "frame.y": c.y, "frame.width": 80 + i, "frame.height": 60, "svg.fill": "#2563eb", "svg.strokeWidth": 0 } }));
    return { space, cards: ids };
  }, { SW, SH, cards: CARDS });
  await run(page, "space.make", { ids: [space], perspective: P });
  for (const [i, c] of CARDS.entries()) await run(page, "space.setDepth", { ids: [cards[i]], z: c.z });
  await page.evaluate(() => (window as unknown as { __LL_SELECT__?: (id: string | null) => void }).__LL_SELECT__?.(null));
  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());

  const failures: string[] = [];
  let worst = 0;
  for (const cam of CAMERAS) {
    await run(page, "space.setCamera", { id: space, ...cam });
    await page.waitForTimeout(120);
    const got = await centres(page, `[data-stage=artboard] [data-archetype][data-element-id="${space}"]`);
    CARDS.forEach((c, i) => {
      const want = formula(c, 80 + i, 60, cam);
      const g = got[80 + i];
      if (!g) return failures.push(`camera ${JSON.stringify(cam)}: card ${i + 1} not drawn`);
      const off = Math.hypot(g.x - want.x, g.y - want.y);
      worst = Math.max(worst, off);
      if (off > 0.5) failures.push(`camera ${JSON.stringify(cam)}: card ${i + 1} is ${off.toFixed(2)} px from the formula`);
    });
  }
  console.log(`depth camera: worst card ${worst.toFixed(3)} px from the formula over ${CAMERAS.length} camera positions`);

  // the export, at the last camera position, with depth of field on
  await run(page, "space.setCamera", { id: space, focus: 0, aperture: 1.5 });
  await page.waitForTimeout(150);
  const stage = await centres(page, `[data-stage=artboard] [data-archetype][data-element-id="${space}"]`);
  CARDS.forEach((c, i) => {
    const want = (Math.abs(c.z) * 1.5) / 100;
    const f = stage[80 + i]?.filter ?? "";
    if (want === 0 ? f !== "none" : f !== `blur(${want}px)`) failures.push(`card ${i + 1}: filter "${f}", expected ${want === 0 ? "none" : `blur(${want}px)`}`);
  });
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
  await site.evaluate(({ SW, SH }) => {
    const el = [...document.querySelectorAll<HTMLElement>("body *")].find((e) => e.offsetWidth === SW && e.offsetHeight === SH);
    if (el) el.dataset.testSpace = "";
  }, { SW, SH });
  const exported = await centres(site, "[data-test-space]");
  await site.close();
  CARDS.forEach((_, i) => {
    const a = stage[80 + i];
    const b = exported[80 + i];
    if (!a || !b) return failures.push(`card ${i + 1} missing in the export`);
    if (Math.hypot(a.x - b.x, a.y - b.y) > 0.5) failures.push(`card ${i + 1}: the export is ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(2)} px off the canvas`);
    if (a.filter !== b.filter) failures.push(`card ${i + 1}: the export's blur "${b.filter}" isn't the canvas's "${a.filter}"`);
  });
  expect(failures).toEqual([]);
});

test("drag the camera on the canvas: it pans, one undo step", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const space = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const s = doc.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 200, "frame.y": 150, "frame.width": 500, "frame.height": 360, "appearance.background.color": "#0f172a" } });
    doc.commands.addLayer({ archetype: "rectangle", parentId: s, properties: { positioning: "absolute", "frame.x": 100, "frame.y": 100, "frame.width": 120, "frame.height": 80 } });
    return s;
  });
  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: () => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "view.zoom100")!.run());
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), space);
  await page.getByRole("switch", { name: "3D space" }).click();
  await page.getByRole("switch", { name: "Drag the camera on the canvas" }).click();
  const area = page.locator("[data-space-camera-area]");
  await expect(area).toBeVisible();
  const b = (await area.boundingBox())!;
  // (away from the middle, where the vanishing point's handle is)
  await page.mouse.move(b.x + b.width / 4, b.y + b.height / 4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 4 + 60, b.y + b.height / 4 + 20, { steps: 6 });
  await page.mouse.up();
  const cam = () => page.evaluate((id) => {
    const p = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties;
    return [p["camera.x"] ?? 0, p["camera.y"] ?? 0];
  }, space);
  await expect.poll(cam).toEqual([-60, -20]);
  await page.keyboard.press("Control+z");
  await expect.poll(cam).toEqual([0, 0]);
});
