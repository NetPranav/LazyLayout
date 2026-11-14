/**
 * Design track D5: the Parent & links section wires the new editor to the engine Lane B merged (Phases 73, 76, 77).
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chooseOption, openEditor, pickShape } from "./support/editor";

type L = { id: string; name: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

async function two(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  const made: L[] = [];
  for (const [x1, y1, x2, y2] of [[0.15, 0.2, 0.3, 0.35], [0.55, 0.5, 0.7, 0.65]]) {
    const before = new Set(Object.keys(await layers(page)));
    await pickShape(page, "Rectangle");
    await page.mouse.move(b.x + b.width * x1, b.y + b.height * y1);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * x2, b.y + b.height * y2, { steps: 4 });
    await page.mouse.up();
    made.push(Object.values(await layers(page)).find((l) => !before.has(l.id))!);
  }
  return { a: made[0], b: made[1] };
}
const select = (page: Page, id: string) => page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`).click();
const pick = (page: Page, label: string, option: string) => chooseOption(page, label, option);
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const kernel = (page: Page, id: string, t: number) =>
  page.evaluate(([id, t]) => (window as unknown as { __LL_ENGINE__: { kernel: (i: string, t: number) => Record<string, unknown> } }).__LL_ENGINE__.kernel(id as string, t as number), [id, t] as const);
const motion = async (page: Page) => {
  await page.getByText("Motion", { exact: true }).first().click();
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
};

test.describe("Parent & links (D5)", () => {
  test("a ring linked to the watch at x -1 turns the other way", async ({ page }) => {
    const { a, b } = await two(page);
    // the watch turns with time: an expression on its rotation
    await select(page, a.id);
    await page.getByLabel("Expression text", { exact: true }).fill("time * 40");
    await page.getByRole("button", { name: "Set expression", exact: true }).click();
    await expect(page.locator("[data-expression-slot]")).toContainText("time * 40");
    // the ring follows its rotation at -1
    await select(page, b.id);
    await pick(page, "Link source layer", a.name);
    await page.getByLabel("Link multiplier", { exact: true }).fill("-1");
    await page.getByLabel("Link multiplier", { exact: true }).press("Enter");
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(page.locator("[data-link-slot]")).toContainText("Rotation ←");

    await motion(page);
    await expect.poll(async () => Math.round(Number((await kernel(page, a.id, 1.5))["transform.rotate"]))).toBe(60);
    expect(Math.round(Number((await kernel(page, b.id, 1.5))["transform.rotate"]))).toBe(-60);
    expect(Math.round(Number((await kernel(page, b.id, 0))["transform.rotate"]) || 0)).toBe(0);
  });

  test("a link that would close a cycle is refused with a message", async ({ page }) => {
    const { a, b } = await two(page);
    await select(page, b.id);
    await pick(page, "Link source layer", a.name);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(page.locator("[data-link-slot]")).toHaveCount(1);
    await select(page, a.id);
    await pick(page, "Link source layer", b.name);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(page.getByRole("alert", { name: "Link or expression error" })).toContainText("LINK_CYCLE");
    expect((await layers(page))[a.id].properties["link.1.target"]).toBeUndefined();
  });

  test("an expression evaluates, and a bad one says why", async ({ page }) => {
    const { a } = await two(page);
    await select(page, a.id);
    await page.getByLabel("Expression text", { exact: true }).fill("time *");
    await page.getByRole("button", { name: "Set expression", exact: true }).click();
    await expect(page.getByRole("alert", { name: "Link or expression error" })).toBeVisible();
    await page.getByLabel("Expression text", { exact: true }).fill("time * 40");
    await page.getByRole("button", { name: "Set expression", exact: true }).click();
    await expect(page.locator("[data-expression-slot]")).toContainText("time * 40");
    await motion(page);
    await expect.poll(async () => Math.round(Number((await kernel(page, a.id, 1.5))["transform.rotate"]))).toBe(60);
  });

  test("parenting keeps the layer where it is, and clearing the parent keeps it too", async ({ page }) => {
    const { a, b } = await two(page);
    const box = (id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first().boundingBox();
    const before = (await box(b.id))!;
    await select(page, b.id);
    await pick(page, "Parent layer", a.name);
    await expect.poll(async () => (await layers(page))[b.id].properties["transform.parent"] ?? "").toBe(a.id);
    const after = (await box(b.id))!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    await page.waitForTimeout(700); // the first dropdown is still closing; a second one opened now does not draw its list
    await pick(page, "Parent layer", "None");
    await expect.poll(async () => (await layers(page))[b.id].properties["transform.parent"] ?? "").toBe("");
    const cleared = (await box(b.id))!;
    expect(Math.abs(cleared.x - before.x)).toBeLessThan(2);
  });

  test("Opposite is one click, and a range maps one span of values onto another (D7)", async ({ page }) => {
    const { a, b } = await two(page);
    await select(page, a.id);
    await page.getByLabel("Expression text", { exact: true }).fill("time * 40");
    await page.getByRole("button", { name: "Set expression", exact: true }).click();
    await expect(page.locator("[data-expression-slot]")).toContainText("time * 40");

    // one click: the ring does the opposite
    await select(page, b.id);
    await pick(page, "Link source layer", a.name);
    await page.getByRole("button", { name: "Add opposite link", exact: true }).click();
    await expect(page.locator("[data-link-slot]")).toHaveCount(1);

    // a range: the watch's rotation 0..120 becomes the ring's opacity 0..1
    await page.waitForTimeout(700);
    await pick(page, "Link property", "Opacity");
    await page.waitForTimeout(700);
    await pick(page, "Link map", "Range");
    await set(page, "Link range from min", 0);
    await set(page, "Link range from max", 120);
    await set(page, "Link range to min", 0);
    await set(page, "Link range to max", 1);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(page.locator("[data-link-slot]")).toHaveCount(2);

    await motion(page);
    await expect.poll(async () => Math.round(Number((await kernel(page, b.id, 1.5))["transform.rotate"]))).toBe(-60);
    expect(Number((await kernel(page, b.id, 1.5))["appearance.opacity"])).toBeCloseTo(0.5, 3); // 60 on a 0..120 range
    expect(Number((await kernel(page, b.id, 6))["appearance.opacity"])).toBeCloseTo(1, 3); // 240 is past the end: held at 1
  });

  test("Pick on canvas: click the layer to follow instead of choosing it from a list (D5)", async ({ page }) => {
    const { a, b } = await two(page);
    await select(page, b.id);
    await page.getByRole("button", { name: "Pick on canvas", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pick on canvas", exact: true })).toHaveAttribute("aria-pressed", "true");
    await select(page, a.id); // the click on the canvas picks it
    await expect(page.getByRole("button", { name: "Pick on canvas", exact: true })).toHaveAttribute("aria-pressed", "false");
    // the selection is back on the layer being linked, not left on the one that was picked
    await expect.poll(async () => await page.getByRole("button", { name: "Add link", exact: true }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "Add link", exact: true }).click();
    await expect(page.locator("[data-link-slot]")).toHaveCount(1);
    const l = await layers(page);
    expect(l[b.id].properties["link.1.source"]).toBe(a.id); // b follows a, as picked
    expect(l[a.id].properties["link.1.source"]).toBeUndefined(); // and a was not changed
  });

  test("links and expressions are in the export: an exported page turns the watch and the ring the opposite way (D5, D7)", async ({ page, browser }, testInfo) => {
    const { a, b } = await two(page);
    await select(page, a.id);
    await page.getByLabel("Expression text", { exact: true }).fill("time * 40");
    await page.getByRole("button", { name: "Set expression", exact: true }).click();
    await expect(page.locator("[data-expression-slot]")).toContainText("time * 40");
    await select(page, b.id);
    await pick(page, "Link source layer", a.name);
    await page.getByRole("button", { name: "Add opposite link", exact: true }).click();
    await expect(page.locator("[data-link-slot]")).toHaveCount(1);

    const built = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
      return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });
    expect(built.warnings.filter((x) => /link|expression/i.test(x))).toEqual([]); // nothing is left out
    const dir = testInfo.outputPath("export-links");
    for (const f of built.files) {
      if (f.text === undefined) continue;
      const p = join(dir, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.text);
    }
    const open = async (reduced: boolean) => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await ctx.newPage();
      await p.goto(`file://${join(dir, "index.html")}`);
      return { ctx, p };
    };
    const turns = (p: Page) =>
      p.evaluate(([ia, ib]) => {
        const get = (id: string) => parseFloat((document.querySelector(`[data-ll="${id}"]`) as HTMLElement).style.rotate || "0");
        return { watch: get(ia), ring: get(ib) };
      }, [a.id, b.id]);

    const live = await open(false);
    await live.p.waitForTimeout(1200);
    const one = await turns(live.p);
    await live.p.waitForTimeout(800);
    const two2 = await turns(live.p);
    expect(one.watch, "the watch is turning with time").toBeGreaterThan(20);
    expect(two2.watch).toBeGreaterThan(one.watch + 10);
    expect(Math.abs(one.ring + one.watch), "the ring does the opposite").toBeLessThan(0.01);
    expect(Math.abs(two2.ring + two2.watch)).toBeLessThan(0.01);
    await live.ctx.close();

    const still = await open(true);
    await still.p.waitForTimeout(800);
    expect(await turns(still.p)).toEqual({ watch: 0, ring: 0 }); // reduced motion: the page as designed
    await still.ctx.close();
  });
});
