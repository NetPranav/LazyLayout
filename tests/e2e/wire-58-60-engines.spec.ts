/**
 * Phases 58 to 60 on the new canvas (/editor), through the engine Phase 57 put there:
 * - 58: routed animations run as Web Animations while playing, and not while scrubbing; pausing stops them.
 * - 59: scrubbing is the kernel's and playing is each layer's adapter, and the hand-over changes nothing: paused after
 *   playing, every reference shows the kernel's value at that time.
 * - 60: the parity monitor stays green on correct playback, raises [PARITY_DRIFT] on an injected wrong easing, and the
 *   badge in the timeline footer says so.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

const TIMES = [0, 0.2, 0.5, 0.8, 1];
const REFS: Array<[property: string, from: number, to: number, ease: string]> = [
  ["transform.x", 0, 240, "linear"],
  ["transform.y", -50, 50, "power2.inOut"],
  ["transform.x", 300, 0, "power4.in"],
  ["transform.y", 0, 120, "power2.in"],
  ["frame.width", 40, 160, "power1.out"],
  ["frame.height", 120, 30, "linear"],
  ["frame.x", 10, 300, "power3.out"],
  ["frame.y", 10, 150, "linear"],
  ["appearance.radius", 0, 40, "power2.out"],
  ["appearance.opacity", 1, 0.2, "power1.inOut"],
];

type Parity = { status: string; samples: number; checked: number; drifts: Array<{ layerId: string; property: string }> };
type Engine = {
  kernel: (id: string, t: number) => Record<string, unknown>;
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
  loop: (on: boolean) => void;
  parity: () => Parity;
};
type Win = {
  __LL_TEST__: boolean;
  __LL_ENGINE__?: Engine;
  __LL_DOC__: { commands: { addLayer: (l: unknown) => string; addClip: (layerId: string, clip: unknown, label?: string, placement?: { compositionId: string; offset?: number }) => string } };
};

async function build(page: Page): Promise<string[]> {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const ids = await page.evaluate((refs) => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    let n = 0;
    const id = (p: string) => `${p}_w58_${n++}`;
    return refs.map(([property, from, to, ease], i) => {
      const layerId = c.addLayer({
        archetype: "rectangle",
        parentId: "hero",
        name: `Reference ${i}`,
        properties: { positioning: "absolute", "frame.x": 20 + (i % 5) * 150, "frame.y": 20 + Math.floor(i / 5) * 200, "frame.width": 80, "frame.height": 60, "svg.fill": "#3366ff" },
      });
      c.addClip(
        layerId,
        { id: id("clip"), name: `Reference ${i}`, type: "entrance", trigger: "mount", duration: 1, easing: "linear", enabled: true, tracks: [{ id: id("trk"), property, keyframes: [{ id: id("kf"), time: 0, value: from }, { id: id("kf"), time: 1, value: to, ease }] }] },
        "Reference animation",
        { compositionId: "comp_main" },
      );
      return layerId;
    });
  }, REFS);
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);
  return ids;
}

const engine = <T,>(page: Page, fn: (e: Engine, arg: unknown) => T, arg?: unknown) => page.evaluate(({ src, arg }) => new Function("e", "arg", `return (${src})(e, arg)`)((window as unknown as Win).__LL_ENGINE__, arg) as T, { src: fn.toString(), arg });
/** The Web Animations the engine runs for our reference layers. */
const running = (page: Page, ids: string[]) =>
  page.evaluate((ids) => document.getAnimations().filter((a) => ids.some((id) => a.id === `ll:${id}`)).map((a) => a.playState), ids);

/** What the canvas shows for one property of one layer, in the property's own unit. */
const shown = (page: Page, id: string, property: string) =>
  page.evaluate(
    ({ id, property }) => {
      const el = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`)!;
      const style = getComputedStyle(el);
      const m = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      switch (property) {
        case "transform.x": return m.m41;
        case "transform.y": return m.m42;
        case "frame.width": return parseFloat(style.width);
        case "frame.height": return parseFloat(style.height);
        case "frame.x": return parseFloat(style.left);
        case "frame.y": return parseFloat(style.top);
        case "appearance.radius": return parseFloat(style.borderTopLeftRadius) || parseFloat(el.querySelector("rect")?.getAttribute("rx") ?? "0");
        default: return Number(style.opacity);
      }
    },
    { id, property },
  );

test("Phase 58: the reference animations run as Web Animations while playing, not while scrubbing, and pausing stops them", async ({ page }) => {
  const ids = await build(page);
  await engine(page, (e) => e.seek(0.5));
  await page.waitForTimeout(300);
  expect(await running(page, ids), "scrubbing: the kernel draws, no Web Animations").toHaveLength(0);
  await engine(page, (e) => {
    e.loop(true);
    e.play();
  });
  await expect.poll(async () => (await running(page, ids)).filter((s) => s === "running").length, "playing: each reference is a running Web Animation").toBe(ids.length);
  await engine(page, (e) => e.pause());
  await expect.poll(async () => (await running(page, ids)).filter((s) => s === "running").length, "paused: none runs").toBe(0);
});

test("Phase 59: paused after playing, every reference shows the kernel's value at that time", async ({ page }) => {
  const ids = await build(page);
  for (const time of TIMES) {
    await engine(page, (e) => e.play());
    await page.waitForTimeout(120);
    await engine(page, (e, t) => {
      e.pause();
      e.seek(t as number);
    }, time);
    for (const [i, [property]] of REFS.entries()) {
      const expected = (await engine(page, (e, a) => e.kernel((a as [string, number])[0], (a as [string, number])[1]), [ids[i], time]))[property] as number;
      await expect
        .poll(async () => Math.abs((await shown(page, ids[i], property)) - expected), { message: `${property} (${ids[i]}) at ${time}s should be ${expected}`, timeout: 5_000 })
        .toBeLessThanOrEqual(property === "appearance.opacity" ? 0.005 : 0.5);
    }
  }
});

test("Phase 60: correct playback stays green, and an injected wrong easing raises [PARITY_DRIFT] and turns the badge", async ({ page }) => {
  const ids = await build(page);
  const warnings: string[] = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  const badge = page.getByRole("status", { name: "Engine parity" });
  await expect(badge).toBeVisible();
  await engine(page, (e) => {
    e.loop(true);
    e.play();
  });
  await expect.poll(async () => (await engine(page, (e) => e.parity())).samples, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
  const green = await engine(page, (e) => e.parity());
  expect(green.status, JSON.stringify(green.drifts)).toBe("ok");
  await expect(badge).toHaveAttribute("data-parity", "ok");
  expect(warnings.filter((w) => w.includes("PARITY_DRIFT"))).toHaveLength(0);

  // change one running animation's easing under the engine: it now draws a different curve from the kernel's
  await page.evaluate((id) => {
    const target = document.getAnimations().find((a) => a.id === `ll:${id}`)!;
    (target.effect as KeyframeEffect).updateTiming({ easing: "steps(3, end)" });
  }, ids[0]);
  await expect.poll(async () => (await engine(page, (e) => e.parity())).status, { timeout: 30_000 }).toBe("drift");
  await expect(badge).toHaveAttribute("data-parity", "drift");
  await expect(badge).toContainText("Parity drift");
  await expect.poll(() => warnings.some((w) => w.includes("[PARITY_DRIFT]") && w.includes(ids[0]))).toBe(true);
});
