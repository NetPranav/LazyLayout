/**
 * ROADMAP Phase 79 gate: a layer moves between its states on a transition, and quick interruptions never snap.
 *   - the Transition section sets the layer's transition (spring or tween, time, bounce) and a property of its own;
 *   - with the states live, the pointer is moved on and off the layer 10 times, far quicker than one move takes, while
 *     the drawn opacity is sampled on every frame: no frame-to-frame step is a jump, the layer is caught on the way,
 *     and it ends at rest in the base.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor, pickShape } from "./support/editor";

type L = { id: string; properties: Record<string, unknown> };
type Win = { __LL_TEST__: boolean; __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addState: (layerId: string, name: string, props: Record<string, unknown>, label?: string) => string } } };
const props = (page: Page, id: string) => page.evaluate((x) => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get().layers[x].properties)) as Record<string, unknown>, id);

test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(await page.evaluate(() => Object.keys((window as unknown as Win).__LL_DOC__.get().layers)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.45, { steps: 4 });
  await page.mouse.up();
  const id = (await page.evaluate(() => Object.keys((window as unknown as Win).__LL_DOC__.get().layers))).find((k) => !before.has(k))!;
  // a hover state that fades the layer most of the way out
  await page.evaluate((x) => (window as unknown as Win).__LL_DOC__.commands.addState(x, "hover", { "appearance.opacity": 0.2 }, "Add state"), id);
  return id;
}
const node = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first();
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};

test("Phase 79: the Transition section sets how a layer moves between its states", async ({ page }) => {
  const id = await setup(page);
  const section = page.locator('[data-section="transition"]');
  await section.scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Transition bounce", { exact: true })).toBeVisible(); // a spring by default

  await chooseOption(page, "Transition type", "Tween");
  await expect.poll(async () => (await props(page, id))["transition.type"]).toBe("tween");
  await expect(page.getByLabel("Transition bounce", { exact: true })).toHaveCount(0);
  await chooseOption(page, "Transition curve", "Linear");
  await expect.poll(async () => (await props(page, id))["transition.curve"]).toBe("linear");
  await set(page, "Transition time", 0.6);
  await expect.poll(async () => (await props(page, id))["transition.duration"]).toBe(0.6);

  // a property of its own: only what a state changes is offered
  await chooseOption(page, "Add property transition", "Appearance opacity");
  await expect.poll(async () => (await props(page, id))["transition.1.property"]).toBe("appearance.opacity");
  await set(page, "Appearance opacity transition time", 1.5);
  await expect.poll(async () => (await props(page, id))["transition.1.duration"]).toBe(1.5);
  await page.getByRole("button", { name: "Remove transition of Appearance opacity", exact: true }).click();
  await expect.poll(async () => (await props(page, id))["transition.1.property"]).toBeUndefined();

  await chooseOption(page, "Transition type", "Spring");
  await set(page, "Transition bounce", 30);
  await expect.poll(async () => (await props(page, id))["transition.bounce"]).toBe(0.3);
});

test("Phase 79: hovering on and off a layer 10 times quickly never snaps", async ({ page }) => {
  const id = await setup(page);
  // a slow, flat spring, so every one of the ten moves is interrupted long before it arrives
  await set(page, "Transition time", 0.8);
  await set(page, "Transition bounce", 0);
  await page.getByLabel("Show states live on the canvas").click();
  const box = (await node(page, id).boundingBox())!;
  const on = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const offPoint = { x: box.x + box.width + 300, y: box.y + box.height + 200 };
  await page.mouse.move(offPoint.x, offPoint.y);

  // sample the drawn opacity on every frame while the pointer goes on and off
  await page.evaluate((x) => {
    const el = document.querySelector(`[data-testid="stage-page"] [data-archetype][data-element-id="${x}"]`) as HTMLElement;
    const samples: number[] = [];
    (window as unknown as { __samples: number[]; __stop: boolean }).__samples = samples;
    const tick = () => {
      samples.push(Number(getComputedStyle(el).opacity));
      if (!(window as unknown as { __stop: boolean }).__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, id);
  for (let i = 0; i < 10; i++) {
    const to = i % 2 === 0 ? on : offPoint;
    await page.mouse.move(to.x, to.y);
    await page.waitForTimeout(90);
  }
  // the last move was off the layer: it comes back to the base
  await expect.poll(() => node(page, id).evaluate((e) => Number(getComputedStyle(e as HTMLElement).opacity)), { timeout: 8000 }).toBeCloseTo(1, 2);
  const samples = await page.evaluate(() => {
    (window as unknown as { __stop: boolean }).__stop = true;
    return (window as unknown as { __samples: number[] }).__samples;
  });

  let biggest = 0;
  for (let i = 1; i < samples.length; i++) biggest = Math.max(biggest, Math.abs(samples[i] - samples[i - 1]));
  const lowest = Math.min(...samples);
  // the state changes the opacity by 0.8; a snap would be most of that in one frame
  expect(biggest, `the biggest change of opacity in one frame, over ${samples.length} frames`).toBeLessThan(0.2);
  expect(lowest, "the layer was caught on its way: it began to fade").toBeLessThan(0.97);
  expect(lowest, "and never got to the state before being turned back").toBeGreaterThan(0.25);
});
