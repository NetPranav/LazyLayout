import { expect, test } from "@playwright/test";

test.describe("Stage 6 · 3D Engine & Viewport E2E (Phases 218–240)", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/editor/scene3d-lab");
    await expect(page.getByTestId("s6-lab-root")).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__LL_STAGE6_LAB__));
    expect(errors).toEqual([]);
  });

  test("1. Decision 0013 stack, multi-browser context recovery, 15-step gizmo & reparenting", async ({
    page,
  }) => {
    await expect(page.getByTestId("s6-stack-readout")).toContainText("valid=true");

    await page.getByTestId("s6-browser-profile-select").selectOption("webkit");
    await page.getByTestId("s6-context-recover-btn").click();
    await expect(page.getByTestId("s6-stack-readout")).toContainText("backend=webgl2");
    await expect(page.getByTestId("s6-stack-readout")).toContainText("recoveries=1");

    await page.getByTestId("s6-browser-profile-select").selectOption("chromium");
    await page.getByTestId("s6-context-recover-btn").click();
    await expect(page.getByTestId("s6-stack-readout")).toContainText("recoveries=2");

    await page.getByTestId("s6-gizmo-run-btn").click();
    await expect(page.getByTestId("s6-gizmo-readout")).toContainText("gizmoSteps=15");
    const beforeReparent = await page.evaluate(() => window.__LL_STAGE6_LAB__!.getSnapshot().childWorldX);

    await page.getByTestId("s6-reparent-btn").click();
    await expect(page.getByTestId("s6-gizmo-readout")).toContainText("parent=parent_rig");
    const afterReparent = await page.evaluate(() => window.__LL_STAGE6_LAB__!.getSnapshot().childWorldX);
    expect(Math.abs(afterReparent - beforeReparent)).toBeLessThan(1e-6);
  });

  test("2. Primitives, watertight 2D-to-3D inflate < 100 ms, GLTF import & malformed rejection, PBR & lights", async ({
    page,
  }) => {
    await page.getByTestId("s6-primitive-select").selectOption("torus");
    await page.getByTestId("s6-shape-mode-select").selectOption("lathe");
    await page.getByTestId("s6-bump-contour-btn").click();
    await expect(page.getByTestId("s6-mesh-readout")).toContainText("watertight=true");

    await page.getByTestId("s6-shape-mode-select").selectOption("inflate");
    const meshSnap = await page.evaluate(() => window.__LL_STAGE6_LAB__!.getSnapshot());
    expect(meshSnap.meshWatertight).toBe(true);
    expect(meshSnap.meshTriangleCount).toBeGreaterThan(8);
    expect(meshSnap.liveLinkMs).toBeLessThan(100);

    await page.getByTestId("s6-gltf-select").selectOption("sample_car");
    await page.getByTestId("s6-gltf-bad-btn").click();
    await expect(page.getByTestId("s6-gltf-pbr-readout")).toContainText("gltfOk=true badRejected=true");

    await page.getByTestId("s6-tier-select").selectOption("T0");
    await page.getByTestId("s6-tonemap-select").selectOption("AgX");
    await expect(page.getByTestId("s6-gltf-pbr-readout")).toContainText("shadow=512");
  });

  test("3. 3D viewport pointer/raycast/keyboard orbit, accessible CSS3D DOM button, timeline, IK & TSL parity", async ({
    page,
  }) => {
    const stage = page.getByTestId("s6-3d-stage");
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + 320, box!.y + 80);
    await stage.click({ position: { x: 40, y: 40 } });
    await expect(page.getByTestId("s6-dom3d-readout")).toContainText("evt=object3d.click:hero_cube");

    await stage.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("s6-dom3d-readout")).toContainText("yaw=12");

    // Accessible DOM-in-3D button inside accessibility tree with < 1 px alignment error
    const ctaBtn = page.getByRole("button", { name: /Inspect 3D Product/i });
    await expect(ctaBtn).toBeVisible();
    await ctaBtn.click();
    await expect(ctaBtn).toContainText("(1)");

    await page.getByTestId("s6-timeline-scrub").fill("80");
    await page.getByTestId("s6-ik-next-btn").click();
    await page.getByTestId("s6-shader-select").selectOption("3");

    const animSnap = await page.evaluate(() => window.__LL_STAGE6_LAB__!.getSnapshot());
    expect(animSnap.domErrorPx).toBeLessThan(1);
    expect(animSnap.onionCount).toBe(4);
    expect(animSnap.ikError).toBeLessThan(0.05);
    expect(animSnap.shaderDiff).toBeLessThan(0.01);
  });

  test("4. 10k cloner, 100-body physics, 20x GPU memory zero leak, R3F/Three.js export & Stage 6 Gate", async ({
    page,
  }) => {
    await page.getByTestId("s6-cloner-select").selectOption("radial");
    await expect(page.getByTestId("s6-physics-mem-readout")).toContainText("cloner=10000 budget=true");
    await expect(page.getByTestId("s6-physics-mem-readout")).toContainText("zeroLeak=true");

    const hashBefore = await page.evaluate(() => window.__LL_STAGE6_LAB__!.getSnapshot().physicsHash);
    await page.getByTestId("s6-physics-step-btn").click();
    await page.getByTestId("s6-memory-verify-btn").click();
    const hashAfter = await page.evaluate(() => window.__LL_STAGE6_LAB__!.getSnapshot().physicsHash);
    expect(hashAfter).not.toBe(hashBefore);

    await expect(page.getByTestId("s6-export-preview")).toContainText("next/dynamic");
    await page.getByTestId("s6-export-select").selectOption("threejs");
    await expect(page.getByTestId("s6-export-preview")).toContainText("WebGLRenderer");

    await page.getByTestId("s6-recipe-select").selectOption("product-turntable");
    await page.getByTestId("s6-run-gate-btn").click();
    await expect(page.getByTestId("s6-gate-readout")).toContainText("Stage 6 3D Gate: PASSED");

    const gate = await page.evaluate(() => window.__LL_STAGE6_LAB__!.runGate());
    expect(gate.passed).toBe(true);
    expect(gate.stackVerified).toBe(true);
    expect(gate.gizmoJourneySteps).toBe(15);
    expect(gate.watertightShapesPassed).toBe(10);
    expect(gate.gltfModelsImported).toBe(10);
    expect(gate.ikTargetsSolved).toBe(50);
    expect(gate.shaderGraphMaterialsMatched).toBe(5);
    expect(gate.cloner10kWithinBudget).toBe(true);
    expect(gate.pile100BodiesHashMatch).toBe(true);
    expect(gate.memoryZeroLeak).toBe(true);
    expect(gate.domIn3dProjectionErrorPx).toBeLessThan(1);
    expect(gate.r3fExportDiffPercent).toBeLessThan(2);
    expect(gate.threejsExportDiffPercent).toBeLessThan(2);
    expect(gate.libraryRecipesPassed).toBe(6);
  });
});
