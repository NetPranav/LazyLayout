/**
 * ROADMAP Phase 87 gate: the Motion engine adapter on the stage.
 *   - Motion is loaded lazily once the stage's engine starts;
 *   - a layer that animates its layout changes travels to its new place instead of jumping, and a second change while
 *     it travels never snaps (its drawn place is sampled on every frame);
 *   - a layer with a way to appear plays it when the stage goes live, and one with a way to disappear leaves a copy
 *     that fades and is removed.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

type L = { id: string; name: string; properties: Record<string, unknown> };
type Win = {
  __LL_TEST__: boolean;
  __LL_SELECT__: (id: string) => void;
  __LL_ENGINE__?: { motion: () => boolean };
  __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (a: unknown) => string; updateProps: (id: string, p: Record<string, unknown>) => void; removeLayer: (id: string) => void } };
};
test.use({ viewport: { width: 1600, height: 1000 } });
const props = (page: Page, id: string) => page.evaluate((x) => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get().layers[x]?.properties ?? null)) as Record<string, unknown> | null, id);
const SEL = (id: string) => `[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`;

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const d = (window as unknown as Win).__LL_DOC__;
    const hero = Object.values(d.get().layers).find((l) => l.name === "Hero")!;
    return d.commands.addLayer({ archetype: "container", parentId: hero.id, name: "Card", properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 120, "frame.height": 60, "layout.padding": 0, "appearance.background.color": "#2563eb" } });
  });
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
  await page.locator('[data-section="transition"]').scrollIntoViewIfNeeded();
  return id;
}
/** Samples, on every frame, how far below its parent's top the card is drawn (in the parent's own px, whatever the zoom) and its opacity. */
async function sample(page: Page, id: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const parent = el.offsetParent as HTMLElement;
    const w = window as unknown as { __ys: number[]; __os: number[]; __stop: boolean };
    w.__ys = [];
    w.__os = [];
    w.__stop = false;
    const tick = () => {
      const k = parent.getBoundingClientRect().width / parent.offsetWidth || 1;
      w.__ys.push((el.getBoundingClientRect().top - parent.getBoundingClientRect().top) / k);
      w.__os.push(Number(getComputedStyle(el).opacity));
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, SEL(id));
}
const stop = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __ys: number[]; __os: number[]; __stop: boolean };
    w.__stop = true;
    return { ys: w.__ys, os: w.__os };
  });
const drawnY = (page: Page, id: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const parent = el.offsetParent as HTMLElement;
    const k = parent.getBoundingClientRect().width / parent.offsetWidth || 1;
    return (el.getBoundingClientRect().top - parent.getBoundingClientRect().top) / k;
  }, SEL(id));
const biggestStep = (xs: number[]) => xs.reduce((m, x, i) => (i === 0 ? 0 : Math.max(m, Math.abs(x - xs[i - 1]))), 0);
const moveTo = (page: Page, id: string, y: number) => page.evaluate(([i, v]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, { "frame.y": v }), [id, y] as const);
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};

test("Phase 87: a layout change travels on the layer's spring, and a second change on the way never snaps", async ({ page }) => {
  const id = await setup(page);
  await page.getByLabel("Animate layout changes", { exact: true }).click();
  await expect.poll(async () => (await props(page, id))?.["layoutMotion.on"]).toBe(true);
  await set(page, "Transition time", 0.8);
  await set(page, "Transition bounce", 0);
  await expect.poll(async () => (await props(page, id))?.["transition.duration"]).toBe(0.8);

  await page.getByLabel("Show states live on the canvas").click();
  // Motion is loaded once the engine runs, as a chunk of its own
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_ENGINE__?.motion() ?? false), { timeout: 10_000 }).toBe(true);
  const start = await drawnY(page, id);
  await page.waitForTimeout(150);

  await sample(page, id);
  await moveTo(page, id, 240);
  await expect.poll(() => drawnY(page, id), { timeout: 8000 }).toBeCloseTo(start + 200, 0);
  let { ys } = await stop(page);
  expect(ys.filter((y) => y > start + 5 && y < start + 195).length, `frames caught on the way (${ys.length} sampled)`).toBeGreaterThan(8);
  expect(biggestStep(ys), "the biggest move in one frame, of 200 px").toBeLessThan(40);

  // interrupted three times, each long before it arrives
  await sample(page, id);
  for (const y of [40, 240, 40]) {
    await moveTo(page, id, y);
    await page.waitForTimeout(120);
  }
  await expect.poll(() => drawnY(page, id), { timeout: 8000 }).toBeCloseTo(start, 0);
  ({ ys } = await stop(page));
  expect(biggestStep(ys), "interrupted: the biggest move in one frame").toBeLessThan(40);
  // at rest the element is as React drew it
  expect(await page.locator(SEL(id)).evaluate((e) => (e as HTMLElement).style.translate)).toBe("");
});

test("Phase 87: a layer appears when the stage goes live, and leaves a copy that fades when it is deleted", async ({ page }) => {
  const id = await setup(page);
  await chooseOption(page, "How the layer appears", "Fades and rises");
  await expect.poll(async () => (await props(page, id))?.["presence.enter"]).toBe("rise");
  await chooseOption(page, "How the layer disappears", "Fades");
  await expect.poll(async () => (await props(page, id))?.["presence.exit"]).toBe("fade");
  await set(page, "Transition time", 0.8);
  await set(page, "Transition bounce", 0);

  await sample(page, id);
  await page.getByLabel("Show states live on the canvas").click();
  await page.waitForTimeout(1500);
  const { os, ys } = await stop(page);
  expect(Math.min(...os), "it began nearly invisible").toBeLessThan(0.5);
  expect(os[os.length - 1], "and ended fully there").toBe(1);
  expect(Math.max(...ys) - ys[ys.length - 1], "it rose into place").toBeGreaterThan(5);
  expect(biggestStep(os.slice(os.indexOf(Math.min(...os)))), "fading in smoothly").toBeLessThan(0.25);

  await page.evaluate((i) => (window as unknown as Win).__LL_DOC__.commands.removeLayer(i), id);
  await expect(page.locator("[data-ll-leaving]")).toHaveCount(1);
  await expect(page.locator("[data-ll-leaving]")).toHaveCount(0, { timeout: 8000 });
  expect(await props(page, id)).toBeNull();

  // back to "At once": nothing is written for it any more
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await props(page, id))?.["presence.exit"]).toBe("fade");
});
