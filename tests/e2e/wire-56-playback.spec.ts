/**
 * ROADMAP Phase 56 — Playback optimization.
 * Verifies that:
 * 1. During real-time playback the timeline panel makes <= 10 React commits per second,
 *    and the Artboard makes <= 10 React commits per second (measured via React <Profiler>
 *    and exposed at window.__LL_COMMITS__).
 * 2. Canvas and timeline agree within 1 frame when stepping via the deterministic scheduler.
 * 3. Pausing clears direct DOM overrides so the drawn headline has no stale inline styles
 *    and matches React's evaluated render for that frame.
 * 4. The Design-at-rest rule (headline visible at opacity 1 in Design mode) continues to hold.
 */
import { test, expect } from "@playwright/test";
import { openEditor, openSequencer, EDITOR_URL } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

test("Phase 56: playback throttles React commits to <= 10/s, keeps canvas and timeline in lockstep, and leaves no stale inline styles on pause", async ({ page }) => {
  // 1. Enable test seams before page load
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });

  await openEditor(page, EDITOR_URL);
  await openSequencer(page);

  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await expect(bar).toBeVisible();

  // Reset to start
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  const timecode = bar.getByRole("button", { name: "Playhead time" });
  await expect(timecode).toContainText("00:00.00");

  // 2. Measure React commits during ~1s of real-time playback
  const commitCountersAvailable = await page.evaluate(() => {
    const c = (window as unknown as { __LL_COMMITS__?: { timeline: number; artboard: number; reset: () => void } }).__LL_COMMITS__;
    if (c) {
      c.reset();
      return true;
    }
    return false;
  });
  expect(commitCountersAvailable, "window.__LL_COMMITS__ test seam is active").toBe(true);

  // Start real-time playback
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();

  // Play for ~1 second of wall time
  await page.waitForTimeout(1050);

  // Read commit counts while still playing or right at pause
  const commits = await page.evaluate(() => {
    const c = (window as unknown as { __LL_COMMITS__?: { timeline: number; artboard: number } }).__LL_COMMITS__;
    return c ? { timeline: c.timeline, artboard: c.artboard } : null;
  });

  // Pause playback
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();

  expect(commits).not.toBeNull();
  expect(commits?.timeline, `Timeline commits during ~1s playback: ${commits?.timeline}`).toBeLessThanOrEqual(10);
  expect(commits?.artboard, `Artboard commits during ~1s playback: ${commits?.artboard}`).toBeLessThanOrEqual(10);

  // 3. Deterministic stepping test: canvas, transport and timeline needle agree within 1 frame
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  await expect(timecode).toContainText("00:00.00");

  const headlineEl = page.locator('[data-testid="stage-element"][data-element-id="headline"]');
  await expect(headlineEl).toBeVisible();
  await headlineEl.click();

  // Activate deterministic mode
  await page.evaluate(() => {
    const s = (window as unknown as { __LL_SCHEDULER__: { setDeterministic: (on: boolean) => void } }).__LL_SCHEDULER__;
    s.setDeterministic(true);
  });

  // Start playing under deterministic scheduler
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();

  const fps = 60;
  const playheadEl = page.locator('[data-testid="timeline-playhead"]');
  const drawnHeadline = page.locator('[data-testid="stage-page"] [data-archetype][data-element-id="headline"]');

  await expect(playheadEl).toBeVisible();
  await expect(drawnHeadline).toBeVisible();

  // Step 10 frames and verify needle, transport and drawn opacity agreement within 1 frame
  for (let frame = 1; frame <= 10; frame++) {
    await page.evaluate((dt) => {
      const s = (window as unknown as { __LL_SCHEDULER__: { step: (dt: number) => void } }).__LL_SCHEDULER__;
      s.step(dt);
    }, 1 / fps);

    // Transport frame
    const transportState = await page.evaluate(() => {
      const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number; fps: number; playing: boolean } }).__LL_TRANSPORT__;
      return t ? t() : null;
    });
    expect(transportState).not.toBeNull();
    const transportFrame = Math.round((transportState?.time ?? 0) * fps);
    expect(transportFrame, `Transport frame matches step ${frame}`).toBe(frame);

    // Timeline needle frame
    const playheadFrameStr = (await playheadEl.getAttribute("data-frame")) ?? (await playheadEl.getAttribute("data-time"));
    const needleFrame = Number(playheadFrameStr);
    expect(Math.abs(needleFrame - transportFrame), `Needle frame (${needleFrame}) and transport frame (${transportFrame}) agree within 1 frame`).toBeLessThanOrEqual(1);

    // Drawn headline opacity: prototype entrance animates opacity from 0 to 1 over 36 frames (0.6s)
    const drawnOpacityStr = await drawnHeadline.evaluate((el) => window.getComputedStyle(el).opacity);
    const drawnOpacity = parseFloat(drawnOpacityStr);
    const headlineEvaluatedFrame = Math.round(drawnOpacity * 36);
    expect(Math.abs(headlineEvaluatedFrame - transportFrame), `Headline frame (${headlineEvaluatedFrame}) and transport frame (${transportFrame}) agree within 1 frame`).toBeLessThanOrEqual(1);
  }

  // 4. Pause playback and check no stale inline style overrides remain
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();

  // Directly check inline style attributes: must be empty string
  const inlineOpacity = await drawnHeadline.evaluate((el) => (el as HTMLElement).style.opacity);
  expect(inlineOpacity, "Drawn headline must have no stale inline style opacity override").toBe("");

  const inlineTransform = await drawnHeadline.evaluate((el) => (el as HTMLElement).style.transform);
  expect(inlineTransform, "Drawn headline must have no stale inline style transform override").toBe("");

  // Computed opacity should match evaluated frame 10 (10 / 36 ~ 0.28)
  const computedOpacity = await drawnHeadline.evaluate((el) => window.getComputedStyle(el).opacity);
  expect(parseFloat(computedOpacity)).toBeCloseTo(10 / 36, 1);

  // 5. Verify Design-at-rest rule: in Design tab, headline is fully visible (opacity 1)
  await page.getByRole("tab", { name: "Design" }).click();
  const designOpacity = await drawnHeadline.evaluate((el) => window.getComputedStyle(el).opacity);
  expect(designOpacity, "In Design mode, headline is visible at rest (opacity 1)").toBe("1");
});
