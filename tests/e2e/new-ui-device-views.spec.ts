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

test.describe("Task I: Device views and live linked mirror frames", () => {
  test("1) no Desktop/Tablet/Mobile buttons in the top bar", async ({ page }) => {
    await ready(page);

    // Ensure the segmented preset control is gone from top bar
    await expect(page.locator('[data-testid="topbar-presets"]')).toHaveCount(0);
    await expect(page.locator("#preset-desktop")).toHaveCount(0);
    await expect(page.locator("#preset-tablet")).toHaveCount(0);
    await expect(page.locator("#preset-mobile")).toHaveCount(0);

    // Design / Motion / Code tabs remain intact
    await expect(page.getByText("Design", { exact: true })).toBeVisible({ timeout: 4000 });
    await expect(page.getByText("Motion", { exact: true })).toBeVisible({ timeout: 4000 });
    await expect(page.getByText("Code", { exact: true })).toBeVisible({ timeout: 4000 });
  });

  test("2) empty page + Mobile in the Design pill creates a Mobile frame", async ({ page }) => {
    await ready(page);

    // Open Design dropdown and click Mobile
    await page.getByText("Design", { exact: true }).click();
    const mobileItem = page.getByRole("menuitem", { name: /Mobile/i });
    await expect(mobileItem).toBeVisible({ timeout: 4000 });
    await mobileItem.click();

    // Verify Mobile frame (375x812) created
    await expect.poll(async () => {
      const frames = await ofKind(page, "container");
      return frames.find((f) => f.name === "Mobile" || f.properties["frame.device"] === "mobile");
    }, { timeout: 4000 }).toBeDefined();

    const frames = await ofKind(page, "container");
    const mobileFrame = frames.find((f) => f.name === "Mobile" || f.properties["frame.device"] === "mobile")!;
    expect(Number(mobileFrame.properties["frame.width"])).toBe(375);
    expect(Number(mobileFrame.properties["frame.height"])).toBe(812);

    // Mobile frame is selected
    await expect.poll(async () => selected(page), { timeout: 4000 }).toContain(mobileFrame.id);
  });

  test("3) with a Desktop frame selected, Tablet opens a mirror to the right (120px gap, same top)", async ({ page }) => {
    await ready(page);

    // Create Desktop frame via Design dropdown
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();

    await expect.poll(async () => {
      const frames = await ofKind(page, "container");
      return frames.find((f) => f.properties["frame.width"] === 1440);
    }, { timeout: 4000 }).toBeDefined();

    const desktopFrames = await ofKind(page, "container");
    const desktop = desktopFrames.find((f) => f.properties["frame.width"] === 1440)!;

    // Select desktop frame via Layers panel row
    const layerRow = page.locator(`[data-testid="layer-row"][data-layer-id="${desktop.id}"]`);
    if (await layerRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await layerRow.click();
    }

    // Now click Tablet in Design dropdown
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Tablet/i }).click();

    // Live linked mirror frame is opened
    await expect.poll(async () => {
      const allFrames = await ofKind(page, "container");
      return allFrames.find((f) => f.properties["frame.mirrorOf"] === desktop.id);
    }, { timeout: 4000 }).toBeDefined();

    const allFrames = await ofKind(page, "container");
    const mirror = allFrames.find((f) => f.properties["frame.mirrorOf"] === desktop.id)!;
    expect(mirror.properties["frame.device"]).toBe("tablet");
    expect(Number(mirror.properties["frame.width"])).toBe(768);
    expect(Number(mirror.properties["frame.height"])).toBe(1024);

    // Position: 120px to the right of main frame, same top
    const deskX = Number(desktop.properties["frame.x"] ?? 0);
    const deskY = Number(desktop.properties["frame.y"] ?? 0);
    const deskW = Number(desktop.properties["frame.width"] ?? 1440);
    expect(Number(mirror.properties["frame.x"])).toBe(deskX + deskW + 120);
    expect(Number(mirror.properties["frame.y"])).toBe(deskY);

    // Mirror frame has its own label with link marker
    await expect(page.locator('[data-testid="mirror-frame-label"]')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('[data-testid="mirror-frame-label"]')).toContainText("Tablet · 768");
  });

  test("4) adding a rectangle inside the main appears in the mirror live", async ({ page }) => {
    await ready(page);

    // Create Desktop frame and Tablet mirror
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();

    const frames1 = await ofKind(page, "container");
    const desktop = frames1[0];

    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Tablet/i }).click();

    const frames2 = await ofKind(page, "container");
    const mirror = frames2.find((f) => f.properties["frame.mirrorOf"] === desktop.id)!;
    expect(mirror).toBeDefined();

    // Add a rectangle inside main desktop frame
    const rect = await rectangle(page, 0.1, 0.1, 0.25, 0.25);
    expect(rect).toBeDefined();

    // Verify rectangle is drawn in main frame and also appears inside mirror
    await expect(page.locator(`[data-testid="stage-page"] [data-element-id="${rect.id}"]`).first()).toBeVisible({ timeout: 4000 });
    await expect(page.locator(`[data-mirror-id="${mirror.id}"] [data-element-id="${rect.id}"]`)).toBeVisible({ timeout: 4000 });
  });

  test("5) moving a layer inside mirror writes a Tablet override and leaves main untouched", async ({ page }) => {
    await ready(page);

    // Setup main frame, mirror and child rectangle
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();
    const desktop = (await ofKind(page, "container"))[0];

    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Tablet/i }).click();
    const mirror = (await ofKind(page, "container")).find((f) => f.properties["frame.mirrorOf"] === desktop.id)!;

    const rect = await rectangle(page, 0.1, 0.1, 0.25, 0.25);
    const initialLayers = await layers(page);
    const initialMainX = Number(initialLayers[rect.id].properties["frame.x"] ?? 0);

    // Click the rectangle inside the mirror
    const mirroredRectEl = page.locator(`[data-testid="stage-element"][data-mirror-id="${mirror.id}"][data-element-id="${rect.id}"]`);
    await mirroredRectEl.click();

    // Nudge with arrow key inside mirror
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // Verify override was written on Tablet breakpoint while main layer base properties remain unchanged
    await expect.poll(async () => {
      const l = await layers(page);
      const ov = l[rect.id]?.overrides;
      return ov ? Object.keys(ov).length : 0;
    }, { timeout: 4000 }).toBeGreaterThan(0);

    const updatedLayers = await layers(page);
    expect(Number(updatedLayers[rect.id].properties["frame.x"] ?? 0)).toBe(initialMainX);
  });

  test("6) clicking Desktop again with a Desktop frame selected creates a new independent frame", async ({ page }) => {
    await ready(page);

    // Create initial Desktop frame
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();

    const framesBefore = await ofKind(page, "container");
    expect(framesBefore).toHaveLength(1);
    const firstDesktop = framesBefore[0];

    // Select the first desktop frame via Layers panel
    const row = page.locator(`[data-testid="layer-row"][data-layer-id="${firstDesktop.id}"]`);
    if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
      await row.click();
    }

    // Click Desktop again with first desktop frame selected
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();

    // Verify a new independent frame was created (NOT a mirror)
    await expect.poll(async () => (await ofKind(page, "container")).length, { timeout: 4000 }).toBe(2);

    const framesAfter = await ofKind(page, "container");
    const secondFrame = framesAfter.find((f) => f.id !== firstDesktop.id)!;
    expect(secondFrame.properties["frame.mirrorOf"]).toBeUndefined();
    expect(secondFrame.properties["frame.width"]).toBe(1440);
  });

  test("7) deleting the mirror keeps the main frame intact", async ({ page }) => {
    await ready(page);

    // Create desktop frame and mirror
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();
    const desktop = (await ofKind(page, "container"))[0];

    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Tablet/i }).click();

    const mirror = (await ofKind(page, "container")).find((f) => f.properties["frame.mirrorOf"] === desktop.id)!;
    expect(mirror).toBeDefined();

    // Select mirror frame via Layers panel row
    const mirrorRow = page.locator(`[data-testid="layer-row"][data-layer-id="${mirror.id}"]`);
    if (await mirrorRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mirrorRow.click();
    } else {
      await page.locator(`[data-testid="stage-element"][data-element-id="${mirror.id}"]`).click();
    }

    await page.keyboard.press("Backspace");

    // Mirror is gone, main frame remains
    await expect.poll(async () => {
      const frames = await ofKind(page, "container");
      return frames.find((f) => f.id === mirror.id);
    }, { timeout: 4000 }).toBeUndefined();

    const remaining = await ofKind(page, "container");
    expect(remaining.some((f) => f.id === desktop.id)).toBe(true);
  });

  test("8) deleting a layer inside a mirror is refused with a toast", async ({ page }) => {
    await ready(page);

    // Setup main frame, mirror and rectangle
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();
    const desktop = (await ofKind(page, "container"))[0];

    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Tablet/i }).click();
    const mirror = (await ofKind(page, "container")).find((f) => f.properties["frame.mirrorOf"] === desktop.id)!;

    const rect = await rectangle(page, 0.1, 0.1, 0.25, 0.25);

    // Click rectangle inside mirror
    const mirroredRectEl = page.locator(`[data-testid="stage-element"][data-mirror-id="${mirror.id}"][data-element-id="${rect.id}"]`);
    await mirroredRectEl.click();

    // Attempt to delete with Backspace
    await page.keyboard.press("Backspace");

    // Refusal toast is shown
    await expect(page.getByText("Delete this layer in the main frame.")).toBeVisible({ timeout: 4000 });

    // Layer still exists in document
    const curLayers = await layers(page);
    expect(curLayers[rect.id]).toBeDefined();
  });
});
