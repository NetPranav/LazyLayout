/**
 * The new editor's primary test: build a full landing-page hero (the "Adventure" mountain hero: a photo, a dark wash, a
 * navigation bar with a search pill, a login pill, an underline, a side counter, arrows, a giant title, a tagline and
 * a bottom bar of four items) using nothing but the Design tab: the bottom bar, the canvas and the inspector. If a
 * basic thing a designer needs does not work, this fails at that step and names it.
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; name: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
const layers = (page: Page) => page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
const created = async (page: Page, archetype: string) => Object.values(await layers(page)).filter((l) => l.archetype === archetype);

const YELLOW = "F5E80A";
const W = 1440;

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.locator("body").click({ position: { x: 700, y: 140 } });
}

/** A free spot inside the artboard that no layer of the hero will sit on while we draw (the top-right corner of the page). */
async function scratch(page: Page) {
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  return { x: b.x + b.width * 0.82, y: b.y + b.height * 0.55, w: b.width * 0.1, h: b.height * 0.1 };
}

async function draw(page: Page) {
  const s = await scratch(page);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + s.w / 2, s.y + s.h / 2, { steps: 3 });
  await page.mouse.move(s.x + s.w, s.y + s.h, { steps: 3 });
  await page.mouse.up();
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).first();
async function setNumber(page: Page, label: string, value: number) {
  const f = field(page, label);
  await f.fill(String(value));
  await f.press("Enter");
}
async function box(page: Page, x: number, y: number, w: number, h: number) {
  await setNumber(page, "W", w);
  await setNumber(page, "H", h);
  await setNumber(page, "X", x);
  await setNumber(page, "Y", y);
}
async function fill(page: Page, hex: string, opacityPct?: number) {
  const hexField = page.getByLabel("Fill hex", { exact: true }).first();
  await hexField.fill(hex);
  await hexField.press("Enter");
  if (opacityPct !== undefined) {
    const o = page.getByLabel("Fill opacity", { exact: true }).first();
    await o.fill(String(opacityPct));
    await o.press("Enter");
  }
}

async function rect(page: Page, o: { x: number; y: number; w: number; h: number; fill?: string; fillOpacity?: number; radius?: number; stroke?: boolean }) {
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Rectangle/ }).click();
  await draw(page);
  await box(page, o.x, o.y, o.w, o.h);
  if (o.fill) await fill(page, o.fill, o.fillOpacity);
  if (o.radius !== undefined) await setNumber(page, "Corner radius", o.radius);
  if (o.stroke) await page.getByRole("button", { name: "Add stroke", exact: true }).click();
}

async function strokeOf(page: Page, hex: string, width: number) {
  await page.getByRole("button", { name: "Add stroke", exact: true }).click();
  await page.getByRole("button", { name: "Stroke 1 settings" }).click();
  const h = page.getByLabel("Stroke hex", { exact: true }).first();
  await h.fill(hex);
  await h.press("Enter");
  const w = page.getByLabel("Stroke width", { exact: true }).first();
  await w.fill(String(width));
  await w.press("Enter");
  await page.keyboard.press("Escape");
}

async function ellipse(page: Page, o: { x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number }) {
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Ellipse/ }).click();
  await draw(page);
  await box(page, o.x, o.y, o.w, o.h);
  await fill(page, "000000", 0);
  await strokeOf(page, o.stroke, o.strokeWidth);
}

async function text(page: Page, content: string, o: { x: number; y: number; w: number; h: number; size: number; weight?: string; color?: string; align?: "center" }) {
  await page.getByRole("button", { name: /^Text/ }).first().click();
  await draw(page);
  await page.getByLabel("Text content", { exact: true }).fill(content);
  await box(page, o.x, o.y, o.w, o.h);
  await setNumber(page, "Size", o.size);
  if (o.weight) {
    await page.getByLabel("Font weight", { exact: true }).click();
    await page.getByRole("option", { name: new RegExp(o.weight) }).first().click();
  }
  if (o.color) await fill(page, o.color);
  if (o.align === "center") await page.getByRole("radio", { name: "Align center", exact: true }).click();
}

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe("build the Adventure hero in the new editor", () => {
  test("a designer can build the whole hero from the Design tab", async ({ page }) => {
    test.setTimeout(420_000);
    await ready(page);

    // 1. start from an empty page: delete the sample sections one by one from the Layers panel
    for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
      await page.getByText(name, { exact: true }).first().click();
      await page.keyboard.press("Delete");
    }
    const rootChildren = async () => Object.values(await layers(page)).find((l) => l.parentId === null)!.children.length;
    expect(await rootChildren(), "the sample page is cleared").toBe(0);

    // 2. the photo: the Image tool asks for a file and puts it on the page
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Image", exact: true }).click();
    await (await chooser).setFiles(path.join(__dirname, "fixtures", "adventure-bg.svg"));
    await expect.poll(async () => (await created(page, "image")).length).toBe(1);
    await box(page, 0, 0, W, 900);
    const photo = (await created(page, "image"))[0];
    await expect(page.locator(`[data-testid="stage-element"][data-element-id="${photo.id}"]`)).toBeVisible();

    // 3. a dark wash over the photo
    await rect(page, { x: 0, y: 0, w: W, h: 900, fill: "000000", fillOpacity: 35 });
    // 4. navigation: logo, search pill, links, login pill, rule and the yellow underline
    await text(page, "S", { x: 112, y: 40, w: 60, h: 60, size: 52, weight: "700", color: "FFFFFF" });
    await rect(page, { x: 290, y: 52, w: 400, h: 36, fill: "FFFFFF", fillOpacity: 22, radius: 18 });
    await text(page, "Search...", { x: 336, y: 60, w: 200, h: 22, size: 16, color: "FFFFFF" });
    await text(page, "Adventure", { x: 812, y: 58, w: 100, h: 22, size: 16, weight: "500", color: YELLOW });
    await text(page, "About", { x: 940, y: 58, w: 70, h: 22, size: 16, color: "FFFFFF" });
    await text(page, "Blogs", { x: 1045, y: 58, w: 70, h: 22, size: 16, color: "FFFFFF" });
    await text(page, "Book Now", { x: 1140, y: 58, w: 100, h: 22, size: 16, color: "FFFFFF" });
    await rect(page, { x: 1280, y: 54, w: 70, h: 28, fill: "000000", fillOpacity: 0, radius: 14, stroke: false });
    await strokeOf(page, "FFFFFF", 1);
    await text(page, "Login", { x: 1296, y: 58, w: 50, h: 20, size: 14, color: "FFFFFF" });
    await rect(page, { x: 0, y: 122, w: W, h: 1, fill: "FFFFFF", fillOpacity: 70 });
    await rect(page, { x: 810, y: 120, w: 90, h: 4, fill: YELLOW });

    // 5. the side counter and the slide arrows
    for (const [n, y] of [["01", 245], ["02", 425], ["03", 463], ["04", 505]] as const) await text(page, n, { x: 118, y, w: 40, h: 20, size: 15, color: "FFFFFF" });
    await rect(page, { x: 130, y: 280, w: 2, h: 120, fill: "FFFFFF" });
    await text(page, "‹", { x: 10, y: 360, w: 50, h: 110, size: 110, color: "FFFFFF" });
    await text(page, "›", { x: 1385, y: 360, w: 50, h: 110, size: 110, color: "FFFFFF" });

    // 6. the giant title and the tagline
    await text(page, "ADVENTURE", { x: 220, y: 380, w: 1000, h: 200, size: 150, weight: "700", color: "FFFFFF", align: "center" });
    await text(page, "Create Your Outdoor Adventure. Discover With Us.", { x: 470, y: 600, w: 560, h: 30, size: 20, color: "FFFFFF" });

    // 7. the bottom bar: a dark band, four place pins with two lines each, and the yellow and grey rules
    await rect(page, { x: 0, y: 730, w: W, h: 118, fill: "0A0F14", fillOpacity: 70 });
    const items: Array<[number, string, string, string]> = [
      [120, "Be yourself", "with new emotion", YELLOW],
      [458, "Create Your Outdoor Adventure.", "Discover With Us.", "FFFFFF"],
      [808, "Be a yourself", "with new emotion", "FFFFFF"],
      [1135, "With new emotion", "Be a yourself", "FFFFFF"],
    ];
    for (const [x, one, two, color] of items) {
      await ellipse(page, { x, y: 764, w: 36, h: 36, stroke: color, strokeWidth: 1 });
      await text(page, `${one}\n${two}`, { x: x + 50, y: 762, w: 260, h: 44, size: 14, color });
    }
    await rect(page, { x: 108, y: 842, w: 290, h: 3, fill: YELLOW });
    await rect(page, { x: 398, y: 843, w: 970, h: 1, fill: "FFFFFF", fillOpacity: 35 });

    const all = Object.values(await layers(page));
    const title = all.find((l) => l.properties["content.text"] === "ADVENTURE")!;
    expect(title.properties["typography.fontSize"]).toBe(150);
    expect(String(title.properties["typography.color"]).toLowerCase()).toBe("#ffffff");
    // the basics a designer relies on: the corner radius of a rectangle took (the search pill), the login pill has its stroke
    const pill = Object.values(await layers(page)).find((l) => l.archetype === "rectangle" && l.properties["shape.cornerRadius"] === 18);
    expect(pill, "the search pill is a rectangle with a corner radius of 18").toBeTruthy();
    const login = Object.values(await layers(page)).find((l) => l.archetype === "rectangle" && l.properties["shape.cornerRadius"] === 14)!;
    expect(String(login.properties["svg.stroke"] ?? login.properties["appearance.border.color"]).toLowerCase()).toMatch(/#?ffffff/);

    // selecting works both ways: a click on the canvas picks the layer in the Layers panel and the inspector, and a row picks it on the canvas
    const titleEl = page.locator(`[data-testid="stage-element"][data-element-id="${title.id}"]`);
    await page.getByRole("button", { name: "Select (V)", exact: true }).first().click();
    await titleEl.click({ force: true });
    await expect(page.getByLabel("Text content", { exact: true })).toHaveValue("ADVENTURE");
    const wash = Object.values(await layers(page)).find((l) => l.archetype === "rectangle" && l.properties["frame.width"] === W && l.properties["frame.height"] === 900)!;
    await page.getByText("Ellipse", { exact: true }).first().click();
    await expect(page.locator('[data-testid="stage-element"][data-selected="true"]')).toHaveCount(1);
    expect(wash).toBeTruthy();

    // the page is made of what we built: the photo, rectangles, ellipses and text, all on one page
    const made = Object.values(await layers(page)).filter((l) => l.parentId !== null);
    expect(made.length, "layers on the page").toBeGreaterThanOrEqual(30);
    await page.locator("[data-stage=artboard]").screenshot({ path: "test-results/adventure-hero.png" });
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  });
});
