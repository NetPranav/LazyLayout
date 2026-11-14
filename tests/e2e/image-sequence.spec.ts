/**
 * Design track D13: an image sequence. A sheet of frames in an image layer, scrubbed by the scroll through a driver, shows the
 * right frame at 20 scroll positions; at rest it shows the frame that is set.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

type Win = { __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> }> }; commands: { addLayer: (a: unknown) => string } } };
test.use({ viewport: { width: 1600, height: 1000 } });
const COLS = 5, ROWS = 4, FRAMES = 18;

async function setup(page: Page) {
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
  await page.getByText("Design", { exact: true }).click();
  await page.getByRole("menuitem", { name: /Desktop/i }).click();
  return page.evaluate(([cols, rows]) => {
    const w = window as unknown as Win;
    const frame = Object.values(w.__LL_DOC__.get().layers).find((l) => l.archetype === "container" && l.parentId !== null)!.id;
    // a sheet whose every cell is its own colour
    const cv = document.createElement("canvas");
    cv.width = cols * 60;
    cv.height = rows * 40;
    const g = cv.getContext("2d")!;
    for (let i = 0; i < cols * rows; i++) {
      g.fillStyle = `hsl(${(i * 19) % 360}, 80%, 50%)`;
      g.fillRect((i % cols) * 60, Math.floor(i / cols) * 40, 60, 40);
    }
    const spacer = w.__LL_DOC__.commands.addLayer({ archetype: "rectangle", parentId: frame, name: "Spacer", properties: { positioning: "absolute", "frame.x": 10, "frame.y": 2800, "frame.width": 20, "frame.height": 20 } });
    // the section the picture sits in: it scrolls through the screen from y 800 to y 2400
    const section = w.__LL_DOC__.commands.addLayer({ archetype: "container", parentId: frame, name: "Story", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 800, "frame.width": 1440, "frame.height": 1600 } });
    const img = w.__LL_DOC__.commands.addLayer({ archetype: "image", parentId: section, name: "Product", properties: { positioning: "absolute", "frame.x": 300, "frame.y": 400, "frame.width": 300, "frame.height": 200, "media.src": cv.toDataURL("image/png"), "sequence.cols": cols, "sequence.rows": rows, "sequence.frames": 18 } });
    return { frame, section, img, spacer };
  }, [COLS, ROWS] as const);
}
const selectRow = (page: Page, id: string) => page.evaluate((x) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(x), id);
/** The frame shown, read back from where the sheet is drawn: the cell the background position points at. */
const shown = (page: Page, id: string) =>
  page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first().evaluate(
    (e, [cols, rows]) => {
      const [x, y] = getComputedStyle(e).backgroundPosition.split(" ").map((v) => parseFloat(v));
      const col = cols > 1 ? Math.round((x / 100) * (cols - 1)) : 0;
      const row = rows > 1 ? Math.round((y / 100) * (rows - 1)) : 0;
      return row * cols + col;
    },
    [COLS, ROWS] as const,
  );

test.describe("Image sequence (D13)", () => {
  test("the Frame field shows that frame, one cell of the sheet", async ({ page }) => {
    const ids = await setup(page);
    await selectRow(page, ids.img);
    await expect(page.getByTestId("sequence-section")).toBeVisible();
    for (const f of [0, 1, 4, 5, 11, 17]) {
      const field = page.getByLabel("Sequence frame", { exact: true });
      await field.fill(String(f));
      await field.press("Enter");
      await expect.poll(() => shown(page, ids.img), { message: `frame ${f}` }).toBe(f);
    }
    // the colours really are the cells: the sheet is one picture, drawn at five times the layer's width
    const size = await page.locator(`[data-testid="stage-page"] [data-element-id="${ids.img}"]`).first().evaluate((e) => getComputedStyle(e).backgroundSize);
    expect(size).toMatch(/^1500px 800px$|^500% 400%$/);
  });

  test("scrubbing with scroll shows the right frame at 20 scroll positions, and never goes backwards on the way down", async ({ page }) => {
    const ids = await setup(page);
    await selectRow(page, ids.img);
    await page.getByRole("button", { name: "Scrub with scroll", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop scrubbing with scroll", exact: true })).toBeVisible();

    await page.locator(`[data-testid="frame-preview-toggle"][data-frame-id="${ids.frame}"]`).click();
    const scroller = page.locator('[data-testid="frame-preview-scroller"]').first();
    await expect(scroller).toBeAttached({ timeout: 15000 });
    await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
    const { vh, max } = await scroller.evaluate((e) => ({ vh: (e as HTMLElement).clientHeight, max: (e as HTMLElement).scrollHeight - (e as HTMLElement).clientHeight }));
    expect(max).toBeGreaterThan(1500);

    // the section (top 800, height 1600): 0 as it enters at the bottom of the screen, 1 as it leaves at the top
    const progress = (s: number) => Math.min(1, Math.max(0, (s + vh - 800) / (vh + 1600)));
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      const s = Math.round((max * i) / 19);
      await scroller.evaluate((e, top) => ((e as HTMLElement).scrollTop = top), s);
      const want = Math.min(FRAMES - 1, Math.max(0, Math.round(progress(s) * (FRAMES - 1))));
      await expect.poll(async () => Math.abs((await shown(page, ids.img)) - want), { message: `scroll ${s}: frame ${want}`, timeout: 8000 }).toBeLessThanOrEqual(1);
      seen.push(await shown(page, ids.img));
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i], `frame at position ${i}`).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(new Set(seen).size, "the sheet really plays").toBeGreaterThan(4);
  });
});
