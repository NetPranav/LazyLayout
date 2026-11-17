import { expect, test } from "@playwright/test";

test.describe("Stage 4 End-to-End Interactive Runtime (Phases 132–202)", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/editor/interactive-lab");
    await expect(page.getByTestId("s4-lab-root")).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__LL_STAGE4_LAB__));
    expect(errors).toEqual([]);
  });

  test("1. Live pointer signals, magnet/follow springs, variable font proximity, and 0px layout drift", async ({
    page,
  }) => {
    const stage = page.getByTestId("s4-pointer-stage");
    const neighbor = page.getByTestId("s4-neighbor-box");
    const neighborBefore = await neighbor.boundingBox();
    expect(neighborBefore).not.toBeNull();

    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();

    const startX = stageBox!.x + 120;
    const startY = stageBox!.y + 90;
    await page.mouse.move(startX, startY);
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(startX + i * 32, startY + (i % 2 === 0 ? 18 : -10));
    }

    const readoutText = await page.getByTestId("s4-pointer-readout").innerText();
    expect(readoutText).toContain("frames=7");

    const snap = await page.evaluate(() => window.__LL_STAGE4_LAB__!.getSnapshot());
    expect(snap.busFrameCount).toBeGreaterThanOrEqual(7);
    expect(snap.magnetX).not.toBe(0);
    expect(snap.followX).not.toBe(0);
    expect(snap.vfontMaxWeight).toBeGreaterThan(snap.vfontMinWeight);

    const neighborAfter = await neighbor.boundingBox();
    expect(neighborAfter).not.toBeNull();
    expect(Math.abs(neighborAfter!.x - neighborBefore!.x)).toBeLessThan(0.01);
    expect(Math.abs(neighborAfter!.y - neighborBefore!.y)).toBeLessThan(0.01);
    expect(Math.abs(neighborAfter!.width - neighborBefore!.width)).toBeLessThan(0.01);
  });

  test("2. Keyboard carousel roving focus & arrow/Home/End navigation parity", async ({ page }) => {
    const carousel = page.getByTestId("s4-carousel");
    await carousel.focus();
    await expect(page.getByTestId("s4-carousel-active")).toContainText("slide=0 roving=slide-0");

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("s4-carousel-active")).toContainText("slide=2 roving=slide-2");

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("s4-carousel-active")).toContainText("slide=1 roving=slide-1");

    await page.keyboard.press("End");
    await expect(page.getByTestId("s4-carousel-active")).toContainText("slide=4 roving=slide-4");

    await page.keyboard.press("Home");
    await expect(page.getByTestId("s4-carousel-active")).toContainText("slide=0 roving=slide-0");
  });

  test("3. Split-text DOM/screen-reader preservation + Web Audio user-gesture unlock gate + native cursor input", async ({
    page,
  }) => {
    const splitParent = page.getByTestId("s4-split-parent");
    await expect(splitParent).toHaveAttribute("aria-label", "HELLO");
    const letters = page.getByTestId("s4-split-letter");
    await expect(letters).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      await expect(letters.nth(i)).toHaveAttribute("aria-hidden", "true");
    }

    await page.getByTestId("s4-audio-pretest").click();
    await expect(page.getByTestId("s4-audio-status")).toContainText("locked | blockedBeforeGesture=true");

    await page.getByTestId("s4-sfx-trigger").click();
    await expect(page.getByTestId("s4-audio-status")).toContainText("unlocked");
    await expect(page.getByTestId("s4-audio-events")).toContainText("events=1");

    const textInput = page.getByTestId("s4-text-input");
    const cursorStyle = await textInput.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursorStyle).not.toBe("none");
  });

  test("4. Real browser <canvas> pixel rendering for Liquid Glass, Outline SDF, 2D Lights & Sticker Peel", async ({
    page,
  }) => {
    const pixelStats = await page.evaluate(() => {
      const readNonZeroAlpha = (testId: string) => {
        const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLCanvasElement | null;
        if (!el) return 0;
        const ctx = el.getContext("2d");
        if (!ctx) return 0;
        const data = ctx.getImageData(0, 0, el.width, el.height).data;
        let count = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i]! > 0) count += 1;
        }
        return count;
      };
      return {
        glassAlpha: readNonZeroAlpha("s4-liquid-glass-canvas"),
        lightsAlpha: readNonZeroAlpha("s4-lights2d-canvas"),
        deformAlpha: readNonZeroAlpha("s4-deform-canvas"),
      };
    });

    expect(pixelStats.glassAlpha).toBeGreaterThan(500);
    expect(pixelStats.lightsAlpha).toBeGreaterThan(1000);
    expect(pixelStats.deformAlpha).toBeGreaterThan(100);

    const lightsCanvas = page.getByTestId("s4-lights2d-canvas");
    const box = await lightsCanvas.boundingBox();
    await page.mouse.move(box!.x + 130, box!.y + 25);

    const gpuMetrics = await page.getByTestId("s4-gpu-metrics").innerText();
    expect(gpuMetrics).toContain("glassCovered=");
    expect(gpuMetrics).toContain("outlineLit=");
    expect(gpuMetrics).toContain("lightsLit=");
    expect(gpuMetrics).toContain("deformVertices=77");
  });

  test("5. 5-plane depth parallax + scroll-scrubbed media + real opaque-origin <iframe sandbox>", async ({
    page,
  }) => {
    const planes = page.getByTestId("s4-parallax-plane");
    await expect(planes).toHaveCount(5);

    const initialTransforms = await planes.evaluateAll((els) =>
      els.map((el) => window.getComputedStyle(el).transform),
    );

    await page.getByTestId("s4-scroll-input").fill("800");
    await page.getByTestId("s4-scroll-input").dispatchEvent("change");
    await expect(page.getByTestId("s4-scrub-frame")).toContainText("scroll=800px");

    const scrolledTransforms = await planes.evaluateAll((els) =>
      els.map((el) => window.getComputedStyle(el).transform),
    );
    expect(scrolledTransforms).not.toEqual(initialTransforms);
    expect(new Set(scrolledTransforms).size).toBeGreaterThanOrEqual(4);

    await expect(page.getByTestId("s4-sandbox-status")).not.toHaveText("waiting-for-sandbox-probe");
    const snap = await page.evaluate(() => window.__LL_STAGE4_LAB__!.getSnapshot());
    expect(snap.sandboxProbe).not.toBeNull();
    expect(snap.sandboxProbe!.origin).toBe("null");
    expect(snap.sandboxProbe!.localStorageError).toMatch(/SecurityError/i);
    expect(snap.sandboxProbe!.parentDocumentError).toMatch(/SecurityError/i);
    expect(snap.sandboxProbe!.cookieBlocked || snap.sandboxProbe!.cookieValue === "").toBe(true);
  });

  test("6. Physics, Ephemeral Spawner, Fracture & Shatter, Raw GLSL Safety, Shader Graph, Stateful Sim & Tier Budgets in Chromium", async ({
    page,
  }) => {
    const physics = await page.evaluate(() => window.__LL_STAGE4_LAB__!.runPhysicsAndFractureCheck());
    expect(physics.physicsSteps).toBe(30);
    expect(physics.ballMovedY).toBeGreaterThan(10);
    expect(physics.t0Cap).toBe(16);
    expect(physics.t2Cap).toBe(128);
    expect(physics.filteredLayerCount).toBe(1);
    expect(physics.voronoiExact).toBe(true);
    expect(physics.stripsExact).toBe(true);
    expect(physics.gridExact).toBe(true);
    expect(physics.tearExact).toBe(true);
    expect(physics.reassemblyErrorPx).toBeLessThan(1.0);

    const gpu = await page.evaluate(() => window.__LL_STAGE4_LAB__!.runGpuAndShaderCheck());
    expect(gpu.safeGlslOk).toBe(true);
    expect(gpu.safeUniformCount).toBe(2);
    expect(gpu.unsafeWhileRejected).toBe(true);
    expect(gpu.shaderGraphHasUniforms).toBe(true);
    expect(gpu.simResolutionT0).toBe("11x8");
    expect(gpu.simSeekHashParity).toBe(true);
    expect(gpu.libraryTotalEffects).toBeGreaterThanOrEqual(80);
    expect(gpu.libraryPassingAllTiers).toBe(gpu.libraryTotalEffects);
    // No browser soak has run yet, so none passed (the old 98/98 came from a loop that could not fail).
    expect(gpu.lowTierSoaksPassed).toBe(0);
  });

  test("7. Stage 4 Gate Journeys A–E, 15 Primitive Compositions, NodeScript, Export & Accessibility Audits in Chromium", async ({
    page,
  }) => {
    const journeys = await page.evaluate(() => window.__LL_STAGE4_LAB__!.runGateJourneys());
    expect(journeys.a.passedParity).toBe(true);
    expect(journeys.b.passed).toBe(true);
    expect(journeys.c.identicalInExport).toBe(true);
    expect(journeys.d.passedIsolation).toBe(true);
    expect(journeys.e.passedParity).toBe(true);

    const comp = await page.evaluate(() => window.__LL_STAGE4_LAB__!.runCompositionSuite());
    expect(comp.totalCompositions).toBe(15);
    expect(comp.profileRuns).toBe(60);
    expect(comp.law17Clean).toBe(true);
    expect(comp.allPassedParity).toBe(true);

    const nr = await page.evaluate(() => window.__LL_STAGE4_LAB__!.runNodeScriptAndRulesCheck());
    expect(nr.compiledNodes).toBe(2);
    expect(nr.nlsRoundTripMatches).toBe(true);
    expect(nr.distToEdge).toBe(10);
    expect(nr.importedControls).toBe(3);
    expect(nr.restrictedKeepPrivate).toBe(true);
    expect(nr.sandboxIsolationOk).toBe(true);
    expect(nr.exportZeroLazyImports).toBe(true);
    expect(nr.embedExpectedCls).toBe(0);
    expect(nr.a11yDiagnosticsDetected).toBeGreaterThanOrEqual(4);
  });
});
