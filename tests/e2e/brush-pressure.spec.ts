/**
 * ROADMAP Phase 120: a recorded pen stroke (positions, pressure and tilt), played back as pointer events with the
 * brush tool, makes the same path and the same width profile every time and in every browser (compared with the
 * recording's expected result below). The brush's settings bar sets the brush; a mouse stroke uses its speed.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; name?: string; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> } };

test.use({ viewport: { width: 1600, height: 1000 } });

/** The recording: an S-curve drawn light, then hard, then light again, the pen tilting as it goes. */
const RECORDING = Array.from({ length: 48 }, (_, i) => {
  const u = i / 47;
  return { dx: Math.round(u * 300), dy: Math.round(Math.sin(u * Math.PI * 2) * 60), p: Math.round((0.15 + 0.8 * Math.sin(u * Math.PI)) * 1000) / 1000, tiltX: Math.round(u * 40), tiltY: 10 };
});

/** Plays the recording at (x, y) as pen pointer events on the canvas. */
async function play(page: Page, x: number, y: number, pointerType: "pen" | "mouse" = "pen") {
  await page.evaluate(({ rec, x, y, pointerType }) => {
    const fire = (type: string, r: (typeof rec)[number], buttons: number) => {
      const init: PointerEventInit = { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType, isPrimary: true, clientX: x + r.dx, clientY: y + r.dy, pressure: pointerType === "pen" ? (buttons ? r.p : 0) : buttons ? 0.5 : 0, tiltX: pointerType === "pen" ? r.tiltX : 0, tiltY: pointerType === "pen" ? r.tiltY : 0, button: type === "pointermove" ? -1 : 0, buttons };
      const target = document.elementFromPoint(x + rec[0].dx, y + rec[0].dy)!;
      target.dispatchEvent(new PointerEvent(type, init));
    };
    fire("pointerdown", rec[0], 1);
    for (const r of rec.slice(1)) fire("pointermove", r, 1);
    fire("pointerup", rec[rec.length - 1], 0);
  }, { rec: RECORDING, x, y, pointerType });
}

const brushes = (page: Page) => page.evaluate(() => Object.values((window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers).filter((l) => l.name === "Brush").map((l) => ({ path: String(l.properties["svg.path"]), profile: String(l.properties["stroke.widthProfile"] ?? ""), brush: String(l.properties["stroke.brush"] ?? ""), width: l.properties["svg.strokeWidth"] })));

/** The numbers of a path's data. */
const nums = (d: string) => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
    // played-back pointers aren't real devices, so the browser won't capture them: capture is a no-op for them
    const capture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (id: number) {
      try {
        capture.call(this, id);
      } catch {
        /* a played-back pointer */
      }
    };
  });
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
});

test("a recorded pen stroke makes the same path and width profile every time", async ({ page }) => {
  await page.getByRole("button", { name: "Pen tools" }).click();
  await page.getByRole("menuitem", { name: /Brush/ }).click();
  await expect(page.getByRole("toolbar", { name: "Brush settings" })).toBeVisible();
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  const x = Math.round(art.x + 120);
  const y = Math.round(art.y + 200);
  await play(page, x, y);
  await expect.poll(async () => (await brushes(page)).length).toBe(1);
  // the brush stays the tool: draw it again, lower down
  await play(page, x, y + 200);
  await expect.poll(async () => (await brushes(page)).length).toBe(2);
  const [a, b] = await brushes(page);
  expect(b.profile).toBe(a.profile);
  expect(b.path).toBe(a.path);

  // the expected result of the recording (worked out once; any browser must give it)
  const prof = JSON.parse(a.profile) as { t: number; scale: number }[];
  expect(prof).toHaveLength(32);
  expect(prof[0].scale).toBeLessThan(0.35);
  expect(prof[16].scale).toBeGreaterThan(0.95);
  expect(prof[31].scale).toBeLessThan(0.35);
  expect(a.profile).toBe(EXPECTED.profile);
  const got = nums(a.path);
  const want = nums(EXPECTED.path);
  expect(got.length).toBe(want.length);
  expect(Math.max(...got.map((v, i) => Math.abs(v - want[i])))).toBeLessThanOrEqual(0.05);
});

test("the settings bar picks the brush; a mouse stroke takes its width from its speed", async ({ page }) => {
  await page.keyboard.press("b");
  const bar = page.getByRole("toolbar", { name: "Brush settings" });
  await expect(bar).toBeVisible();
  await bar.getByRole("combobox", { name: "Brush", exact: true }).click();
  await page.getByRole("option", { name: "Ink" }).click();
  await bar.getByLabel("Brush size").fill("20");
  await bar.getByLabel("Brush size").press("Enter");
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  // a real mouse drag: slow, then fast
  await page.mouse.move(art.x + 100, art.y + 300);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(art.x + 100 + i * 3, art.y + 300);
  for (let i = 1; i <= 10; i++) await page.mouse.move(art.x + 160 + i * 30, art.y + 300);
  await page.mouse.up();
  await expect.poll(async () => (await brushes(page)).length).toBe(1);
  const [s] = await brushes(page);
  expect(JSON.parse(s.brush).preset).toBe("ink");
  expect(s.width).toBe(20);
  expect(s.profile).not.toBe("");
  await expect(page.locator(`[data-stage=artboard] path[d]`).first()).toBeVisible();
});

/** What the recording gives (recorded in Chromium on 2026-11-15); every browser must give the same. */
const EXPECTED = {
  profile: '[{"t":0,"scale":0.2716},{"t":0.0323,"scale":0.3161},{"t":0.0645,"scale":0.3727},{"t":0.0968,"scale":0.4373},{"t":0.129,"scale":0.5064},{"t":0.1613,"scale":0.5769},{"t":0.1935,"scale":0.6515},{"t":0.2258,"scale":0.7237},{"t":0.2581,"scale":0.7943},{"t":0.2903,"scale":0.8563},{"t":0.3226,"scale":0.9052},{"t":0.3548,"scale":0.9406},{"t":0.3871,"scale":0.9647},{"t":0.4194,"scale":0.9832},{"t":0.4516,"scale":0.9941},{"t":0.4839,"scale":1},{"t":0.5161,"scale":1},{"t":0.5484,"scale":0.9941},{"t":0.5806,"scale":0.9832},{"t":0.6129,"scale":0.9647},{"t":0.6452,"scale":0.9406},{"t":0.6774,"scale":0.9052},{"t":0.7097,"scale":0.8563},{"t":0.7419,"scale":0.7943},{"t":0.7742,"scale":0.7237},{"t":0.8065,"scale":0.6515},{"t":0.8387,"scale":0.5769},{"t":0.871,"scale":0.5064},{"t":0.9032,"scale":0.4373},{"t":0.9355,"scale":0.3727},{"t":0.9677,"scale":0.3161},{"t":1,"scale":0.2716}]',
  path: "M1.64 99.79C11.98 132.25 29.47 189.53 47.7 195.49C62.88 200.46 76.21 167.77 85.41 143.22C86.83 139.44 88.17 135.5 89.51 131.56C96.63 110.65 103.37 88.94 110.49 68.03C123.94 28.56 142.91 -17.87 164.92 15.35C169.42 22.15 173.62 31.26 177.38 40.28C185.01 58.61 191.79 79.17 198.36 99.79",
};
