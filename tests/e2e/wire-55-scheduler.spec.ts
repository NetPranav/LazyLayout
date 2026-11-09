/**
 * ROADMAP Phase 55 — Frame scheduler.
 * Verifies that the frame scheduler coordinates playback, the single clock transport,
 * the Motion store, overlays (ValueHud, playhead), and the engine-drawn canvas page
 * in ordered phases (evaluate -> apply -> render -> overlay).
 */
import { test, expect } from "@playwright/test";
import { openEditor, openSequencer, EDITOR_URL } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

test("Phase 55: frame scheduler deterministic stepping synchronizes transport, Motion store, ValueHud and canvas page in lockstep", async ({ page }) => {
  // Inject __LL_TEST__ before page load to activate test seams
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });

  await openEditor(page, EDITOR_URL);
  await openSequencer(page);

  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await expect(bar).toBeVisible();

  // 1. Reset transport to frame 0
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  const timecode = bar.getByRole("button", { name: "Playhead time" });
  await expect(timecode).toContainText("00:00.00");

  // 2. Select the animated headline element
  const headlineEl = page.locator('[data-testid="stage-element"][data-element-id="headline"]');
  await expect(headlineEl).toBeVisible();
  await headlineEl.click();

  // 3. Put frameScheduler into deterministic mode via window.__LL_SCHEDULER__
  const schedulerAvailable = await page.evaluate(() => {
    const s = (window as unknown as { __LL_SCHEDULER__?: { setDeterministic: (on: boolean) => void } }).__LL_SCHEDULER__;
    if (s) {
      s.setDeterministic(true);
      return true;
    }
    return false;
  });
  expect(schedulerAvailable, "window.__LL_SCHEDULER__ test seam is active").toBe(true);

  // 4. Start playback
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();

  const fps = 60;
  const playheadEl = page.locator('[data-testid="timeline-playhead"]');
  const hud = page.locator('[data-testid="stage-value-hud"]');
  const drawnHeadline = page.locator('[data-testid="stage-page"] [data-archetype][data-element-id="headline"]');

  await expect(playheadEl).toBeVisible();
  await expect(hud).toBeVisible();
  await expect(drawnHeadline).toBeVisible();

  // 5. Step 10 frames one by one; after each step assert lockstep agreement across all components
  for (let frame = 1; frame <= 10; frame++) {
    await page.evaluate((dt) => {
      const s = (window as unknown as { __LL_SCHEDULER__: { step: (dt: number) => void } }).__LL_SCHEDULER__;
      s.step(dt);
    }, 1 / fps);

    // a. Transport frame
    const transportState = await page.evaluate(() => {
      const t = (window as unknown as { __LL_TRANSPORT__?: () => { time: number; fps: number; playing: boolean } }).__LL_TRANSPORT__;
      return t ? t() : null;
    });
    expect(transportState).not.toBeNull();
    const transportFrame = Math.round((transportState?.time ?? 0) * fps);
    expect(transportFrame, `Transport frame matches step ${frame}`).toBe(frame);

    // b. Motion playhead on timeline ruler
    const playheadFrameStr = (await playheadEl.getAttribute("data-frame")) ?? (await playheadEl.getAttribute("data-time"));
    expect(Number(playheadFrameStr), `Timeline playhead frame matches step ${frame}`).toBe(frame);

    // c. Value HUD overlay frame
    const hudFrameStr = await hud.getAttribute("data-frame");
    expect(Number(hudFrameStr), `Value HUD overlay frame matches step ${frame}`).toBe(frame);

    // d. Drawn layer opacity in stage page matches evaluated entrance animation
    // Headline keyframes in prototypeDocument: opacity 0 at t=0, opacity 1 at t=0.6s (frame 36)
    const drawnOpacityStr = await drawnHeadline.evaluate((el) => window.getComputedStyle(el).opacity);
    const drawnOpacity = parseFloat(drawnOpacityStr);
    const expectedOpacity = frame / 36;
    expect(drawnOpacity, `Drawn headline opacity at frame ${frame}`).toBeCloseTo(expectedOpacity, 1);
  }

  // 6. Pause playback: seeking while paused applies immediately without needing a step
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();

  // Step forward button while paused applies immediately
  await bar.getByRole("button", { name: "Step forward (Right)" }).click();
  const steppedPlayheadFrame = Number(await playheadEl.getAttribute("data-frame"));
  expect(steppedPlayheadFrame, "Playhead stepped immediately while paused").toBe(11);

  const steppedHudFrame = Number(await hud.getAttribute("data-frame"));
  expect(steppedHudFrame, "HUD updated immediately while paused").toBe(11);
});
