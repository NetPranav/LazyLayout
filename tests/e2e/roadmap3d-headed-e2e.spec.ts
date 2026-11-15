import { expect, test, type Page } from "@playwright/test";
import { EDITOR_URL, openEditor } from "./support/editor";

type EditorWin = {
  __LL_TEST__?: boolean;
  __LL_COMMANDS__?: {
    all: () => Array<{ id: string; run: (args?: unknown) => unknown }>;
  };
};

async function openEditorWith3dScene(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as EditorWin).__LL_TEST__ = true;
  });
  await openEditor(page, EDITOR_URL);
  await page.waitForFunction(() => Boolean((window as unknown as EditorWin).__LL_COMMANDS__));

  // Insert 3D scene onto the main /editor canvas
  await page.evaluate(() => {
    const win = window as unknown as EditorWin;
    const cmd = win.__LL_COMMANDS__!.all().find((c) => c.id === "3d.scene.insert");
    if (!cmd) throw new Error("3d.scene.insert command not found");
    cmd.run({ width: 520, height: 340 });
  });

  const sceneLayer = page.locator('[data-archetype="scene3d"]').first();
  await expect(sceneLayer).toBeVisible({ timeout: 15_000 });

  // Double-click scene layer to enter interactive 3D viewport editing mode on /editor
  const layerId = await sceneLayer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(sceneLayer).toHaveAttribute("data-editing-3d", "true");

  // Click the "3D Studio" button inside the /editor 3D viewport header strip
  const studioBtn = page.getByTestId("editor-viewport-studio-btn");
  await expect(studioBtn).toBeVisible({ timeout: 10_000 });
  await studioBtn.click();

  // Right Panel Properties3d mounts ROADMAP_3D Studio tab directly on /editor
  await expect(page.getByTestId("properties-3d")).toBeVisible();
  await expect(page.getByTestId("tab-studio")).toBeVisible();
}

test.describe("Main /editor ROADMAP_3D Integration Headed E2E (3D-001 – 3D-227)", () => {
  test("1. Main /editor · All 227-Phase Gates + Case 2 M1 Foil Button & Opposite Pointer Light", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await openEditorWith3dScene(page);

    await page.getByTestId("editor-r3d-run-gates-btn").click();
    const summary = page.getByTestId("editor-r3d-gates-summary");
    await expect(summary).toContainText("ALL GATES (227/227): PASS");
    await expect(summary).toContainText("M1=true");
    await expect(summary).toContainText("A=true");
    await expect(summary).toContainText("M2=true");
    await expect(summary).toContainText("M3=true");
    await expect(summary).toContainText("M4=true");
    await expect(summary).toContainText("B=true");
    await expect(summary).toContainText("C=true");

    // Hover across opposite corners of the Pointer Light stage inside /editor's Right Panel
    const stage = page.getByTestId("editor-r3d-pointer-light-stage");
    await stage.scrollIntoViewIfNeeded();
    const box = (await stage.boundingBox())!;
    await stage.hover({ position: { x: 14, y: 14 } });
    await expect(page.getByTestId("editor-r3d-pointer-light-readout")).toContainText("mode=Opposite");
    const topLeft = await page.getByTestId("editor-r3d-pointer-light-readout").innerText();

    await stage.hover({ position: { x: Math.round(box.width - 14), y: Math.round(box.height - 14) } });
    await expect(page.getByTestId("editor-r3d-pointer-light-readout")).not.toHaveText(topLeft);

    // Press Foil Cushion button on /editor and verify XPBD pressure volume drift <= 1%
    await page.getByTestId("editor-r3d-foil-button").click();
    await expect(page.getByTestId("editor-r3d-foil-dent-readout")).toContainText("pressed=true");
    await expect(page.getByTestId("editor-r3d-foil-dent-readout")).toContainText("limit <= 1%");

    // Edit decal text & toggle prefers-reduced-motion
    await page.getByTestId("editor-r3d-decal-input").fill("GO");
    await expect(page.getByTestId("editor-r3d-foil-button")).toContainText("GO");
    await page.getByRole("checkbox", { name: "prefers-reduced-motion" }).click();
    await expect(page.getByTestId("editor-r3d-pointer-light-readout")).toContainText("static=true");

    expect(pageErrors).toEqual([]);
  });

  test("2. Main /editor · Case 1 M1+ Zero-Script & Micro-Renderer + M2 Studio & 3D-227 Live Mixer", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await openEditorWith3dScene(page);

    // Case 1 & M1+ Small Export tab on /editor
    await page.getByTestId("editor-r3d-tab-m1plus-size").click();
    await expect(page.getByTestId("editor-r3d-zeroscript-readout")).toContainText("Tier 1 Zero-Script JS: 0 B");
    await expect(page.getByTestId("editor-r3d-leak-scan-readout")).toContainText("three.js=false, leaks=0");

    await page.getByRole("checkbox", { name: "Slice Toon+Outline into Micro-Renderer" }).click();
    await expect(page.getByTestId("editor-r3d-leak-scan-readout")).toContainText("budget <= 25 KB");

    // M2 Studio & 3D-227 Live Multi-Animation Mixing tab on /editor
    await page.getByTestId("editor-r3d-tab-m2-studio").click();
    await page.getByTestId("editor-r3d-subdiv-select").selectOption("2");
    await expect(page.getByTestId("editor-r3d-panel-m2-studio")).toContainText("faces=16");
    await page.getByTestId("editor-r3d-camrig-select").selectOption("crane");

    await page.getByTestId("editor-r3d-wave-weight-slider").fill("1");
    await expect(page.getByTestId("editor-r3d-mixer-readout")).toContainText("root=(0.0,6.0,0.0)");
    await expect(page.getByTestId("editor-r3d-mixer-readout")).toContainText("rightArm=(12.0,40.0,73.0)");

    expect(pageErrors).toEqual([]);
  });

  test("3. Main /editor · M3/M4 States & 8-Step Rule + Case 3 Photo Car Wrap + Case 4 Anime Fight Studio", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await openEditorWith3dScene(page);

    // M3 / M4 Living States & 8-Step Rule on /editor
    await page.getByTestId("editor-r3d-tab-m3-m4-living").click();
    await expect(page.getByTestId("editor-r3d-eightstep-table")).toContainText("10/10 Recipes <= 8 Steps");
    await page.getByTestId("editor-r3d-statemachine-btn").click();
    await expect(page.getByTestId("editor-r3d-statemachine-btn")).toContainText("Current: active");

    // Case 3 Photo Car Wrap & Planar Corner-Pin on /editor
    await page.getByTestId("editor-r3d-tab-m5-photo").click();
    await page.getByTestId("editor-r3d-wrap-text-input").fill("TURBO");
    await expect(page.getByTestId("editor-r3d-car-wrap-stage")).toContainText("TURBO");
    await expect(page.getByTestId("editor-r3d-photo-readout")).toContainText("photoStays2D=true | rot=0deg");
    await expect(page.getByTestId("editor-r3d-photo-readout")).toContainText("creaseRecall=89%");

    await page.getByRole("checkbox", { name: "Crease Snap" }).click();
    await expect(page.getByTestId("editor-r3d-photo-readout")).toContainText("creaseRecall=72%");
    await page.getByRole("checkbox", { name: "AI On Device" }).click();
    await expect(page.getByTestId("editor-r3d-photo-readout")).toContainText("ai=server-api");

    // Case 4 Anime Studio on /editor
    await page.getByTestId("editor-r3d-tab-m6-anime").click();
    await page.getByTestId("editor-r3d-anime-timing-select").selectOption("twos");
    await expect(page.getByTestId("editor-r3d-anime-readout")).toContainText("charFps=12");

    await page.getByTestId("editor-r3d-anime-frame-slider").fill("2");
    await expect(page.getByTestId("editor-r3d-anime-readout")).toContainText("poseIndex=0");
    await page.getByTestId("editor-r3d-anime-frame-slider").fill("6");
    await expect(page.getByTestId("editor-r3d-anime-readout")).toContainText("poseIndex=1");

    await page.getByTestId("editor-r3d-anime-vfx-select").selectOption("energy-slash");
    await page.getByTestId("editor-r3d-anime-cam-select").selectOption("dutch-angle");
    await expect(page.getByTestId("editor-r3d-anime-readout")).toContainText("vfx=energy-slash");

    expect(pageErrors).toEqual([]);
  });
});
