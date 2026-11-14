/**
 * Shared helpers for driving the real editor UI in Playwright, factored out
 * of `phase3-persistence.mjs` (ROADMAP Phase 4.1: "Phase 4 moves this into
 * the Playwright test harness").
 */
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { expect, type Download, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

export const EDITOR_URL = "/editor";
export const LEGACY_EDITOR_URL = "/editor/legacy";

export async function openEditor(page: Page, url = EDITOR_URL) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => new URL(location.href).searchParams.has("projectId"));
  await waitSaved(page);
}

/**
 * Waits until React has hydrated the page (its props are on the DOM nodes): a click that lands before that is lost,
 * which under load left lab pages unloaded until the test timed out.
 */
export async function waitHydrated(page: Page, selector = "main button") {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  }, selector, { timeout: 60_000 });
}

/** The logo button carries the save state: data-state = saved | dirty | saving | error. */
export async function waitSaved(page: Page) {
  await page.waitForTimeout(150);
  const isLegacy = page.url().includes("/editor/legacy");
  if (isLegacy) {
    await page.waitForFunction(() => !document.querySelector(".viewport-action-btn__dirty-dot"), null, {
      timeout: 15_000,
    });
  } else {
    await page.locator('[data-testid="save-status"][data-state="saved"]').waitFor({ state: "attached", timeout: 15_000 });
  }
}

/** Focus the app (not an input or the stage iframe) so shortcuts reach the window. */
export async function focusApp(page: Page) {
  if (page.url().includes("/editor/legacy")) {
    await page.locator(".studio-header__brand").first().click();
  } else {
    await page.getByRole("button", { name: "Application menu" }).first().click();
    await page.keyboard.press("Escape");
  }
}

/** Opens the logo menu and the File submenu (File is a submenu item, not a top-level button). */
export async function openFileMenu(page: Page) {
  if (page.url().includes("/editor/legacy")) {
    await page.getByRole("button", { name: "File", exact: true }).click();
  } else {
    const menu = page.getByRole("menu", { name: "Application menu" });
    if (!(await menu.isVisible().catch(() => false))) await page.getByRole("button", { name: "Application menu" }).first().click();
    await page.getByRole("menuitem", { name: "File", exact: true }).hover();
    await page.getByRole("menu", { name: "File", exact: true }).waitFor({ state: "visible" });
  }
}

export async function openSequencer(page: Page) {
  if (page.url().includes("/editor/legacy")) {
    // The Design workspace folds the drawer away, so open the timeline from the Motion shelf.
    await page.getByRole("button", { name: "Timeline tool" }).click();
    // The Sequencer's code is fetched the first time it is shown (Phase 14).
    await page.locator(".sequencer-ruler-wrap").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(300);
  } else {
    await page.getByRole("tab", { name: "Motion" }).click();
    await page.locator('[aria-label="Motion Timeline"]').first().waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(300);
  }
}

/** File → Export Project File; returns the parsed .lazy.json, saved under `outDir`. */
export async function exportProject(page: Page, outDir: string, label: string) {
  await openFileMenu(page);
  const isLegacy = page.url().includes("/editor/legacy");
  const [download]: [Download, unknown] = (await Promise.all([
    page.waitForEvent("download"),
    isLegacy
      ? page.getByText("Export Project File (.lazy.json)").click()
      : page.getByRole("menuitem", { name: "Export project file" }).click(),
  ])) as [Download, unknown];
  const path = `${outDir}/${label}.lazy.json`;
  await download.saveAs(path);
  return { path, file: JSON.parse(readFileSync(path, "utf8")) };
}

/** JSON with sorted keys: key order carries no meaning (loading re-parses through the schema). */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

/** The parts of an export that must match: the project data, without identity or timestamps. */
export function comparable(file: { snapshot: Record<string, unknown> }): string {
  const { projectId: _id, ...snapshot } = file.snapshot;
  void _id;
  return canonical(snapshot);
}

/** pixelsPerSecond in `MotionSequencer.tsx` — a fixed constant, not derived from the DOM. */
export const SEQUENCER_PIXELS_PER_SECOND = 280;

/** Click the ruler at an exact time, using the fixed px/s scale (an exact seek, no drag jitter). */
export async function seekRuler(page: Page, seconds: number) {
  const ruler = page.locator(".sequencer-ruler-wrap");
  const box = await ruler.boundingBox();
  if (!box) throw new Error("sequencer ruler not found — open the Motion Sequencer first");
  await ruler.click({ position: { x: Math.max(1, seconds * SEQUENCER_PIXELS_PER_SECOND), y: box.height / 2 } });
}

/** Screenshot of the stage (center dock) with editor-chrome animations removed. */
export async function stageShot(page: import("@playwright/test").Page, outDir: string, label: string) {
  await page.mouse.move(5, 995); // no hover states
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  // Editor chrome animates (the stage toolbar's pulsing "HOT RELOAD" / "SIMULATION ACTIVE" dots).
  // `animations: "disabled"` did not pin them on Linux Chromium in CI (9 px at the HOT RELOAD dot),
  // so remove animations and transitions outright: the comparison is about rendering the document.
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await page.waitForTimeout(800);
  const png = await page.locator(".dock-zone--center").first().screenshot({ animations: "disabled" });
  writeFileSync(`${outDir}/${label}.png`, png);
  return png;
}

/** Pixel difference of two PNGs (threshold 0), with the bounding box of the differing pixels. */
export function diffPixels(a: Buffer, b: Buffer, outPath: string) {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return { n: Infinity, note: `size ${A.width}x${A.height} vs ${B.width}x${B.height}` };
  const diff = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0 });
  writeFileSync(outPath, PNG.sync.write(diff));
  // Bounding box of the differing pixels, so a CI failure says *where* without the images.
  let box = "";
  if (n > 0) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
    for (let y = 0; y < A.height; y++) {
      for (let x = 0; x < A.width; x++) {
        const i = (y * A.width + x) * 4;
        if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    }
    box = ` within x ${x0}–${x1}, y ${y0}–${y1} of ${A.width}x${A.height}`;
  }
  return { n, note: `${n} px differ${box}` };
}

/**
 * Picks an item from the toolbar's Shape menu (Rectangle, Ellipse, ...). The menu animates in and out, so the button is only
 * clicked while the menu is not open, and a click that lands as the menu is closing is tried again.
 */
const SHAPE_KEYS: Record<string, string> = { Rectangle: "r", Ellipse: "o", Line: "l", Arrow: "Shift+L", Polygon: "y", Star: "Shift+Y" };
export async function pickShape(page: Page, name: string | RegExp) {
  const shape = page.getByRole("button", { name: "Shape", exact: true });
  // each shape has a shortcut that arms it straight away: no menu animation to race (a Shape click made while the tool is
  // handing back to Select after a draw is closed again by the hand-back, which timed out on slow CI machines)
  const key = typeof name === "string" ? SHAPE_KEYS[name] : undefined;
  if (key) {
    await page.keyboard.press(key);
    try {
      await expect(shape).toHaveAttribute("aria-pressed", "true", { timeout: 2000 });
      return;
    } catch {
      /* no luck (focus was somewhere else): the menu below does it */
    }
  }
  const item = page.getByRole("menuitem", { name: typeof name === "string" ? new RegExp("^" + name) : name });
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await shape.getAttribute("aria-expanded")) !== "true") await shape.click();
    try {
      await item.waitFor({ state: "visible", timeout: 1500 });
      break;
    } catch {
      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "detached", timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  await item.click();
}

/**
 * Chooses an option from one of the inspector's dropdowns, by the control's label and the option's name (a prefix).
 * A second dropdown opened while the first is still closing never draws its list, and how long closing takes depends on the
 * machine, so this waits for every open list to be gone before it opens one, and tries again if the list does not appear.
 */
export async function chooseOption(page: Page, label: string, name: string | RegExp): Promise<void> {
  const option = page.getByRole("option", { name: typeof name === "string" ? new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : name }).first();
  const lists = page.getByRole("listbox");
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(lists).toHaveCount(0, { timeout: 5000 }); // the last list has finished closing
    await page.getByLabel(label, { exact: true }).first().click();
    try {
      await option.waitFor({ state: "visible", timeout: 2500 });
      break;
    } catch {
      await page.waitForTimeout(500); // it did not open: let it settle and try again
    }
  }
  await option.click();
  await expect(lists).toHaveCount(0, { timeout: 5000 });
}
