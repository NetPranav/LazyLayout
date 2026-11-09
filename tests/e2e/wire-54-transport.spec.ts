/**
 * ROADMAP Phase 54 — Transport & one clock.
 * Verifies that the transport bar controls the single canonical clock
 * (transportStore mirrored into the motion model and timeline UI).
 */
import { test, expect } from "@playwright/test";
import { openEditor, openSequencer, EDITOR_URL } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

test("Phase 54: single clock transport controls, step frame, play/pause, loop cycling and K pause", async ({ page }) => {
  // Inject __LL_TEST__ before the page loads so test seams are activated
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });

  await openEditor(page, EDITOR_URL);
  await openSequencer(page);

  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await expect(bar).toBeVisible();
  const timecode = bar.getByRole("button", { name: "Playhead time" });

  // 1. Reset to start (frame 0)
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  await expect(timecode).toContainText("00:00.00");

  const initialTransport = await page.evaluate(() => {
    const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number; fps: number; playing: boolean } }).__LL_TRANSPORT__;
    return t ? t() : null;
  });
  expect(initialTransport).not.toBeNull();
  expect(initialTransport?.time).toBe(0);

  const fps = initialTransport?.fps ?? 60;

  // 2. Step forward button moves transport time by exactly one frame
  await bar.getByRole("button", { name: "Step forward (Right)" }).click();
  const oneFrameSec = 1 / fps;

  const steppedTransport = await page.evaluate(() => {
    const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number } }).__LL_TRANSPORT__;
    return t ? t() : null;
  });
  expect(steppedTransport?.time).toBeCloseTo(oneFrameSec, 4);
  await expect(timecode).toContainText("00:00.01");

  // 3. Play then pause leaves playhead where it stopped; timeline ruler playhead and transport agree
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();

  // Wait until playback advances past 0.05s
  await expect.poll(async () => {
    const state = await page.evaluate(() => {
      const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number } }).__LL_TRANSPORT__;
      return t ? t().time : 0;
    });
    return state;
  }, { timeout: 3000 }).toBeGreaterThan(0.05);

  // Pause playback
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();

  const pausedTime = await page.evaluate(() => {
    const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number; playing: boolean } }).__LL_TRANSPORT__;
    return t ? t() : null;
  });
  expect(pausedTime?.playing).toBe(false);

  // Confirm playhead remains stopped
  await page.waitForTimeout(100);
  const stoppedTime = await page.evaluate(() => {
    const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number } }).__LL_TRANSPORT__;
    return t ? t().time : null;
  });
  expect(stoppedTime).toBe(pausedTime?.time);

  // Ruler playhead element matches the transport frame
  const expectedFrame = Math.round((pausedTime?.time ?? 0) * fps);
  const playheadEl = page.locator('[data-testid="timeline-playhead"]');
  await expect(playheadEl).toBeVisible();
  const rulerFrameStr = await playheadEl.getAttribute("data-time");
  expect(Number(rulerFrameStr)).toBe(expectedFrame);

  // 4. Loop button cycles three modes
  // Reset to start first
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  await expect(timecode).toContainText("00:00.00");

  const loopOffBtn = bar.getByRole("button", { name: "Loop: Off" });
  await expect(loopOffBtn).toBeVisible();
  await loopOffBtn.click();

  const loopLoopBtn = bar.getByRole("button", { name: "Loop: Loop" });
  await expect(loopLoopBtn).toBeVisible();
  await loopLoopBtn.click();

  const loopPingPongBtn = bar.getByRole("button", { name: "Loop: Ping-pong" });
  await expect(loopPingPongBtn).toBeVisible();
  await loopPingPongBtn.click();

  await expect(bar.getByRole("button", { name: "Loop: Off" })).toBeVisible();

  // 5. K pauses playback
  // Hover over timeline to ensure timeline focus scope is active
  await page.locator('[aria-label="Motion Timeline"]').first().hover();

  // Start playing
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __LL_TRANSPORT__?: () => { playing: boolean } }).__LL_TRANSPORT__?.().playing)).toBe(true);

  // Press K to pause
  await page.keyboard.press("k");
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __LL_TRANSPORT__?: () => { playing: boolean } }).__LL_TRANSPORT__?.().playing)).toBe(false);
});
