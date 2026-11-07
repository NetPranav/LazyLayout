/**
 * Task E: No "ghost frame", and Desktop / Tablet / Mobile buttons work on user frames.
 *
 * Covers:
 * 1) empty page + Frame tool = exactly one visible frame and no page sheet (data-bare="true" / transparent bg)
 * 2) loose shape on the page still shows the sheet
 * 3) empty page + Mobile click creates a frame named Mobile of 375 wide
 * 4) with a frame, Tablet click + moving a child gives an override that persists when switching Desktop -> Tablet again while Desktop stays unchanged
 * 5) Backspace deletes the frame
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
const setProps = (page: Page, id: string, props: Record<string, unknown>) =>
  page.evaluate(
    ([i, p]) =>
      (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, p as Record<string, unknown>),
    [id, props] as const
  );

const drawn = (page: Page, id: string) =>
  page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);
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
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  if (!empty) return;
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const el = page.getByText(name, { exact: true }).first();
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

async function frame(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.getByRole("button", { name: /^Frame/ }).first().click();
  await drag(page, await art(page, x1, y1), await art(page, x2, y2));
  return (await ofKind(page, "container")).pop()!;
}

test.describe("Task E: No ghost frame and Desktop / Tablet / Mobile presets", () => {
  test("empty page + Frame tool = exactly one visible frame and no page sheet", async ({ page }) => {
    await ready(page);
    const artboard = page.locator("[data-stage=artboard]");
    await expect(artboard).toHaveAttribute("data-bare", "true");
    await expect.poll(() => artboard.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(0, 0, 0, 0)");

    const f = await frame(page, 0.1, 0.1, 0.6, 0.6);
    expect(f).toBeDefined();

    // The page sheet remains bare (no white background, transparent)
    await expect(artboard).toHaveAttribute("data-bare", "true");
    await expect.poll(() => artboard.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await expect.poll(() => artboard.evaluate((e) => getComputedStyle(e).boxShadow)).toBe("none");

    // Exactly one frame is drawn and visible
    const frames = await ofKind(page, "container");
    expect(frames).toHaveLength(1);
    await expect(drawn(page, f.id)).toBeVisible();
    await expect(page.locator('[data-testid="stage-page"]')).toHaveCSS("visibility", "visible");
  });

  test("a loose shape on the page shows on the canvas and the page is still never drawn", async ({ page }) => {
    await ready(page);
    const artboard = page.locator("[data-stage=artboard]");
    await expect(artboard).toHaveAttribute("data-bare", "true");

    const r = await rectangle(page, 0.2, 0.2, 0.4, 0.4);
    expect(r).toBeDefined();

    // the page is never drawn: no sheet, only the shape on the canvas
    await expect(artboard).toHaveAttribute("data-bare", "true");
    await expect(page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${r.id}"]`)).toBeVisible();
    expect(await artboard.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    expect(await page.locator('[data-testid="stage-page"] > [data-archetype="container"]').first().evaluate((e) => getComputedStyle(e).backgroundColor), "the page's own fill is not drawn").toBe("rgba(0, 0, 0, 0)");
  });

  test("empty page + Mobile click creates a frame named Mobile of 375 wide", async ({ page }) => {
    await ready(page);

    // Click the Mobile button in top bar
    const mobileBtn = page.getByRole("button", { name: "Mobile", exact: true });
    await expect(mobileBtn).toBeVisible();
    await mobileBtn.click();

    // A frame named Mobile is created with width 375
    await expect.poll(async () => {
      const frames = await ofKind(page, "container");
      return frames.find((f) => f.name === "Mobile");
    }).toBeDefined();

    const frames = await ofKind(page, "container");
    const mobileFrame = frames.find((f) => f.name === "Mobile")!;
    expect(mobileFrame.properties["frame.width"]).toBe(375);
    expect(mobileFrame.properties["frame.height"]).toBe(812);

    // Frame is selected
    await expect.poll(async () => selected(page)).toContain(mobileFrame.id);

    // Artboard is bare
    const artboard = page.locator("[data-stage=artboard]");
    await expect(artboard).toHaveAttribute("data-bare", "true");

    // Size label shows Mobile
    await expect(page.locator("#albltx")).toContainText("Mobile");
  });

  test("with a frame, Tablet click + moving a child gives an override that persists when switching Desktop -> Tablet again while Desktop stays unchanged", async ({ page }) => {
    await ready(page);

    // Create a base frame and a child rectangle
    const f = await frame(page, 0.1, 0.1, 0.8, 0.8);
    const r = await rectangle(page, 0.15, 0.15, 0.35, 0.35);
    expect(r.parentId).toBe(f.id);

    const baseLayers = await layers(page);
    const baseChildX = Number(baseLayers[r.id].properties["frame.x"] ?? 0);

    // Switch to Tablet
    const tabletBtn = page.getByRole("button", { name: "Tablet", exact: true });
    await tabletBtn.click();
    await expect(page.locator("#albltx")).toContainText("Tablet");

    // Move the child while Tablet is active
    const newTabletX = baseChildX + 60;
    await setProps(page, r.id, { "frame.x": newTabletX });

    // Verify override was written
    await expect.poll(async () => {
      const l = await layers(page);
      return l[r.id].overrides ? Object.values(l[r.id].overrides!)[0]?.["frame.x"] : undefined;
    }).toBe(newTabletX);

    // Switch back to Desktop
    const desktopBtn = page.getByRole("button", { name: "Desktop", exact: true });
    await desktopBtn.click();
    await expect(page.locator("#albltx")).toContainText("Desktop");

    // Verify Desktop base value is unchanged
    const desktopLayers = await layers(page);
    expect(Number(desktopLayers[r.id].properties["frame.x"] ?? 0)).toBe(baseChildX);

    // Switch back to Tablet
    await tabletBtn.click();
    await expect(page.locator("#albltx")).toContainText("Tablet");

    // Verify override shows again under Tablet
    const restoredLayers = await layers(page);
    const tabletOverride = Object.values(restoredLayers[r.id].overrides ?? {})[0] as Record<string, unknown>;
    expect(tabletOverride?.["frame.x"]).toBe(newTabletX);
  });

  test("Backspace deletes the frame", async ({ page }) => {
    await ready(page);

    const f = await frame(page, 0.1, 0.1, 0.5, 0.5);
    expect((await ofKind(page, "container"))).toHaveLength(1);

    // Select the frame
    await page.getByText(f.name, { exact: true }).first().click();
    await expect.poll(async () => selected(page)).toContain(f.id);

    // Press Backspace
    await page.keyboard.press("Backspace");

    // Frame is deleted and canvas is empty
    await expect.poll(async () => (await ofKind(page, "container")).length).toBe(0);
    const artboard = page.locator("[data-stage=artboard]");
    await expect(artboard).toHaveAttribute("data-bare", "true");
  });
});
