/**
 * Design track D4: a driver (a binding) makes a layer react to the pointer. The engine runs in Motion and Preview; in Design
 * the canvas shows the design itself.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));

test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const drawnBox = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first().boundingBox();

test.describe("Drivers (D4)", () => {
  test("the pointer drives a layer's position in Motion; Design shows the design", async ({ page }) => {
    const r = await setup(page);
    const designX = (await drawnBox(page, r.id))!.x;

    await page.getByText("Motion", { exact: true }).first().click();
    await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
    await page.evaluate(
      ([id]) => (window as unknown as { __LL_ENGINE__: { addBinding: (t: string, o: string) => string } }).__LL_ENGINE__.addBinding(`pointer.x |> remap(0, 1000, 0, 300)\n-> ${id}.transform.x blend add`, id),
      [r.id],
    );

    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const at = async (fx: number) => {
      await page.mouse.move(page0.x + page0.width * fx, page0.y + page0.height * 0.8, { steps: 6 });
      await page.waitForTimeout(250);
      return (await drawnBox(page, r.id))!.x;
    };
    const left = await at(0.1);
    const right = await at(0.9);
    expect(right - left, "moving the pointer right moves the layer right").toBeGreaterThan(40);

    // the document itself is unchanged: a driver is behaviour, not a stored position
    expect((await layers(page))[r.id].properties["transform.x"] ?? 0).toBe(r.properties["transform.x"] ?? 0);

    // and Design shows the design again
    await page.getByText("Design", { exact: true }).first().click();
    await expect.poll(async () => Math.abs((await drawnBox(page, r.id))!.x - designX)).toBeLessThan(1.5);
  });

  test("the Driven by section adds, turns off and removes a driver", async ({ page }) => {
    const r = await setup(page);
    const section = page.getByText("Driven by", { exact: true }).first();
    await expect(section).toBeVisible();

    // defaults: pointer left to right drives Position X
    await page.getByRole("button", { name: "Add driver", exact: true }).click();
    const bindings = async () => Object.values(((await page.evaluate(() => (window as unknown as { __LL_DOC__: { get: () => { bindings: Record<string, unknown> } } }).__LL_DOC__.get().bindings)) ?? {}) as Record<string, { enabled: boolean; ownerLayerId: string; target: { path: string } }>);
    await expect.poll(async () => (await bindings()).length).toBe(1);
    const [b] = await bindings();
    expect(b.ownerLayerId).toBe(r.id);
    expect(b.target.path).toBe("transform.x");
    await expect(page.locator("[data-driver-id]")).toContainText("Pointer, left to right → Position X");

    // turn it off, then on, then remove
    await page.getByRole("button", { name: /^Turn off driver/ }).click();
    await expect.poll(async () => (await bindings())[0].enabled).toBe(false);
    await page.getByRole("button", { name: /^Turn on driver/ }).click();
    await expect.poll(async () => (await bindings())[0].enabled).toBe(true);
    await page.getByRole("button", { name: /^Remove driver/ }).click();
    await expect.poll(async () => (await bindings()).length).toBe(0);

    // one undo step brings it back
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(async () => (await bindings()).length).toBe(1);
  });

  test("a driver made in the panel moves the layer with the pointer in Motion", async ({ page }) => {
    const r = await setup(page);
    const designX = (await drawnBox(page, r.id))!.x;
    await page.getByRole("button", { name: "Add driver", exact: true }).click();
    await page.getByText("Motion", { exact: true }).first().click();
    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const at = async (fx: number) => {
      await page.mouse.move(page0.x + page0.width * fx, page0.y + page0.height * 0.8, { steps: 6 });
      await page.waitForTimeout(250);
      return (await drawnBox(page, r.id))!.x;
    };
    const left = await at(0.05);
    const right = await at(0.95);
    expect(right - left).toBeGreaterThan(30); // defaults: 0..1 of the page maps to 0..200 px
    expect(Math.abs(left - designX)).toBeLessThan(60);
  });

  test("Follow: the chosen point of a layer follows the pointer (D6)", async ({ page }) => {
    const r = await setup(page);
    await page.getByLabel("Follow pin", { exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Bottom", exact: true }).first().click();
    await page.waitForTimeout(500);
    const lag = page.getByLabel("Follow lag", { exact: true }).first();
    await lag.fill("0");
    await lag.press("Enter");
    await page.getByRole("button", { name: "Follow the pointer", exact: true }).click();
    await expect.poll(async () => Object.values(((await page.evaluate(() => (window as unknown as { __LL_DOC__: { get: () => { bindings: Record<string, unknown> } } }).__LL_DOC__.get().bindings)) ?? {}) as Record<string, { name?: string }>).filter((b) => b.name === "Follow pointer").length).toBe(2);
    await expect(page.locator("[data-driver-id]")).toHaveCount(2);

    await page.getByText("Motion", { exact: true }).first().click();
    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const target = { x: page0.x + page0.width * 0.7, y: page0.y + page0.height * 0.6 };
    await page.mouse.move(target.x - 80, target.y - 50, { steps: 4 });
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.waitForTimeout(400);
    const box = (await drawnBox(page, r.id))!;
    expect(Math.abs(box.x + box.width / 2 - target.x)).toBeLessThan(3);
    expect(Math.abs(box.y + box.height - target.y)).toBeLessThan(3); // the bottom edge sits on the pointer

    // one undo step takes the whole follow away
    await page.getByText("Design", { exact: true }).first().click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect(page.locator("[data-driver-id]")).toHaveCount(0);
  });

  test("a helper layer is drawn in the editor and left out of the export (D6)", async ({ page }) => {
    const r = await setup(page);
    const exported = () =>
      page.evaluate(async () => {
        const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
        const out = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
        return out.files.map((f) => f.text ?? "").join("\n");
      });
    const before = await exported();
    await page.getByRole("button", { name: "Helper layer", exact: true }).click();
    await expect.poll(async () => (await layers(page))[r.id].properties["render.role"]).toBe("helper");
    await expect(page.locator(`[data-testid="stage-page"] [data-element-id="${r.id}"]`).first()).toBeVisible(); // still drawn while designing
    const after = await exported();
    expect(after.length).toBeLessThan(before.length - 30);
    await page.getByRole("button", { name: "Helper layer", exact: true }).click();
    await expect.poll(async () => (await layers(page))[r.id].properties["render.role"] ?? "").toBe("");
    expect((await exported()).length).toBe(before.length);
  });

  test("scroll drives a layer in Preview: the frame's own scroll is the signal (D4)", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
    await openEditor(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
      const el = page.getByText(name, { exact: true }).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click();
        await page.keyboard.press("Delete");
      }
    }
    // a Desktop frame stretched by its content (a tall page), as the responsive-frames spec builds one
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();
    type Win = { __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null }> }; commands: { addLayer: (a: unknown) => string } } };
    const ids = await page.evaluate(() => {
      const w = window as unknown as Win;
      const frame = Object.values(w.__LL_DOC__.get().layers).find((l) => l.archetype === "container" && l.parentId !== null)!.id; // the page frame, under the canvas root
      const add = (name: string, x: number, y: number) => w.__LL_DOC__.commands.addLayer({ archetype: "rectangle", parentId: frame, name, properties: { positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": 200, "frame.height": 120 } });
      return { top: add("Top", 100, 100), foot: add("Foot", 100, 1500) };
    });
    // preview the frame right on the canvas: it becomes the screen and the rest scrolls
    await page.locator(`[data-testid="frame-preview-toggle"][data-frame-id="${await page.evaluate(() => Object.values((window as unknown as Win).__LL_DOC__.get().layers).find((l) => l.archetype === "container" && l.parentId !== null)!.id)}"]`).click();
    const scroller = page.locator('[data-testid="frame-preview-scroller"]').first();
    await expect(scroller).toBeAttached({ timeout: 15000 });
    await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);

    // the top layer turns 0 to 90 degrees as the page scrolls from the top to the bottom
    await page.evaluate(([id]) => (window as unknown as { __LL_ENGINE__: { addBinding: (t: string, o: string) => string } }).__LL_ENGINE__.addBinding(`scroll.progress |> remap(0, 1, 0, 90)\n-> ${id}.transform.rotate blend add`, id), [ids.top]);
    const el = page.locator(`[data-testid="stage-page"] [data-element-id="${ids.top}"]`).first();
    const turn = () =>
      el.evaluate((e) => {
        const m = new DOMMatrix(getComputedStyle(e).transform === "none" ? undefined : getComputedStyle(e).transform);
        return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
      });
    await page.waitForTimeout(300);
    expect(await turn()).toBe(0); // at the top
    await scroller.evaluate((e) => ((e as HTMLElement).scrollTop = ((e as HTMLElement).scrollHeight - (e as HTMLElement).clientHeight) / 2));
    await expect.poll(turn).toBeGreaterThan(35); // halfway: about 45
    expect(await turn()).toBeLessThan(55);
    await scroller.evaluate((e) => ((e as HTMLElement).scrollTop = (e as HTMLElement).scrollHeight));
    await expect.poll(turn).toBe(90); // the bottom
  });
});

test.describe("Drivers in the export (D4)", () => {
  test("an exported page reacts to the mouse the way the editor does, and keeps still for a visitor who asked for less motion", async ({ page, browser }, testInfo) => {
    const r = await setup(page);
    await page.getByRole("button", { name: "Add driver", exact: true }).click(); // pointer left to right drives Position X, 0..200
    await expect(page.locator("[data-driver-id]")).toHaveCount(1);

    const built = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
      return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });
    expect(built.warnings.filter((x) => /driver/i.test(x))).toEqual([]);
    const script = built.files.find((f) => f.path === "lazylayout-drivers.js")!;
    expect(script.text).toContain("remap: function"); // only what the project uses
    expect(script.text).not.toContain("spring: function");
    const dir = testInfo.outputPath("export");
    for (const f of built.files) {
      if (f.text === undefined) continue;
      const p = join(dir, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.text);
    }
    expect(existsSync(join(dir, "index.html"))).toBe(true);
    expect(built.files.find((f) => f.path === "index.html")!.text).toContain('<script src="lazylayout-drivers.js" defer></script>');

    const open = async (reduced: boolean) => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await ctx.newPage();
      await p.goto(`file://${join(dir, "index.html")}`);
      return { ctx, p };
    };
    const shift = (p: Page) => p.locator(`[data-ll="${r.id}"]`).evaluate((e) => parseFloat((e as HTMLElement).style.translate || "0"));

    const live = await open(false);
    await expect(live.p.locator(`[data-ll="${r.id}"]`)).toHaveCount(1);
    await live.p.mouse.move(60, 400, { steps: 5 });
    await live.p.waitForTimeout(300);
    const left = await shift(live.p);
    await live.p.mouse.move(1140, 400, { steps: 8 });
    await live.p.waitForTimeout(300);
    const right = await shift(live.p);
    expect(right - left, "moving the mouse right moves the layer right").toBeGreaterThan(100); // 0..200 across the page
    expect(right).toBeLessThanOrEqual(200.001);
    await live.ctx.close();

    const still = await open(true);
    await still.p.mouse.move(1140, 400, { steps: 8 });
    await still.p.waitForTimeout(300);
    expect(await shift(still.p), "reduced motion: the page as designed").toBe(0);
    await still.ctx.close();
  });

  test("a project with no drivers exports no script", async ({ page }) => {
    await setup(page);
    const built = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
      return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });
    expect(built.files.some((f) => f.path.includes("drivers"))).toBe(false);
    expect(built.files.find((f) => f.path === "index.html")!.text).not.toContain("<script");
  });

  test("an exported grid of dots grows under the mouse, and is as designed for a visitor who asked for less motion (D10)", async ({ page, browser }, testInfo) => {
    const r = await setup(page);
    await page.evaluate(
      ([id]) =>
        (window as unknown as { __LL_DOC__: { commands: { updateProps: (id: string, p: Record<string, unknown>) => void } } }).__LL_DOC__.commands.updateProps(id, {
          "clone.mode": "grid", "clone.cols": 12, "clone.rows": 6, "clone.gapX": 70, "clone.gapY": 70,
          "effector.mode": "pointer", "effector.scale": 3, "effector.radius": 220, "effector.falloff": "linear",
        }),
      [r.id],
    );
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(71);
    const built = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
      return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });
    const html = built.files.find((f) => f.path === "index.html")!.text!;
    expect(html).toContain("data-ll-copy="); // the copies are findable by the script
    expect(html).not.toContain("data-repeat-copy");
    const dir = testInfo.outputPath("export-fx");
    for (const f of built.files) {
      if (f.text === undefined) continue;
      const p = join(dir, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.text);
    }
    const widths = (p: Page) => p.locator("[data-ll-copy]").evaluateAll((els) => els.map((e) => ((e.firstElementChild ?? e) as HTMLElement).getBoundingClientRect().width));
    const open = async (reduced: boolean) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await ctx.newPage();
      await p.goto(`file://${join(dir, "index.html")}`);
      return { ctx, p };
    };
    const live = await open(false);
    const before = await widths(live.p);
    expect(before.length).toBe(71);
    expect(Math.max(...before) - Math.min(...before)).toBeLessThan(1); // as drawn
    await live.p.mouse.move(700, 300, { steps: 6 });
    await live.p.waitForTimeout(400);
    const after = await widths(live.p);
    expect(Math.max(...after)).toBeGreaterThan(Math.min(...after) * 1.8); // the dots near the mouse grew
    await live.ctx.close();

    const still = await open(true);
    await still.p.mouse.move(700, 300, { steps: 6 });
    await still.p.waitForTimeout(400);
    const quiet = await widths(still.p);
    expect(Math.max(...quiet) - Math.min(...quiet)).toBeLessThan(1);
    await still.ctx.close();
  });
});
