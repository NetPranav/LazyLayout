/**
 * "Anyone can make it" demo: the inflated "Get Started" button in 7 steps, with only the editor's own buttons and keys
 * (nothing set behind the scenes), in a visible, slowed-down browser with View > Show keystrokes on. The window stays
 * open at the end for you to use. Stop with Ctrl+C.
 *
 *   npx tsx scripts/demo-balloon-steps.ts [--base http://localhost:3003] [--slow 500] [--reference path/to/picture.png]
 *
 * 1. File > Place reference image (the picture you're copying, behind everything, never exported)
 * 2. F and drag: a frame the size of the button
 * 3. The right panel's 3D switch
 * 4. Foil balloon (one click)
 * 5. T, click inside, type the label
 * 6. The label: light colour and size 44 (2D panel)
 * 7. Motion tab, press it
 */
import { chromium, type Page } from "@playwright/test";

const argOf = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const base = argOf("base", "http://localhost:3000");
const slow = Number(argOf("slow", "500"));
const reference = argOf("reference", "");
const shots = argOf("shots", "");
let shotN = 0;

type Win = { __LL_TEST__: boolean; __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; name?: string }> } }; __LL_SCREENCAST__?: { note: (t: string) => void } };
const wait = (page: Page, ms: number) => page.waitForTimeout(shots ? Math.min(ms, 300) : ms);
const note = async (page: Page, text: string, ms = 1800) => {
  await page.evaluate((t) => (window as unknown as Win).__LL_SCREENCAST__?.note(t), text);
  await wait(page, ms);
};
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${String(++shotN).padStart(2, "0")}-${name}.png` });
};
const layersOf = (page: Page, archetype: string) =>
  page.evaluate((a) => Object.values((window as unknown as Win).__LL_DOC__.get().layers).filter((l) => l.archetype === a).map((l) => l.id), archetype);

async function typeInto(page: Page, label: string, value: string | number) {
  const field = page.getByRole("textbox", { name: label, exact: true }).or(page.getByRole("spinbutton", { name: label, exact: true })).first();
  await field.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(String(value), { delay: 110 });
  await page.keyboard.press("Enter");
}

async function main() {
  const browser = await chromium.launch({ headless: !!shots, slowMo: shots ? 0 : slow, args: ["--window-size=1600,1080"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await page.goto(`${base}/editor?keys=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => new URL(location.href).searchParams.has("projectId"), undefined, { timeout: 90_000 });
  await page.locator("[data-stage=artboard]").waitFor({ timeout: 90_000 });
  await wait(page, 1200);
  // an empty page to start from (not one of the 7 steps)
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const row = page.getByText(name, { exact: true }).first();
    if (!(await row.isVisible().catch(() => false))) continue;
    await row.click();
    await page.keyboard.press("Delete");
  }
  await note(page, "The inflated button in 7 steps", 2200);

  // 1. the reference
  if (reference) {
    await note(page, "Step 1 · File > Place reference image");
    await page.getByRole("button", { name: "Application menu" }).click();
    await page.getByRole("menuitem", { name: /^File/ }).first().hover().catch(() => undefined);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: /Place reference image/ }).click();
    await (await chooser).setFiles(reference);
    await wait(page, 1500);
    // the reference is selected: Shift+2 zooms to it
    await page.locator("[data-stage=artboard]").hover();
    await page.keyboard.press("Shift+2");
    await wait(page, 1200);
    await page.keyboard.press("Escape");
  }
  await shot(page, "reference");

  // 2. a frame
  await note(page, "Step 2 · F, then drag a frame the size of the button");
  // over the reference's button (the reference picture is 720 × 720; its button is at 133, 278 to 587, 438)
  const refs = await layersOf(page, "image");
  const refBox = refs.length ? await page.locator(`[data-testid="stage-page"] [data-element-id="${refs[0]}"]`).first().boundingBox() : null;
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  const from = refBox ? { x: refBox.x + (133 / 720) * refBox.width, y: refBox.y + (278 / 720) * refBox.height } : { x: art.x + art.width * 0.43, y: art.y + art.height * 0.4 };
  const to = refBox ? { x: refBox.x + (587 / 720) * refBox.width, y: refBox.y + (438 / 720) * refBox.height } : { x: art.x + art.width * 0.59, y: art.y + art.height * 0.5 };
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("f");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 30 });
  await page.mouse.up();
  await wait(page, 800);
  const frames = await layersOf(page, "container");
  const btn = frames[frames.length - 1];

  // 3–4. 3D, Foil balloon
  await note(page, "Step 3 · Select the frame, switch the right panel to 3D");
  await page.getByText("Frame", { exact: true }).first().click();
  await page.getByRole("radio", { name: "3D" }).or(page.getByRole("tab", { name: "3D" })).or(page.getByRole("button", { name: "3D", exact: true })).first().click();
  await wait(page, 1000);
  await note(page, "Step 4 · Foil balloon (one click)");
  await page.getByRole("button", { name: "Foil balloon" }).click();
  await wait(page, 2500);
  await shot(page, "balloon");

  // 5. the label
  await note(page, "Step 5 · T, click inside, type the label");
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("t");
  const box = (await page.locator(`[data-testid="stage-page"] [data-element-id="${btn}"]`).first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.4);
  await page.getByTestId("stage-text-editor").waitFor({ timeout: 5000 }).catch(() => undefined);
  await page.keyboard.type("Get Started", { delay: 130 });
  await page.keyboard.press("Escape");
  await wait(page, 600);
  await shot(page, "label");

  // 6. the label's colour and size
  await note(page, "Step 6 · The label: 2D, light colour, size 44");
  await page.getByText(/^(Get Started|Text)$/).first().click();
  await page.getByRole("radio", { name: "2D" }).or(page.getByRole("tab", { name: "2D" })).or(page.getByRole("button", { name: "2D", exact: true })).first().click();
  await wait(page, 600);
  await typeInto(page, "Fill hex", "E4E4E4").catch(() => undefined);
  await typeInto(page, "Size", 44).catch(() => undefined);
  await page.keyboard.press("Escape");
  await page.locator("[data-stage=workspace]").click({ position: { x: 12, y: 300 } });
  await wait(page, 1500);
  await shot(page, "styled");

  // 7. press it
  await note(page, "Step 7 · Motion tab: press it");
  await page.getByRole("tab", { name: "Motion" }).click();
  await wait(page, 1500);
  const b = (await page.locator(`[data-testid="stage-page"] [data-element-id="${btn}"]`).first().boundingBox())!;
  for (const [fx, fy] of [[0.24, 0.39], [0.8, 0.67], [0.505, 0.31], [0.065, 0.61]] as const) {
    await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 20 });
    await page.mouse.down();
    await wait(page, 260);
    await shot(page, "press");
    await page.mouse.up();
    await wait(page, 1500);
  }
  if (shots) {
    await browser.close();
    return;
  }
  await note(page, "Done in 7 steps. It's yours: press it anywhere. (Ctrl+C to stop.)", 4000);
  console.log("[demo] done; the window stays open. Ctrl+C to stop.");
  await new Promise(() => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
