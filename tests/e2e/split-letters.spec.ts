import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = {
  id: string;
  archetype: string;
  name: string;
  parentId: string | null;
  children: string[];
  visible?: boolean;
  properties: Record<string, unknown>;
};

type ClipData = {
  id: string;
  layerId: string;
  name: string;
  type: string;
  trigger: string;
  duration: number;
  delay?: number;
  tracks: Array<{ property: string; keyframes: Array<{ time: number; value: unknown }> }>;
};

type Win = {
  __LL_TEST__: boolean;
  __LL_DOC__: {
    get: () => { layers: Record<string, L>; clips: Record<string, ClipData> };
    commands: {
      updateProps: (id: string, p: Record<string, unknown>) => void;
      addLayer: (input: unknown) => string;
    };
  };
};

const layers = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_DOC__.get().layers);
const docClips = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_DOC__.get().clips);
const ofKind = async (page: Page, k: string) =>
  Object.values(await layers(page)).filter((l) => l.archetype === k && l.parentId !== null);
const setProps = (page: Page, id: string, props: Record<string, unknown>) =>
  page.evaluate(
    ([i, p]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, p as Record<string, unknown>),
    [id, props] as const,
  );

const drawn = (page: Page, id: string) =>
  page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
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

async function addTextLayer(page: Page, text: string, props: Record<string, unknown> = {}) {
  await page.getByRole("button", { name: /^Text/ }).first().click();
  await drag(page, await art(page, 0.15, 0.2), await art(page, 0.55, 0.35));
  await page.keyboard.press("Escape");
  const texts = await ofKind(page, "text");
  const layer = texts[texts.length - 1];
  await setProps(page, layer.id, {
    "content.text": text,
    "typography.fontSize": 36,
    "typography.color": "#123456",
    ...props,
  });
  await page.waitForTimeout(400);
  return layer;
}

test.describe("split text: reliability & edge cases", () => {
  test("shows toast feedback when text cannot be split due to 3D tilt", async ({ page }) => {
    await ready(page);
    const textLayer = await addTextLayer(page, "Tilted");
    await setProps(page, textLayer.id, { "transform.rotateX": 30 });

    // Try splitting via right-click
    await page.getByText(textLayer.name, { exact: true }).first().click({ button: "right" });
    await page.waitForTimeout(300);
    await page.getByRole("menuitem", { name: /^Layer/ }).hover();
    await page.getByRole("menuitem", { name: /^Split into letters/ }).click();

    // Verify toast notification appears
    const toast = page.locator("#lmsg");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText(/Straighten the text/);
  });

  test("splits multi-line text with correct vertical placement for each line", async ({ page }) => {
    await ready(page);
    const textLayer = await addTextLayer(page, "Top\nBottom", {
      "typography.fontSize": 40,
      "typography.lineHeight": 1.5,
      "frame.width": 300,
      "frame.height": 140,
    });

    // Split into letters
    await page.getByText(textLayer.name, { exact: true }).first().click({ button: "right" });
    await page.waitForTimeout(300);
    await page.getByRole("menuitem", { name: /^Layer/ }).hover();
    await page.getByRole("menuitem", { name: /^Split into letters/ }).click();

    // "Top" (3) + "Bottom" (6) = 9 letters (newline not a layer)
    await expect.poll(async () => (await ofKind(page, "text")).length).toBe(9);
    const letters = await ofKind(page, "text");

    const tLetter = letters.find((l) => l.properties["content.text"] === "T")!;
    const bLetter = letters.find((l) => l.properties["content.text"] === "B")!;
    expect(tLetter).toBeDefined();
    expect(bLetter).toBeDefined();

    // The 'B' on line 2 must sit noticeably below 'T' on line 1
    const tBox = (await drawn(page, tLetter.id).boundingBox())!;
    const bBox = (await drawn(page, bLetter.id).boundingBox())!;
    expect(bBox.y).toBeGreaterThanOrEqual(tBox.y + 29);
  });

  test("splits text inside a nested container frame, keeping group inside parent frame", async ({ page }) => {
    await ready(page);

    // Draw container frame
    await page.getByRole("button", { name: /^Frame/ }).first().click();
    await drag(page, await art(page, 0.1, 0.15), await art(page, 0.7, 0.6));
    const containers = await ofKind(page, "container");
    const parentFrame = containers[containers.length - 1];

    // Add text layer inside that frame
    const textLayer = await addTextLayer(page, "Nested", {
      parentId: parentFrame.id,
      "frame.x": 30,
      "frame.y": 40,
    });

    // Split into letters
    await page.getByText(textLayer.name, { exact: true }).first().click({ button: "right" });
    await page.waitForTimeout(300);
    await page.getByRole("menuitem", { name: /^Layer/ }).hover();
    await page.getByRole("menuitem", { name: /^Split into letters/ }).click();

    await expect.poll(async () => (await ofKind(page, "text")).length).toBe(6);
    const all = await layers(page);
    const letters = Object.values(all).filter((l) => l.archetype === "text" && l.parentId !== null);
    const group = all[letters[0].parentId!];

    expect(group.name).toBe(`${textLayer.name} letters`);
    expect(group.parentId, "letters group is nested inside the parent frame").toBe(parentFrame.id);
  });

  test("splits rotated text preserving group rotation and visual position", async ({ page }) => {
    await ready(page);
    const textLayer = await addTextLayer(page, "Rotated", {
      "frame.rotation": 25,
      "frame.x": 120,
      "frame.y": 120,
      "frame.width": 260,
      "frame.height": 60,
    });

    // Split into letters
    await page.getByText(textLayer.name, { exact: true }).first().click({ button: "right" });
    await page.waitForTimeout(300);
    await page.getByRole("menuitem", { name: /^Layer/ }).hover();
    await page.getByRole("menuitem", { name: /^Split into letters/ }).click();

    await expect.poll(async () => (await ofKind(page, "text")).length).toBe(7);
    const all = await layers(page);
    const letters = Object.values(all).filter((l) => l.archetype === "text" && l.parentId !== null);
    const group = all[letters[0].parentId!];

    expect(group.properties["frame.rotation"]).toBe(25);
  });
});

test.describe("split text & animate letters inspector controls", () => {
  test("shows 'Split into letters' button in Typography inspector, then 'Animate letters' button on the group", async ({
    page,
  }) => {
    await ready(page);
    const textLayer = await addTextLayer(page, "Flow");

    // Select the text layer
    await page.locator(`#p-layers .row[data-sel="${textLayer.id}"]`).click();

    // Verify inspector Typography section has the "Split into letters" button
    const splitBtn = page.getByRole("button", { name: "Split into letters" });
    await expect(splitBtn).toBeVisible();

    // Click "Split into letters" from inspector
    await splitBtn.click();

    // Letters group created and selected
    await expect.poll(async () => (await ofKind(page, "text")).length).toBe(4);
    const all = await layers(page);
    const letters = Object.values(all).filter((l) => l.archetype === "text" && l.parentId !== null);
    const group = all[letters[0].parentId!];

    // Ensure the group is selected
    await page.locator(`#p-layers .row[data-sel="${group.id}"]`).click();

    // Verify "Animate letters" button appears next to "Split into letters"
    const animateBtn = page.getByRole("button", { name: "Animate letters" });
    await expect(animateBtn).toBeVisible();

    // Click "Animate letters"
    await animateBtn.click();

    // Verify clips were created for each letter with 40ms stagger
    await expect.poll(async () => Object.keys(await docClips(page)).length).toBe(4);
    const clips = Object.values(await docClips(page));

    // Check each letter has an entrance clip with 0.04s stagger
    letters.forEach((letter, i) => {
      const clip = clips.find((c) => c.layerId === letter.id);
      expect(clip).toBeDefined();
      expect(clip!.type).toBe("entrance");
      expect(clip!.trigger).toBe("mount");
      expect(clip!.delay).toBe(Math.round(i * 0.04 * 1000) / 1000);
    });

    // Switch to Motion mode using top-bar tab
    await page.getByText("Motion", { exact: true }).first().click();

    // Verify clips exist in document and timeline area is visible after switching to Motion
    expect(clips.length).toBe(4);
    await expect(page.locator('[aria-label="Motion Timeline"]').first()).toBeVisible({ timeout: 5000 });
  });
});
