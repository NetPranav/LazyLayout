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

  // 6. Pause playback: seeking / stepping while paused applies immediately without needing a step
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();

  // ValueHud is hidden when paused without active gesturing/scrubbing (per Phase 70 HUD contract in auto-key-hud.spec.ts)
  await expect(hud).toBeHidden();

  // Step forward button while paused applies immediately to transport, playhead and stage
  await bar.getByRole("button", { name: "Step forward (Right)" }).click();

  const steppedPlayheadFrame = Number(await playheadEl.getAttribute("data-frame"));
  expect(steppedPlayheadFrame, "Playhead stepped immediately while paused").toBe(11);

  const stagePageFrame = Number(await page.locator('[data-testid="stage-page"]').getAttribute("data-frame"));
  expect(stagePageFrame, "Stage page data-frame stepped immediately while paused").toBe(11);

  // Check the overlay frame in the store via window.__LL_TEST__ (Rule #2: updated immediately with playhead while paused)
  const motionState = await page.evaluate(() => {
    const m = (window as unknown as { __LL_MOTION__?: () => { playhead: number; overlayFrame: number; overlayTime: number } }).__LL_MOTION__;
    return m ? m() : null;
  });
  expect(motionState).not.toBeNull();
  expect(motionState?.playhead, "Motion store playhead stepped immediately to frame 11").toBe(11);
  expect(motionState?.overlayFrame, "Overlay frame in store stepped immediately to frame 11 (Rule #2)").toBe(11);
});

test("Design draws the design itself; Motion draws the animated frame at the playhead", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const opacity = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="stage-page"] [data-archetype][data-element-id="headline"]')!).opacity);
  await expect.poll(opacity, "the editor opens with the headline at rest").toBe("1");
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.getByRole("button", { name: "Go to start (Home)" }).click();
  await expect.poll(opacity, "in Motion, frame 0 is the first frame of the headline's fade-in").toBe("0");
  await page.getByRole("tab", { name: "Design" }).click();
  await expect.poll(opacity, "back in Design, the headline is visible to design, whatever the playhead").toBe("1");
});
