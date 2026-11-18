/**
 * ROADMAP Phase 80 gate: a toggle component animates between its Off and On variants.
 *   - switching an instance's variant in the inspector moves the knob there on the instance's transition: the drawn
 *     position is sampled on every frame, never jumps, and ends on what the document says;
 *   - an instance set to switch on a click does so on the canvas with the states live, without changing the document.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

type L = { id: string; name: string; parentId: string | null; children: string[]; componentMain?: string; instance?: { component: string; source: string; root?: boolean; variant?: Record<string, string> }; properties: Record<string, unknown> };
type D = { layers: Record<string, L>; designComponents?: Record<string, { mainId: string; variants?: { mainId: string; values: Record<string, string> }[] }> };
type Win = { __LL_TEST__: boolean; __LL_SELECT__: (id: string) => void; __LL_DOC__: { get: () => D; commands: { addLayer: (a: unknown) => string; updateProps: (id: string, p: Record<string, unknown>) => void } } };
test.use({ viewport: { width: 1600, height: 1000 } });
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get())) as D);
const select = (page: Page, id: string) => page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
const node = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first();
/** How far the knob is from the left edge of its toggle, in the toggle's own px (60 wide), whatever the zoom: 2 when Off, 30 when On. */
const knobX = (page: Page, ids: { inst: string; knob: string }) =>
  page.evaluate(({ inst, knob }) => {
    const q = (x: string) => (document.querySelector(`[data-testid="stage-page"] [data-archetype][data-element-id="${x}"]`) as HTMLElement).getBoundingClientRect();
    return ((q(knob).left - q(inst).left) / q(inst).width) * 60;
  }, ids);
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};

/** A toggle component (Off: knob at 2 px; On: knob at 30 px, green track) and one instance of it. */
async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const d = (window as unknown as Win).__LL_DOC__;
    const hero = Object.values(d.get().layers).find((l) => l.name === "Hero")!;
    const track = d.commands.addLayer({ archetype: "container", parentId: hero.id, name: "Toggle", properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 60, "frame.height": 32, "layout.padding": 0, "appearance.background.color": "#cccccc" } });
    d.commands.addLayer({ archetype: "container", parentId: track, name: "Knob", properties: { positioning: "absolute", "frame.x": 2, "frame.y": 2, "frame.width": 28, "frame.height": 28, "layout.padding": 0, "appearance.background.color": "#ffffff" } });
    return track;
  });
  await select(page, id);
  await page.getByRole("button", { name: "Create component", exact: true }).click();
  await expect.poll(async () => !!(await doc(page)).layers[id]?.componentMain).toBe(true);
  const compId = (await doc(page)).layers[id].componentMain!;
  await page.getByLabel("Variant property name").fill("On");
  await page.getByLabel("Variant values").fill("Off, On");
  await page.getByRole("button", { name: "Add variant property", exact: true }).click();
  await expect.poll(async () => (await doc(page)).designComponents?.[compId]?.variants?.length ?? 0).toBe(2);
  let d = await doc(page);
  const onMain = d.designComponents![compId].variants!.find((v) => v.values.On === "On")!.mainId;
  const onKnob = d.layers[onMain].children[0];
  await page.evaluate(([m, k]) => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    c.updateProps(m, { "appearance.background.color": "#00aa00" });
    c.updateProps(k, { "frame.x": 30 });
  }, [onMain, onKnob]);
  await select(page, id);
  await page.getByRole("button", { name: "Insert instance", exact: true }).click();
  await expect.poll(async () => Object.values((await doc(page)).layers).filter((l) => l.instance?.root && l.instance.component === compId).length).toBe(1);
  d = await doc(page);
  const inst = Object.values(d.layers).find((l) => l.instance?.root && l.instance.component === compId)!;
  await select(page, inst.id);
  await expect(page.getByRole("status").filter({ hasText: "Instance of" })).toBeVisible();
  return { inst: inst.id, knob: inst.children[0] };
}

async function sample(page: Page, ids: { inst: string; knob: string }) {
  await page.evaluate(({ inst, knob }) => {
    const q = (x: string) => (document.querySelector(`[data-testid="stage-page"] [data-archetype][data-element-id="${x}"]`) as HTMLElement).getBoundingClientRect();
    const w = window as unknown as { __samples: number[]; __stop: boolean };
    w.__samples = [];
    w.__stop = false;
    const tick = () => {
      w.__samples.push(((q(knob).left - q(inst).left) / q(inst).width) * 60);
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ids);
}
const stop = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __samples: number[]; __stop: boolean };
    w.__stop = true;
    return w.__samples;
  });
const biggestStep = (xs: number[]) => xs.reduce((m, x, i) => (i === 0 ? 0 : Math.max(m, Math.abs(x - xs[i - 1]))), 0);

test("Phase 80: switching an instance's variant animates the toggle, and quick switches never snap", async ({ page }) => {
  const ids = await setup(page);
  const { inst, knob } = ids;
  // a slow, flat spring so the move is easy to catch
  await page.locator('[data-section="transition"]').scrollIntoViewIfNeeded();
  await set(page, "Transition time", 0.8);
  await set(page, "Transition bounce", 0);
  await expect.poll(async () => (await doc(page)).layers[inst].properties["transition.duration"]).toBe(0.8);
  expect(await knobX(page, ids)).toBeCloseTo(2, 1);
  // Design draws the page at rest; with the states live (as in Preview) the stage's engine draws it
  await page.getByLabel("Show states live on the canvas").click();
  await page.waitForTimeout(200);

  await sample(page, ids);
  await chooseOption(page, "Variant On", "On");
  await expect.poll(async () => (await doc(page)).layers[inst].instance?.variant?.On).toBe("On");
  await expect.poll(() => knobX(page, ids), { timeout: 8000 }).toBeCloseTo(30, 1);
  let xs = await stop(page);
  const moving = xs.filter((x) => x > 2.5 && x < 29.5);
  expect(moving.length, `frames caught on the way (${xs.length} sampled)`).toBeGreaterThan(8);
  expect(biggestStep(xs), "the biggest move in one frame, of 28 px").toBeLessThan(8);
  expect((await doc(page)).layers[knob].properties["frame.x"]).toBe(30);

  // ten quick switches from the inspector, each long before the last one has arrived
  await set(page, "Transition time", 3);
  await sample(page, ids);
  for (let i = 0; i < 10; i++) await chooseOption(page, "Variant On", i % 2 === 0 ? "Off" : "On");
  await expect.poll(async () => (await doc(page)).layers[inst].instance?.variant?.On).toBe("On");
  await expect.poll(() => knobX(page, ids), { timeout: 15000 }).toBeCloseTo(30, 1);
  xs = await stop(page);
  expect(biggestStep(xs), "ten quick switches: the biggest move in one frame").toBeLessThan(8);
  expect(Math.min(...xs), "it was turned back before it got to Off").toBeGreaterThan(3);
});

test("Phase 80: an instance set to switch on a click does, with the states live, and the document keeps its variant", async ({ page }) => {
  const ids = await setup(page);
  const { inst } = ids;
  await chooseOption(page, "Variant switches on", "A click");
  await expect.poll(async () => (await doc(page)).layers[inst].properties["variantTrigger.on"]).toBe("click");
  await expect(page.getByLabel("Variant trigger value", { exact: true })).toBeVisible();

  await page.getByLabel("Show states live on the canvas").click();
  const box = (await node(page, inst).boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => knobX(page, ids), { timeout: 8000 }).toBeCloseTo(30, 1);
  expect((await doc(page)).layers[inst].instance?.variant?.On ?? "Off").toBe("Off");
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => knobX(page, ids), { timeout: 8000 }).toBeCloseTo(2, 1);

  // off again: nothing switches
  await chooseOption(page, "Variant switches on", "Nothing");
  await expect.poll(async () => (await doc(page)).layers[inst].properties["variantTrigger.on"]).toBeUndefined();
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(400);
  expect(await knobX(page, ids)).toBeCloseTo(2, 1);
});
