/**
 * Watch-it-being-made demo: a visible, slowed-down browser builds the inflated "Get Started" button in the editor with
 * View > Show keystrokes on, turns its surface settings up one at a time (so you see it inflate, crease and wrinkle),
 * presses it at the reference video's four points, and then LEAVES THE WINDOW OPEN for you to use. Stop it with Ctrl+C.
 *
 *   npx tsx scripts/demo-balloon-surface.ts [--base http://localhost:3003] [--slow 450]
 *
 * Real keys and mouse: clearing the page, F and a drag for the frame, the size typed into the inspector, T and typing
 * for the label, the Motion tab, the presses. Set as values (a note on screen says which): fills, text style, layout,
 * and the surface settings, which have no inspector section yet.
 */
import { chromium, type Page } from "@playwright/test";

const argOf = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const base = argOf("base", "http://localhost:3000");
const slow = Number(argOf("slow", "450"));
/** A check run: fast, screenshots after each step into --shots, then exits instead of staying open. */
const shots = argOf("shots", "");
let shotN = 0;
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${String(++shotN).padStart(2, "0")}-${name}.png` });
};

type Win = {
  __LL_TEST__: boolean;
  __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; name?: string; parentId: string | null }> }; commands: { updateProps: (id: string, p: Record<string, unknown>) => void } };
  __LL_SCREENCAST__?: { note: (t: string) => void };
};

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);
const note = async (page: Page, text: string, ms = 1800) => {
  await page.evaluate((t) => (window as unknown as Win).__LL_SCREENCAST__?.note(t), text);
  await wait(page, ms);
};
const set = (page: Page, id: string, props: Record<string, unknown>) => page.evaluate(([i, p]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, p as Record<string, unknown>), [id, props] as const);
const layersOf = (page: Page, archetype: string) =>
  page.evaluate((a) => Object.values((window as unknown as Win).__LL_DOC__.get().layers).filter((l) => l.archetype === a).map((l) => l.id), archetype);

async function typeField(page: Page, label: string, value: string | number): Promise<boolean> {
  const field = page.getByRole("textbox", { name: label, exact: true }).or(page.getByRole("spinbutton", { name: label, exact: true })).first();
  if (!(await field.isVisible().catch(() => false))) return false;
  await field.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(String(value), { delay: 110 });
  await page.keyboard.press("Enter");
  await wait(page, 400);
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: !!shots, slowMo: shots ? 0 : slow, args: ["--window-size=1600,1080"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await page.goto(`${base}/editor?keys=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => new URL(location.href).searchParams.has("projectId"), undefined, { timeout: 90_000 });
  await page.locator("[data-stage=artboard]").waitFor({ timeout: 90_000 });
  await wait(page, 1500);
  await note(page, "The inflated button, built step by step", 2500);

  // 1. an empty page
  await note(page, "Clear the sample page");
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const row = page.getByText(name, { exact: true }).first();
    if (!(await row.isVisible().catch(() => false))) continue;
    await row.click();
    await page.keyboard.press("Delete");
  }

  // 2. F and a drag: the frame that becomes the button
  await note(page, "F: the frame tool, then drag");
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("f");
  await page.mouse.move(art.x + art.width * 0.3, art.y + art.height * 0.36);
  await page.mouse.down();
  await page.mouse.move(art.x + art.width * 0.62, art.y + art.height * 0.52, { steps: 30 });
  await page.mouse.up();
  await wait(page, 800);
  const frames = (await layersOf(page, "container")).filter(Boolean);
  const btn = frames[frames.length - 1];
  await note(page, "Size 454 × 160, typed into the inspector");
  const typed = (await typeField(page, "W", 454)) && (await typeField(page, "H", 160));
  if (!typed) await set(page, btn, { "frame.width": 454, "frame.height": 160 });
  await note(page, "Corners 30, fill near-black, content centred (values)");
  await set(page, btn, {
    "appearance.radius": 30,
    "appearance.background.color": "#0b0b0b",
    "layout.display": "flex",
    "layout.flexDirection": "row",
    "layout.justifyContent": "center",
    "layout.alignItems": "center",
    "frame.x": 470,
    "frame.y": 300,
    "paint.shadows": JSON.stringify([{ kind: "drop", x: 0, y: 14, blur: 30, spread: -4, color: "rgba(0,0,0,0.28)", visible: true }]),
  });
  await wait(page, 1200);
  await shot(page, "frame");

  // 3. T, click inside, type: the label
  await note(page, "T: the text tool, click inside the frame, type");
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("t");
  const box = (await page.locator(`[data-testid="stage-page"] [data-element-id="${btn}"]`).first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.45);
  await page.getByTestId("stage-text-editor").waitFor({ timeout: 5000 }).catch(() => undefined);
  await page.keyboard.type("Get Started", { delay: 130 });
  await page.keyboard.press("Escape");
  await wait(page, 600);
  const label = (await layersOf(page, "text")).pop();
  if (label) {
    await note(page, "Label: Inter 44, semibold, light grey (values)");
    await set(page, label, { positioning: "flow", "typography.fontFamily": "Inter", "typography.fontSize": 44, "typography.fontWeight": 600, "typography.color": "#e4e4e4", "typography.letterSpacing": -0.4, "text.sizing": "autoWidth" });
  }
  await page.keyboard.press("Escape");
  await page.locator("[data-stage=workspace]").click({ position: { x: 12, y: 300 } });
  await wait(page, 1500);

  await shot(page, "label");
  // a closer look: select the frame, Shift+2 zooms to it
  await note(page, "Select the frame, Shift+2: zoom to it");
  await page.getByText("Frame", { exact: true }).first().click();
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("Shift+2");
  await wait(page, 1200);
  await page.keyboard.press("Escape");
  await wait(page, 800);
  // 4. the surface, one setting at a time
  await note(page, "Surface: Inflated (the frame becomes foil with height)", 2400);
  await set(page, btn, { "surface.mode": "inflated", "surface.depth": 8, "surface.fullness": 0, "surface.creases": 0, "surface.wrinkles": 0, "surface.crinkle": 0 });
  await wait(page, 1500);
  await note(page, "Depth: the air goes in");
  for (const d of [16, 26, 36, 46, 55]) {
    await set(page, btn, { "surface.depth": d });
    await wait(page, 450);
  }
  await wait(page, 1200);
  await note(page, "Creases from the corners");
  for (const c of [0.25, 0.5, 0.75, 1]) {
    await set(page, btn, { "surface.creases": c, "surface.creaseLength": 55 });
    await wait(page, 450);
  }
  await wait(page, 1000);
  await note(page, "Wrinkles along the edges");
  for (const w of [0.25, 0.5, 0.75, 1]) {
    await set(page, btn, { "surface.wrinkles": w, "surface.wrinkleLength": 20 });
    await wait(page, 450);
  }
  await set(page, btn, { "surface.crinkle": 0.25 });
  await wait(page, 1000);
  await note(page, "Press physics: dent 16 px, 60 px wide, springs back");
  await set(page, btn, { "surface.dentDepth": 16, "surface.dentSize": 60, "surface.pressWrinkles": 1, "surface.contentPull": 0.45, "surface.contentWarp": 0.15, "surface.give": 0.03 });
  await wait(page, 1200);

  await shot(page, "surface");
  // 5. press it (Motion: the canvas is live)
  await note(page, "Motion tab: the canvas is live, so presses dent it");
  await page.getByRole("tab", { name: "Motion" }).click();
  await wait(page, 1500);
  const b = (await page.locator(`[data-testid="stage-page"] [data-element-id="${btn}"]`).first().boundingBox())!;
  // the reference video's four press points, as fractions of the button
  for (const [fx, fy, label] of [[0.24, 0.39, "left of the label"], [0.80, 0.67, "bottom right"], [0.505, 0.31, "the middle"], [0.065, 0.61, "the left end"]] as const) {
    await note(page, `Press: ${label}`, 900);
    await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 20 });
    await page.mouse.down();
    await wait(page, 260);
    await shot(page, "press");
    await page.mouse.up();
    await wait(page, 1600);
  }

  await shot(page, "done");
  if (shots) {
    await browser.close();
    return;
  }
  await note(page, "Done. It's yours: press it anywhere. (Close the window or Ctrl+C to stop.)", 4000);
  console.log("[demo] done; the window stays open. Ctrl+C to stop.");
  await new Promise(() => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
