/**
 * ROADMAP Phase 112 in the new editor: 2,000 stars scattered in a circle stay editable at 60 fps (the layer is
 * dragged across the canvas and the frame times are measured), and Shuffle gives a new seeded layout.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
const run = (page: Page, id: string, args?: unknown) =>
  page.evaluate(({ id, args }) => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    return reg.all().find((c) => c.id === id)!.run(args);
  }, { id, args });

test.use({ viewport: { width: 1600, height: 1000 } });

test("2,000 scattered stars: drawn, dragged at 60 fps, and shuffled", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 300, "frame.height": 300, "svg.fill": "#2244aa" } });
  });
  await run(page, "selection.set", { ids: [id] });
  await run(page, "layer.addModifier", { id, type: "scatter", params: { count: 2000, shape: "star", size: 6, seed: 1 } });
  const drawn = page.locator(`[data-element-id="${id}"] path`).first();
  await expect.poll(async () => ((await drawn.getAttribute("d")) ?? "").match(/M/g)?.length ?? 0).toBe(2000);
  const first = await drawn.getAttribute("d");

  // drag the layer across the canvas and measure the frames while it moves
  const box = (await page.locator(`[data-element-id="${id}"]`).first().boundingBox())!;
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      if (w.__frames.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (let i = 1; i <= 60; i++) await page.mouse.move(sx + i * 4, sy + i * 2);
  await page.mouse.up();
  const frames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(2));
  frames.sort((a, b) => a - b);
  const median = frames[Math.floor(frames.length / 2)];
  console.log(`2,000 stars, dragging: ${frames.length} frames, median ${median.toFixed(1)} ms, p90 ${frames[Math.floor(frames.length * 0.9)].toFixed(1)} ms`);
  expect(median).toBeLessThan(17.5);
  await expect.poll(async () => Number((await layers(page))[id].properties["frame.x"])).toBeGreaterThan(100);
  // dragging doesn't change the stars
  expect(await drawn.getAttribute("d")).toBe(first);

  // Shuffle: a new seed, a new layout, still 2,000
  await page.getByRole("button", { name: "Shuffle Scatter" }).click();
  await expect.poll(async () => drawn.getAttribute("d")).not.toBe(first);
  expect(((await drawn.getAttribute("d")) ?? "").match(/M/g)?.length).toBe(2000);
});
