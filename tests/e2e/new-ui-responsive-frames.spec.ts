/**
* Task I: Device views (Top-bar buttons removed, Design pill & frame size dropdowns, live linked mirror frames).
 *
 * Covers:
 * 1) No Desktop/Tablet/Mobile segmented buttons in top bar.
 * 2) Empty page + Mobile in Design pill creates a Mobile frame (375x812, selected).
 * 3) With a Desktop frame selected, Tablet in Design pill opens a live linked mirror to the right (120px gap, same top).
 * 4) Adding a rectangle inside the main frame appears in the mirror live.
 * 5) Moving a layer inside the mirror writes a Tablet override and leaves the main untouched.
 * 6) Clicking Desktop again with a Desktop frame selected creates a new independent frame.
 * 7) Deleting the mirror frame keeps the main frame intact.
 * 8) Attempting to delete a layer inside a mirror is refused with a toast ("Delete this layer in the main frame.").
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = {
  id: string;
  archetype: string;
  name: string;
  parentId: string | null;
  children: string[];
  visible?: boolean;
  overrides?: Record<string, Record<string, unknown>>;
  properties: Record<string, unknown>;
};

type Win = {
  __LL_TEST__: boolean;
  __LL_DOC__: {
    get: () => { layers: Record<string, L>; breakpoints?: readonly { id: string; name: string; width: number }[] };
    commands: {
      updateProps: (id: string, p: Record<string, unknown>) => void;
      addLayer: (l: unknown, label?: string) => string;
      removeLayer: (id: string, label?: string) => void;
    };
  };
};

const layers = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_DOC__.get().layers);
const ofKind = async (page: Page, k: string) =>
  Object.values(await layers(page)).filter((l) => l.archetype === k && l.parentId !== null);

const selected = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="stage-element"][data-selected="true"]')].map((e) =>
      e.getAttribute("data-element-id")
    )
  );

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page, { empty = true } = {}) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible({ timeout: 4000 });
  if (!empty) return;
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const el = page.locator(`[data-testid="layer-row"]`).filter({ hasText: name }).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.keyboard.press("Delete");
    }
  }
}

const art = async (page: Page, fx: number, fy: number) => {
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};

async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
}

async function rectangle(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const before = new Set((await ofKind(page, "rectangle")).map((l) => l.id));
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Rectangle/ }).click();
  await drag(page, await art(page, x1, y1), await art(page, x2, y2));
  return (await ofKind(page, "rectangle")).find((l) => !before.has(l.id))!;
}


const rectOf = (page: Page, sel: string) => page.locator(sel).boundingBox();
const drawnIn = (mirrorId: string, id: string) => `[data-testid="stage-page"] [data-mirror-id="${mirrorId}"] [data-archetype][data-element-id="${id}"], [data-testid="stage-page"] [data-mirror-id="${mirrorId}"] > [data-archetype][data-element-id="${id}"]`;

/** A Desktop frame with a tall page in it: three cards in a row and a footer far below, then a Tablet linked view. */
async function tallPage(page: Page, device: "Tablet" | "Mobile" = "Tablet") {
  await ready(page);
  await page.getByText("Design", { exact: true }).click();
  await page.getByRole("menuitem", { name: /Desktop/i }).click();
  const desktop = (await ofKind(page, "container"))[0];
  const ids = await page.evaluate((frame) => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    const add = (name: string, x: number, y: number, w: number, h: number) =>
      c.addLayer({ archetype: "rectangle", parentId: frame, name, properties: { positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": w, "frame.height": h, "svg.fill": "#3366ff" } });
    return { a: add("A", 100, 100, 380, 200), b: add("B", 530, 100, 380, 200), c: add("C", 960, 100, 380, 200), foot: add("Foot", 100, 1500, 1240, 200) };
  }, desktop.id);
  await page.locator(`[data-testid="layer-row"][data-layer-id="${desktop.id}"]`).click();
  await page.getByText("Design", { exact: true }).click();
  await page.getByRole("menuitem", { name: new RegExp(device, "i") }).click();
  await expect.poll(async () => (await ofKind(page, "container")).find((f) => f.properties["frame.mirrorOf"] === desktop.id)).toBeDefined();
  const mirror = (await ofKind(page, "container")).find((f) => f.properties["frame.mirrorOf"] === desktop.id)!;
  return { desktop, mirror, ids };
}

test.describe("responsive frames: auto-adapt, fold and Preview", () => {
  test("a Tablet view lays out what is in the frame by itself: nothing runs out of the frame, and Desktop edits carry over", async ({ page }) => {
    const { mirror, ids } = await tallPage(page);
    const frameBox = async () => (await rectOf(page, `[data-testid="stage-page"] [data-archetype][data-element-id="${mirror.id}"]`))!;
    await expect.poll(async () => (await frameBox()).height).toBeGreaterThan(100);
    const hit = (id: string) => page.locator(`[data-testid="stage-element"][data-mirror-id="${mirror.id}"][data-element-id="${id}"]`);
    const f = await frameBox();
    for (const id of Object.values(ids)) {
      const b = (await hit(id).boundingBox())!;
      expect(b.x, "starts inside the frame").toBeGreaterThanOrEqual(f.x - 1);
      expect(b.x + b.width, "ends inside the frame").toBeLessThanOrEqual(f.x + f.width + 1);
      expect(b.y + b.height, "the frame stretched to hold it").toBeLessThanOrEqual(f.y + f.height + 1);
    }
    const [a, c] = [(await hit(ids.a).boundingBox())!, (await hit(ids.c).boundingBox())!];
    expect(Math.abs(a.y - c.y), "the row still fits, so it stays a row").toBeLessThan(2);

    // an edit on Desktop reaches the Tablet view, and no override is written
    const before = (await hit(ids.foot).boundingBox())!.height;
    await page.evaluate((id) => (window as unknown as Win).__LL_DOC__.commands.updateProps(id, { "frame.height": 400 }), ids.foot);
    await expect.poll(async () => (await hit(ids.foot).boundingBox())!.height).toBeGreaterThan(before);
    expect((await layers(page))[ids.foot].overrides).toBeUndefined();
  });

  test("Mobile stacks the row; the fold shows how much fits; Preview makes the frame the phone's screen, and it scrolls", async ({ page }) => {
    const { mirror, ids } = await tallPage(page, "Mobile");
    const hit = (id: string) => page.locator(`[data-testid="stage-element"][data-mirror-id="${mirror.id}"][data-element-id="${id}"]`);
    await expect.poll(async () => (await hit(ids.b).boundingBox())?.y ?? 0).toBeGreaterThan(((await hit(ids.a).boundingBox())?.y ?? 0) + 10);

    const drawn = page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${mirror.id}"]`);
    const size = () => drawn.evaluate((e) => ({ w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight }));
    const full = await size();
    expect(full.w).toBe(375);
    expect(full.h, "it stretched past the phone's screen").toBeGreaterThan(812);
    const fold = page.locator(`[data-testid="frame-fold-line"][data-frame-id="${mirror.id}"]`);
    await expect(fold).toContainText("Fold · 812");

    // Preview on: right here, the frame is the phone's screen, and the rest scrolls
    const toggle = page.locator(`[data-testid="frame-preview-toggle"][data-frame-id="${mirror.id}"]`);
    await toggle.getByRole("checkbox").click();
    await expect.poll(size).toEqual({ w: 375, h: 812 });
    await expect(fold).toHaveCount(0);
    await expect(hit(ids.foot), "not editable while previewed").toHaveCount(0);
    const scroller = page.locator(`[data-testid="frame-preview-scroller"][data-frame-id="${mirror.id}"]`);
    const sb = (await scroller.boundingBox())!;
    await page.mouse.move(sb.x + 10, sb.y + sb.height / 2); // (the left edge: the frame runs under the side panel at this zoom)
    await page.mouse.wheel(0, 300);
    await expect.poll(() => drawn.evaluate((e) => e.scrollTop), "the wheel scrolls the frame, not the canvas").toBeGreaterThan(0);

    // Preview off: full height again, from the top
    await toggle.getByRole("checkbox").click();
    await expect.poll(size).toEqual(full);
    expect(await drawn.evaluate((e) => e.scrollTop)).toBe(0);
    await expect(fold).toBeVisible();
  });

  test("a Desktop frame stretched by its content shows the Desktop fold and previews at 900", async ({ page }) => {
    const { desktop } = await tallPage(page);
    const drawn = page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${desktop.id}"]`);
    await expect.poll(() => drawn.evaluate((e) => (e as HTMLElement).offsetHeight)).toBe(1700);
    await expect(page.locator(`[data-testid="frame-fold-line"][data-frame-id="${desktop.id}"]`)).toContainText("Fold · 900");
    await page.locator(`[data-testid="frame-preview-toggle"][data-frame-id="${desktop.id}"]`).getByRole("checkbox").click();
    await expect.poll(() => drawn.evaluate((e) => (e as HTMLElement).offsetHeight)).toBe(900);
  });

  test("Tablet and Mobile views of one frame open side by side, not on top of each other", async ({ page }) => {
    const { desktop } = await tallPage(page, "Tablet");
    await page.locator(`[data-testid="layer-row"][data-layer-id="${desktop.id}"]`).click();
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Mobile/i }).click();
    await expect.poll(async () => (await ofKind(page, "container")).filter((f) => f.properties["frame.mirrorOf"] === desktop.id).length).toBe(2);
    const views = (await ofKind(page, "container")).filter((f) => f.properties["frame.mirrorOf"] === desktop.id);
    const tablet = views.find((v) => v.properties["frame.device"] === "tablet")!;
    const mobile = views.find((v) => v.properties["frame.device"] === "mobile")!;
    expect(Number(mobile.properties["frame.x"])).toBe(Number(tablet.properties["frame.x"]) + 768 + 120);
  });

  test("the size label tells the truth, and clicking and dragging still work around the new controls", async ({ page }) => {
    const { desktop, mirror, ids } = await tallPage(page);
    await expect(page.locator(`[data-testid="mirror-frame-label"][data-frame-id="${mirror.id}"]`)).toContainText("Tablet · 768");
    const hit = page.locator(`[data-testid="stage-element"]:not([data-mirror-id])[data-element-id="${ids.a}"]`);
    await hit.click();
    await expect.poll(() => selected(page)).toContain(ids.a);
    const before = (await layers(page))[ids.a].properties["frame.x"];
    const b = (await hit.boundingBox())!;
    await drag(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width / 2 + 40, y: b.y + b.height / 2 });
    await expect.poll(async () => (await layers(page))[ids.a].properties["frame.x"]).not.toBe(before);
    expect((await layers(page))[ids.a].parentId).toBe(desktop.id);
  });
});
