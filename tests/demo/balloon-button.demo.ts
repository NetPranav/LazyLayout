/**
 * Demo: the glossy inflated "Get Started" button from the collectui reference video, built step by step in the editor
 * with View > Show keystrokes on, in a visible, slowed-down browser. Run: `npm run demo` (see playwright.demo.config.ts).
 *
 * What is done with the editor's own keys and mouse: clearing the page, R and a drag for the rectangle, the size and
 * corner radius typed into the inspector, T and a click for the text, the Motion tab, the composition tab, Space to play.
 * What is set as values (shown as a note on screen): the fill and shadow stacks and the text style, because the inspector
 * has no keyboard path to a gradient stop yet, and the press animation's keyframes.
 *
 * Not possible yet (said on screen at the end): the crinkled reflections (needs a noise fill, Phase 114) and the dent that
 * follows the press (displacement and press states, Phases 78-79, Lane B).
 */
import { test, expect, type Page } from "@playwright/test";

type Doc = {
  get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null }> };
  commands: {
    updateProps: (id: string, p: Record<string, unknown>) => void;
    addClip: (layerId: string, clip: unknown, label?: string, placement?: { compositionId: string; offset?: number }) => string;
  };
};
type Win = { __LL_TEST__: boolean; __LL_DOC__: Doc; __LL_SCREENCAST__?: { note: (t: string) => void } };

const pause = (page: Page, ms = 900) => page.waitForTimeout(ms);
async function note(page: Page, text: string, ms = 1600) {
  await page.evaluate((t) => (window as unknown as Win).__LL_SCREENCAST__?.note(t), text);
  await pause(page, ms);
}
const layersOf = (page: Page, archetype: string) =>
  page.evaluate((a) => Object.values((window as unknown as Win).__LL_DOC__.get().layers).filter((l) => l.archetype === a).map((l) => l.id), archetype);

/** Types a value into an inspector number field by its label; false when the field isn't there. */
async function typeField(page: Page, label: string, value: number): Promise<boolean> {
  const field = page.getByRole("textbox", { name: label, exact: true }).or(page.getByRole("spinbutton", { name: label, exact: true })).first();
  if (!(await field.isVisible().catch(() => false))) return false;
  await field.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(String(value), { delay: 90 });
  await page.keyboard.press("Enter");
  await pause(page, 500);
  return true;
}

test("demo: the balloon button, built step by step", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await page.goto("/editor?keys=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => new URL(location.href).searchParams.has("projectId"), undefined, { timeout: 60_000 });
  await expect(page.locator("[data-stage=artboard]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("screencast-keys")).toBeAttached();
  await pause(page, 1200);
  await note(page, "Balloon button, from generic properties only", 2200);

  // 1. An empty page: pick each sample section in Layers and press Delete
  await note(page, "Clear the sample page");
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const row = page.getByText(name, { exact: true }).first();
    if (!(await row.isVisible().catch(() => false))) continue;
    await row.click();
    await page.keyboard.press("Delete");
    await pause(page, 500);
  }

  // 2. R, then drag: a rectangle
  await note(page, "R: the rectangle tool, then drag");
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("r");
  await page.mouse.move(art.x + art.width * 0.32, art.y + art.height * 0.38);
  await page.mouse.down();
  await page.mouse.move(art.x + art.width * 0.6, art.y + art.height * 0.52, { steps: 25 });
  await page.mouse.up();
  await pause(page);
  const [id] = await layersOf(page, "rectangle");
  expect(id, "the drag made a rectangle").toBeTruthy();

  // 3. Size and corner radius, typed into the inspector
  await note(page, "Size 360 × 140, corner radius 38");
  const typed = (await typeField(page, "W", 360)) && (await typeField(page, "H", 140));
  const radiusTyped = await typeField(page, "Corner radius", 38);
  console.log(`[demo] typed into the inspector: size ${typed}, radius ${radiusTyped}`);
  if (!typed || !radiusTyped) {
    await note(page, "(field not in view: set as values)");
    await page.evaluate((i) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i, { "frame.width": 360, "frame.height": 140, "shape.cornerRadius": 38 }), id);
  }
  await page.evaluate((i) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i, { "frame.x": 520, "frame.y": 330 }), id);
  await pause(page);

  // 4. The material: two gradient fills (a screen-blended sheen over a dark body) and three shadows
  await note(page, "Material: dark body fill + white sheen (Screen blend)", 1400);
  const stops = (list: Array<[number, string]>) => list.map(([at, color]) => ({ at, color }));
  const body = { type: "linear", from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 }, stops: stops([[0, "#454545"], [0.3, "#161616"], [0.72, "#070707"], [1, "#222222"]]), opacity: 1, visible: true };
  const sheen = { type: "radial", center: { x: 0.5, y: 0.18 }, radius: { x: 0.5, y: 0.45 }, stops: stops([[0, "#FFFFFF"], [1, "#000000"]]), opacity: 0.4, visible: true, blend: "screen" };
  await page.evaluate(([i, f]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, { "paint.fills": JSON.stringify(f) }), [id, [body]] as const);
  await pause(page, 1000);
  await page.evaluate(([i, f]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, { "paint.fills": JSON.stringify(f) }), [id, [sheen, body]] as const);
  await pause(page, 1000);
  await note(page, "Shadows: lit top edge, dark underside, soft drop shadow", 1400);
  const shadows = [
    { kind: "inner", x: 0, y: 3, blur: 4, spread: 0, color: "#FFFFFF", visible: true },
    { kind: "inner", x: 0, y: -8, blur: 14, spread: 0, color: "#000000", visible: true },
    { kind: "drop", x: 0, y: 16, blur: 26, spread: -6, color: "rgba(0,0,0,0.45)", visible: true },
  ];
  for (let n = 1; n <= shadows.length; n++) {
    await page.evaluate(([i, s]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, { "paint.shadows": JSON.stringify(s) }), [id, shadows.slice(0, n)] as const);
    await pause(page, 700);
  }

  // 5. T, click, type: the label
  await note(page, "T: the text tool, click, type");
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("t");
  const rect = (await page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first().boundingBox())!;
  await page.mouse.click(rect.x + rect.width * 0.3, rect.y + rect.height * 0.35);
  await pause(page, 700);
  await expect(page.getByTestId("stage-text-editor"), "a new text opens for typing").toBeVisible();
  await page.keyboard.type("Get Started", { delay: 120 });
  await page.keyboard.press("Escape");
  await pause(page);
  const texts = await layersOf(page, "text");
  const label = texts[texts.length - 1];
  if (label) {
    await note(page, "Text: white, 34 px, semibold, centred on the button");
    await page.evaluate(
      ([t]) =>
        (window as unknown as Win).__LL_DOC__.commands.updateProps(t as string, {
          "typography.color": "#FFFFFF",
          "typography.fontSize": 34,
          "typography.fontWeight": 600,
          "typography.textAlign": "center",
          "text.sizing": "fixed",
          positioning: "absolute",
          "frame.x": 520,
          "frame.y": 376,
          "frame.width": 360,
          "frame.height": 48,
        }),
      [label] as const,
    );
    await pause(page);
  }
  await page.keyboard.press("Escape");
  await pause(page, 600);

  // Group the button and its label (Shift-click in Layers, Ctrl+G), so the press squishes both
  await note(page, "Shift-click both in Layers, Ctrl+G: one group");
  await page.getByText("Rectangle", { exact: true }).first().click();
  await page.getByText(/^(Get Started|Text)$/).first().click({ modifiers: ["Shift"] });
  await pause(page, 500);
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("Control+g");
  await pause(page);
  const groups = await page.evaluate(() =>
    Object.values((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, { id: string; name?: string }> } } }).__LL_DOC__.get().layers)
      .filter((l) => l.name === "Group")
      .map((l) => l.id),
  );
  const target = groups[groups.length - 1] ?? id;
  console.log(`[demo] animating ${groups.length > 0 ? "the group" : "the rectangle (grouping didn't happen)"}`);
  await page.locator("[data-stage=workspace]").click({ position: { x: 12, y: 300 } });
  await pause(page, 1200);

  // 6. The press: a squish that springs back, in its own interaction composition
  await note(page, "Press animation: squish 0.94, spring back past 1", 1400);
  await page.evaluate((i) => {
    (window as unknown as Win).__LL_DOC__.commands.addClip(
      i,
      {
        id: "clip_balloon_press",
        name: "Squish",
        type: "tap",
        trigger: "press",
        duration: 0.6,
        easing: "linear",
        enabled: true,
        tracks: [
          {
            id: "trk_balloon_scale", property: "transform.scale", keyframes: [
              { id: "kb0", time: 0, value: 1 },
              { id: "kb1", time: 0.12, value: 0.94, ease: "cubic-bezier(0.3, 0, 0.6, 1)" },
              { id: "kb2", time: 0.6, value: 1, ease: "spring(bounce: 0.45, time: 0.45)" },
            ]
          },
        ],
      },
      "Press animation",
    );
  }, target);
  await pause(page);

  // 7. Watch it in Motion: open the press composition's tab, play with Space
  await page.getByRole("tab", { name: "Motion" }).click();
  await pause(page, 1200);
  const pressTab = page.getByRole("tablist", { name: "Compositions" }).getByRole("tab").filter({ hasText: /Press/ }).first();
  if (await pressTab.isVisible().catch(() => false)) {
    await note(page, "The press is its own timeline: open its tab");
    await pressTab.click();
    await pause(page);
  }
  await page.locator('[data-testid="timeline-ruler"]').hover();
  await page.keyboard.press("Home");
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Space");
    await pause(page, 1300);
    await page.keyboard.press("Space");
    await page.keyboard.press("Home");
    await pause(page, 500);
  }

  // 8. What the reference has that this doesn't, yet
  await note(page, "Not yet: crinkled reflections (noise fill, Phase 114)", 2600);
  await note(page, "Not yet: the dent under the press (displacement + states, 78-79)", 3200);
  await pause(page, 2500);
});
