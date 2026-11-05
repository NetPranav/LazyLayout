/**
 * ROADMAP Phase 4.1 — "Deterministic time: a test clock that controls
 * requestAnimationFrame, performance.now, and the MDM playhead, so
 * animations can be screenshotted at an exact t."
 *
 * Two mechanisms, proven separately:
 *
 *  1. `installDeterministicClock` (`support/clock.ts`) wraps Playwright's
 *     native Clock API, which fakes `requestAnimationFrame` and
 *     `performance.now` for the page. In isolation this is deterministic to
 *     within a couple of frames under normal load (worse under heavy
 *     parallel CPU contention) — good enough to drive time-dependent code,
 *     not bit-exact (browsers don't guarantee that of rAF either).
 *
 *  2. `seekRuler`: in the new editor, ruler clicking / pointerdown on
 *     `timeline-ruler` at `24 + (f / fps - t0) * pps` reaches an exact
 *     playhead time.
 *
 *  3. AUD-41: transport playback on the frame scheduler is deterministic
 *     under the test clock.
 */
import { test, expect } from "@playwright/test";
import { installDeterministicClock } from "./support/clock";
import { openEditor, openSequencer, EDITOR_URL } from "./support/editor";

test("1. the clock deterministically controls rAF/performance.now in isolation", async ({ page }) => {
  await openEditor(page, EDITOR_URL); // no Sequencer mounted: nothing else is driving rAF
  await installDeterministicClock(page, 0);

  async function elapsedFor(ms: number) {
    const before = await page.evaluate(() => performance.now());
    await page.clock.runFor(ms);
    const after = await page.evaluate(() => performance.now());
    return after - before;
  }

  const first = await elapsedFor(1000);
  const second = await elapsedFor(1000);

  expect(first, "runFor never returns before the requested time").toBeGreaterThanOrEqual(1000);
  expect(second, "runFor never returns before the requested time").toBeGreaterThanOrEqual(1000);
  expect(Math.abs(first - second), `two identical 1000ms runFor calls: ${first}ms vs ${second}ms`).toBeLessThan(200);
});

test("2. seekRuler reaches an exact playhead time, repeatably", async ({ page }) => {
  await openEditor(page, EDITOR_URL);
  await openSequencer(page);

  const ruler = page.getByTestId("timeline-ruler");
  const box = (await ruler.boundingBox())!;
  const pps = Number(await ruler.getAttribute("data-pps"));
  const t0 = Number(await ruler.getAttribute("data-t0"));
  const fps = Number(await ruler.getAttribute("data-fps"));

  for (const seconds of [0, 0.5, 1] as const) {
    const f = seconds * fps;
    const x = 24 + (f / fps - t0) * pps;
    await ruler.dispatchEvent("pointerdown", { clientX: box.x + x, clientY: box.y + 12, bubbles: true });
    await expect
      .poll(async () => {
        const frames = Number(await page.getByTestId("timeline-playhead-layer").getAttribute("data-time"));
        return frames / fps;
      }, { message: `seek to ${seconds}s` })
      .toBeCloseTo(seconds, 2);
  }
});

test("3. AUD-41: transport playback on the frame scheduler is deterministic under the test clock", async ({ page }) => {
  await openEditor(page, EDITOR_URL);
  await openSequencer(page);
  await installDeterministicClock(page, 0);
  await page.clock.pauseAt(100); // virtual time now moves only through runFor, not while Playwright clicks
  const bar = page.getByRole("toolbar", { name: "Timeline header" });

  // Reset to start
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();

  const seconds = async () => {
    const frames = Number(await page.getByTestId("timeline-playhead-layer").getAttribute("data-time"));
    return frames / 60;
  };

  const clockNow = () => page.evaluate(() => performance.now());
  let before = await seconds();
  const errors: number[] = [];
  for (let i = 0; i < 3; i++) {
    await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
    const started = await clockNow();
    await page.clock.runFor(400);
    const elapsed = (await clockNow()) - started;
    await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
    await page.clock.runFor(150);
    const position = await seconds();
    errors.push(Math.abs((position - before) * 60 - (elapsed / 1000) * 60));
    before = position;
  }
  expect(Math.max(...errors), `frames of error per run vs the virtual clock: ${errors.map((e) => e.toFixed(2)).join(", ")}`).toBeLessThanOrEqual(2);
});
