/**
 * Design track D9: the Cloner. A dot copied as a grid, a ring, or filling the area; drawn by the renderer, so the editor and
 * the export agree.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

async function dot(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Ellipse");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.12, b.y + b.height * 0.24, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const choose = async (page: Page, label: string, name: string) => {
  await page.getByLabel(label, { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(500);
};
const mode = async (page: Page, name: string) => {
  await page.getByLabel("Clone mode", { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(500);
};
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const exported = (page: Page) =>
  page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    const out = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    return out.files.map((f) => ({ path: f.path, text: f.text ?? "" }));
  });
const geom = (page: Page, id: string) => layers(page).then((l) => ({ x: Number(l[id].properties["frame.x"]), y: Number(l[id].properties["frame.y"]), w: Number(l[id].properties["frame.width"]), h: Number(l[id].properties["frame.height"]) }));

test.describe("Cloner (D9)", () => {
  test("grid: 4 columns by 3 rows of a dot, 11 copies at the pitch", async ({ page }) => {
    const d = await dot(page);
    const g = await geom(page, d.id);
    await mode(page, "Grid");
    await set(page, "Clone columns", 4);
    await set(page, "Clone rows", 3);
    await set(page, "Clone gap X", 20);
    await set(page, "Clone gap Y", 30);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(11);
    const pageEl = page.locator('[data-testid="stage-page"]');
    const k = (await pageEl.boundingBox())!.width / (await pageEl.evaluate((e) => (e as HTMLElement).offsetWidth));
    const o = (await page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${d.id}"]`).first().boundingBox())!;
    // copy 5 is the second row, first column (copies run row by row; the layer is cell 0): offset (0, 1 pitch)
    const c5 = (await page.locator('[data-repeat-copy="4"] [data-archetype]').first().boundingBox())!;
    expect(Math.abs(c5.x - o.x)).toBeLessThan(1.5);
    expect(Math.abs(c5.y - (o.y + (g.h + 30) * k))).toBeLessThan(1.5);
  });

  test("fill area: the dot fills its frame, and the panel says how many", async ({ page }) => {
    const d = await dot(page);
    await mode(page, "Fill area");
    await set(page, "Clone gap X", 40);
    await set(page, "Clone gap Y", 40);
    const note = await page.getByRole("status", { name: "Clone count" }).textContent();
    const total = Number(/(\d+) in all/.exec(note ?? "")?.[1]);
    expect(total).toBeGreaterThan(50);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(total - 1);
    // every copy is inside the frame the dot sits in (or crosses its edge): none is far outside it
    const pageBox = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    for (const box of await page.locator("[data-repeat-copy] [data-archetype]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(box.right).toBeGreaterThan(pageBox.x - 1);
      expect(box.left).toBeLessThan(pageBox.x + pageBox.width + 1);
      expect(box.bottom).toBeGreaterThan(pageBox.y - 1);
      expect(box.top).toBeLessThan(pageBox.y + pageBox.height + 1);
    }
    expect(d.id).toBeTruthy();
  });

  test("ring: 6 copies around a circle, turned to face out", async ({ page }) => {
    const d = await dot(page);
    await mode(page, "Ring");
    await set(page, "Clone count", 6);
    await set(page, "Clone radius", 120);
    await page.getByRole("button", { name: "Clone face out", exact: true }).click();
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(5);
    expect(await page.locator('[data-repeat-copy="3"]').evaluate((e) => (e as HTMLElement).style.transform)).toContain("rotate(180deg)");
    expect(d.id).toBeTruthy();
  });

  test("a 100 x 60 dot grid exports with no script, as one element (the editor draws all 5,999 copies)", async ({ page }) => {
    test.setTimeout(180_000);
    await dot(page);
    await mode(page, "Grid");
    await set(page, "Clone columns", 100);
    await set(page, "Clone rows", 60);
    await set(page, "Clone gap X", 4);
    await set(page, "Clone gap Y", 4);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(5999, { timeout: 60_000 });
    const files = await exported(page);
    const html = files.filter((f) => f.path.endsWith(".html")).map((f) => f.text).join("\n");
    expect(html).not.toMatch(/<script/i);
    expect(files.some((f) => f.path.endsWith(".js"))).toBe(false);
    expect(html).not.toContain("data-repeat-copy");
    // the 5,999 copies are one element with a repeating background (the cheapest form; the "cheapest export" test compares how it looks)
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(1);
    expect((html.match(/<svg/g) ?? []).length).toBe(0);
  });

  test("the cheapest export: a static dot grid is one element, and looks the same as one element per dot (D9)", async ({ page, browser }, testInfo) => {
    test.setTimeout(240_000);
    await dot(page);
    await mode(page, "Grid");
    await set(page, "Clone columns", 100);
    await set(page, "Clone rows", 60);
    await set(page, "Clone gap X", 10);
    await set(page, "Clone gap Y", 10);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(5999, { timeout: 90_000 });

    const build = (dotGrids: boolean) =>
      page.evaluate(async (flag) => {
        const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
        return w.__LL_EXPORT__.build({ target: "html", styling: "css", dotGrids: flag });
      }, dotGrids);
    const cheap = await build(true);
    const full = await build(false);
    const htmlOf = (b: typeof cheap) => b.files.find((f) => f.path === "index.html")!.text!;
    const cssOf = (b: typeof cheap) => b.files.find((f) => f.path === "styles.css")!.text!;
    // one element instead of 6,000, no script, and the file is a few KB instead of hundreds
    expect((htmlOf(cheap).match(/<svg/g) ?? []).length).toBe(0);
    expect((htmlOf(full).match(/<svg/g) ?? []).length).toBe(6000);
    expect(htmlOf(cheap).length + cssOf(cheap).length).toBeLessThan(6000);
    expect(htmlOf(full).length).toBeGreaterThan(300_000);
    expect(htmlOf(cheap)).not.toMatch(/<script/i);
    expect(cssOf(cheap)).toContain("radial-gradient");

    const write = (b: typeof cheap, name: string) => {
      const dir = testInfo.outputPath(name);
      for (const f of b.files) {
        if (f.text === undefined) continue;
        mkdirSync(dirname(join(dir, f.path)), { recursive: true });
        writeFileSync(join(dir, f.path), f.text);
      }
      return dir;
    };
    const shot = async (dir: string) => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      await p.goto(`file://${join(dir, "index.html")}`);
      await p.waitForTimeout(500);
      const png = await p.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } });
      await ctx.close();
      return png;
    };
    const a = await shot(write(cheap, "cheap"));
    const b = await shot(write(full, "full"));

    // the same picture: count pixels that differ noticeably, in a page that can read both images
    const result = await page.evaluate(async ([x, y]) => {
      const load = (b64: string) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + b64; });
      const [ia, ib] = await Promise.all([load(x), load(y)]);
      const draw = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d")!; g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const da = draw(ia), db = draw(ib);
      let differ = 0, ink = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (da[i] < 250 || db[i] < 250) ink++;
        if (d > 48) differ++;
      }
      return { differ, ink, total: da.length / 4 };
    }, [a.toString("base64"), b.toString("base64")]);
    expect(result.ink, "there is a grid to compare").toBeGreaterThan(20_000);
    expect(result.differ / result.ink, `${result.differ} of ${result.ink} drawn pixels differ`).toBeLessThan(0.02);
  });

  test("the editor with 5,000 animated copies: frame time while the pointer sweeps across them (recorded, not asserted: it depends on the machine) (D9)", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await dot(page);
    await mode(page, "Grid");
    const cols = 100;
    const rows = 50;
    await set(page, "Clone columns", cols);
    await set(page, "Clone rows", rows);
    await set(page, "Clone gap X", 6);
    await set(page, "Clone gap Y", 6);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(cols * rows - 1, { timeout: 90_000 });
    await choose(page, "Effector mode", "Pointer");
    await set(page, "Effector scale", 2.5);
    await set(page, "Effector radius", 150);
    await page.getByText("Motion", { exact: true }).first().click();
    await page.waitForTimeout(800);

    // record the time between frames while the mouse sweeps over the grid, and how many copies are being restyled
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean };
      w.__frames = [];
      w.__stop = false;
      let last = performance.now();
      const tick = (now: number) => {
        w.__frames.push(now - last);
        last = now;
        if (!w.__stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const pageBox = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    for (let pass = 0; pass < 3; pass++) {
      await page.mouse.move(pageBox.x + pageBox.width * 0.05, pageBox.y + pageBox.height * (0.2 + 0.2 * pass));
      await page.mouse.move(pageBox.x + pageBox.width * 0.95, pageBox.y + pageBox.height * (0.3 + 0.2 * pass), { steps: 90 });
    }
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean };
      w.__stop = true;
      return w.__frames.slice(5);
    });
    const sorted = [...frames].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const stats = { frames: frames.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +sorted[sorted.length - 1].toFixed(1) };
    console.log("FRAMES 4,999 copies, pointer effector:", JSON.stringify(stats));
    testInfo.annotations.push({ type: "frame time (ms)", description: JSON.stringify(stats) });
    expect(frames.length).toBeGreaterThan(60);
    const grown = await page.locator("[data-repeat-copy]").evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.transform.includes("scale(")).length);
    expect(grown, "the copies near the pointer were being restyled").toBeGreaterThan(5);
  });

  test("the exported page: 5,000 animated copies hold the frame rate while the pointer sweeps across them (D9)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    await dot(page);
    await mode(page, "Grid");
    await set(page, "Clone columns", 100);
    await set(page, "Clone rows", 50);
    await set(page, "Clone gap X", 6);
    await set(page, "Clone gap Y", 6);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(4999, { timeout: 90_000 });
    await choose(page, "Effector mode", "Pointer");
    await set(page, "Effector scale", 2.5);
    await set(page, "Effector radius", 150);
    const built = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
      return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });
    const dir = testInfo.outputPath("export-5000");
    for (const f of built.files) {
      if (f.text === undefined) continue;
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.text);
    }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
    const ex = await ctx.newPage();
    await ex.goto(`file://${join(dir, "index.html")}`);
    await expect(ex.locator("[data-ll-copy]")).toHaveCount(4999);
    await ex.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __stop: boolean };
      w.__frames = [];
      w.__stop = false;
      let last = performance.now();
      const tick = (now: number) => { w.__frames.push(now - last); last = now; if (!w.__stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await ex.waitForTimeout(500);
    for (let pass = 0; pass < 3; pass++) {
      await ex.mouse.move(60, 150 + 200 * pass);
      await ex.mouse.move(1380, 250 + 200 * pass, { steps: 90 });
    }
    const frames = await ex.evaluate(() => { const w = window as unknown as { __frames: number[]; __stop: boolean }; w.__stop = true; return w.__frames.slice(5); });
    const sorted = [...frames].sort((x, y) => x - y);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const stats = { frames: frames.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +sorted[sorted.length - 1].toFixed(1) };
    console.log("FRAMES exported page, 4,999 copies, pointer effector:", JSON.stringify(stats));
    testInfo.annotations.push({ type: "exported page frame time (ms)", description: JSON.stringify(stats) });
    const grown = await ex.locator("[data-ll-copy]").evaluateAll((els) => els.filter((e) => (e as HTMLElement).style.transform.includes("scale(")).length);
    expect(grown, "the copies near the pointer were being restyled").toBeGreaterThan(5);
    expect(stats.median, "better than 30 fps at the median (the numbers are recorded in the test's annotations)").toBeLessThan(33.4);
    await ctx.close();
  });
});
