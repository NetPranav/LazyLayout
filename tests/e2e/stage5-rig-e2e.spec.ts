import { expect, test } from "@playwright/test";

test.describe("Stage 5 Characters & Rigging E2E (Phases 203–217)", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/editor/rig-lab");
    await expect(page.getByTestId("s5-lab-root")).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__LL_STAGE5_LAB__));
    expect(errors).toEqual([]);
  });

  test("1. Auto-rig, cursor head follow, jiggle secondary motion, and normalized mesh weights", async ({
    page,
  }) => {
    await expect(page.getByTestId("s5-mesh-readout")).toContainText("weightsSumValid=true");

    const stage = page.getByTestId("s5-rig-stage");
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();

    const before = await page.evaluate(() => window.__LL_STAGE5_LAB__!.getSnapshot());
    await page.mouse.move(box!.x + 340, box!.y + 60);
    const rightSnap = await page.evaluate(() => window.__LL_STAGE5_LAB__!.getSnapshot());
    await page.mouse.move(box!.x + 60, box!.y + 60);
    const leftSnap = await page.evaluate(() => window.__LL_STAGE5_LAB__!.getSnapshot());

    expect(leftSnap.boneCount).toBeGreaterThanOrEqual(6);
    expect(rightSnap.headAngleDeg).not.toBe(before.headAngleDeg);
    expect(leftSnap.headAngleDeg).not.toBe(rightSnap.headAngleDeg);
    expect(Math.abs(leftSnap.jiggleAngleDeg)).toBeGreaterThan(0);
    expect(leftSnap.deformedVertexCount).toBe(16);
  });

  test("2. 2-Bone IK target solving, pose sliders, and puppet pin flag deformation", async ({
    page,
  }) => {
    await page.getByTestId("s5-ik-target-x").fill("230");
    await page.getByTestId("s5-ik-target-y").fill("110");
    await expect(page.getByTestId("s5-ik-readout")).toContainText("ikTarget=(230,110)");

    await page.getByTestId("s5-slider-happy").fill("80");
    await page.getByTestId("s5-slider-wave").fill("50");

    const puppetBefore = await page.evaluate(() => window.__LL_STAGE5_LAB__!.getSnapshot().puppetTipY);
    await page.getByTestId("s5-puppet-slider").fill("-30");
    const puppetAfter = await page.evaluate(() => window.__LL_STAGE5_LAB__!.getSnapshot().puppetTipY);
    expect(puppetAfter).not.toBe(puppetBefore);
  });

  test("3. Keyboard 5-state locomotion (walk, run, wave overlay) + voice lip-sync & blink", async ({
    page,
  }) => {
    const pad = page.getByTestId("s5-locomotion-pad");
    await pad.focus();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("s5-state-readout")).toContainText("state=walk");

    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.getByTestId("s5-state-readout")).toContainText("state=run");

    await page.keyboard.press("KeyW");
    const waveSnap = await page.evaluate(() => window.__LL_STAGE5_LAB__!.getSnapshot());
    expect(waveSnap.waveLayerWeight).toBeGreaterThan(0.5);

    const visemeBefore = await page.getByTestId("s5-viseme-readout").innerText();
    await page.getByTestId("s5-voice-scrub").fill("85");
    await expect(page.getByTestId("s5-viseme-readout")).not.toHaveText(visemeBefore);

    await page.getByTestId("s5-blink-btn").click();
    await expect(page.getByTestId("s5-viseme-readout")).toContainText("blink=1.00");
  });

  test("4. Webcam tracking + camera-denied cursor fallback, library recipe switch & Stage 5 Gate", async ({
    page,
  }) => {
    await expect(page.getByTestId("s5-tracking-readout")).toContainText("source=cursor-fallback");
    await expect(page.getByTestId("s5-tracking-readout")).toContainText("videoLeavesDevice=false");

    await page.getByTestId("s5-camera-toggle").click();
    await expect(page.getByTestId("s5-tracking-readout")).toContainText("source=webcam");

    await page.getByTestId("s5-recipe-select").selectOption("rig-eyes-expressive");

    const gateReport = await page.evaluate(() => window.__LL_STAGE5_LAB__!.runCharacterGate());
    expect(gateReport.passed).toBe(true);
    expect(gateReport.maxExportParityDiffPx).toBeLessThan(0.01);
    expect(gateReport.libraryRecipesPassed).toBe(8);

    const exportReport = await page.evaluate(() => window.__LL_STAGE5_LAB__!.verifyExports());
    expect(exportReport.nextjsPassed).toBe(true);
    expect(exportReport.vitePassed).toBe(true);
    expect(exportReport.htmlPassed).toBe(true);
    expect(exportReport.lottieLayerCount).toBeGreaterThanOrEqual(6);
    expect(exportReport.recipesCount).toBe(8);
  });
});
