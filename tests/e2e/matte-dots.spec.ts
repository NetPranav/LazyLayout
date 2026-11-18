/**
 * Any layer can be a matte: one dot multiplied by Clone (fill area) is a dotted matte, a group is everything in it,
 * and a matte follows a layer that follows the pointer. Together they make "dots round the pointer" from plain parts:
 * a layer shows through the dots, only inside a circle that follows the mouse.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; name: string; archetype: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
type W = Window & { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } }; __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } };
test.use({ viewport: { width: 1600, height: 1000 } });

async function build(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  return page.evaluate(() => {
    const w = window as unknown as W;
    const D = w.__LL_DOC__;
    const run = (id: string, a: unknown) => w.__LL_COMMANDS__.all().find((c) => c.id === id)!.run(a);
    const frame = Object.values(D.get().layers).find((l) => l.parentId && D.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...frame.children]) D.commands.removeLayer(c);
    const abs = (x: number, y: number, w: number, h: number) => ({ positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": h });
    // what shows: a blue card
    const card = D.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { ...abs(200, 200, 400, 300), "svg.fill": "#4285F4", "svg.stroke": "none" } });
    // one dot, multiplied over an area the card's size
    const dots = D.commands.addLayer({ archetype: "container", parentId: frame.id, properties: { ...abs(200, 200, 400, 300), "appearance.background.color": "transparent", "layout.display": "block" } });
    D.commands.addLayer({ archetype: "ellipse", parentId: dots, properties: { ...abs(0, 0, 10, 10), "appearance.background.color": "#000", "clone.mode": "fill", "clone.gapX": 6, "clone.gapY": 6 } });
    // the card shows only through the dots
    run("layer.setMatte", { ids: [card], sourceId: dots, mode: "alpha" });
    // and only inside a circle that follows the pointer: the card in a group matted by the circle
    const spot = D.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { ...abs(300, 250, 200, 200), "appearance.background.color": "#fff" } });
    run("selection.set", { ids: [card] });
    const before = Object.keys(D.get().layers);
    run("edit.group", {});
    const group = Object.keys(D.get().layers).find((k) => !before.includes(k))!;
    run("layer.setMatte", { ids: [group], sourceId: spot, mode: "alpha" });
    run("selection.set", { ids: [spot] });
    return { card, dots, spot, group };
  });
}

const maskPath = (page: Page, id: string) =>
  page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first().evaluate((el) => {
    const m = decodeURIComponent(getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage || "");
    return m.match(/ d="([^"]*)"/)?.[1] ?? "";
  });

test("one cloned dot is a dotted matte, and a circle following the pointer limits it", async ({ page }) => {
  const ids = await build(page);
  // the circle follows the pointer (the inspector's button)
  await page.getByRole("button", { name: "Follow the pointer" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Follow the pointer" }).click();
  await page.getByRole("tab", { name: "Motion" }).click();

  // the card's matte is every dot: 25 across by 19 down at a 16 px pitch over 400 x 300
  await expect.poll(async () => ((await maskPath(page, ids.card)).match(/M/g) ?? []).length).toBeGreaterThanOrEqual(25 * 18);
  // the sources are hidden: they shape, they don't show
  await expect(page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${ids.dots}"]`).first()).toHaveCSS("opacity", "0");

  // the group's matte is the circle, and it moves with the pointer
  const card = (await page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${ids.card}"]`).first().boundingBox())!;
  await page.mouse.move(card.x + card.width * 0.2, card.y + card.height * 0.3, { steps: 6 });
  await page.waitForTimeout(600);
  const first = await maskPath(page, ids.group);
  await page.mouse.move(card.x + card.width * 0.8, card.y + card.height * 0.7, { steps: 6 });
  await expect.poll(() => maskPath(page, ids.group)).not.toBe(first);
  const startX = (d: string) => Number(d.match(/^M\s*(-?[\d.]+)/)?.[1]);
  expect(startX(await maskPath(page, ids.group))).toBeGreaterThan(startX(first) + 50);
});
