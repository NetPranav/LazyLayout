import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

test.describe("panels, arrow-key alignment guides, and small-window timeline toggle", () => {
  test("individual left and right panels can close and reopen independently", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openEditor(page);

    const leftPane = page.locator(".ll-shell-left");
    const rightPane = page.locator(".ll-shell-right");

    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // 1. Close ONLY left panel using header button -> right panel remains open
    await page.getByTestId("close-left-panel").click();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBe(0);
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // 2. Reopen ONLY left panel using toolbar individual toggle
    await page.getByTestId("toggle-left-panel").click();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // 3. Close ONLY right panel using header button -> left panel remains open
    await page.getByTestId("close-right-panel").click();
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBe(0);
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // 4. Reopen ONLY right panel using toolbar individual toggle
    await page.getByTestId("toggle-right-panel").click();
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);
  });

  test("alignment guidelines appear when positioning an element with arrow keys", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
    });
    await openEditor(page);

    const moveId = await page.evaluate(() => {
      const api = (window as unknown as {
        __LL_DOC__: {
          commands: {
            addLayer: (input: Record<string, unknown>) => string;
          };
          get: () => { layers: Record<string, { id: string; parentId: string | null }> };
        };
      }).__LL_DOC__;
      const doc = api.get();
      const frameId = Object.values(doc.layers).find((l) => l.parentId === null)!.id;
      api.commands.addLayer({
        archetype: "rectangle",
        parentId: frameId,
        name: "Guide Ref",
        properties: {
          positioning: "absolute",
          "frame.x": 100,
          "frame.y": 80,
          "frame.width": 90,
          "frame.height": 50,
          "paint.fills": JSON.stringify([{ type: "solid", color: "#3b82f6" }]),
        },
      });
      return api.commands.addLayer({
        archetype: "rectangle",
        parentId: frameId,
        name: "Guide Mover",
        properties: {
          positioning: "absolute",
          "frame.x": 99,
          "frame.y": 200,
          "frame.width": 90,
          "frame.height": 50,
          "paint.fills": JSON.stringify([{ type: "solid", color: "#10b981" }]),
        },
      });
    });

    const moverLoc = page.locator(`[data-element-id="${moveId}"]`).first();
    await expect(moverLoc).toBeVisible();
    const moverBox = (await moverLoc.boundingBox())!;
    await page.mouse.click(moverBox.x + moverBox.width / 2, moverBox.y + moverBox.height / 2);

    // Before nudging: no snap guide visible
    await expect(page.getByTestId("snap-guide")).toHaveCount(0);

    // Nudge 1px right -> aligns cleanly with Guide Ref at x=100 -> vertical alignment guideline appears!
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-testid="snap-guide"][data-axis="x"]').first()).toBeVisible();

    // Nudge 10px right away from alignment -> alignment line disappears
    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.getByTestId("snap-guide")).toHaveCount(0);
  });

  test("timeline expand/collapse button and 3-dot menu option stay accessible in smaller windows", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("ll-bc-motion", "1");
    });
    await page.setViewportSize({ width: 900, height: 600 });
    await openEditor(page);

    await page.getByRole("tab", { name: "Motion" }).click();

    const bottomPane = page.locator(".ll-shell-bottom");
    const collapseBtn = page.getByTestId("bottom-collapse");
    const moreBtn = page.locator("#tmore");

    await expect(bottomPane).toBeVisible();
    await expect(collapseBtn).toBeVisible();
    await expect(moreBtn).toBeVisible();
    await expect(collapseBtn).toHaveAttribute("aria-label", "Expand panel");

    // Both controls must fit inside the 900x600 viewport (not pushed off the right edge)
    const btnBox = (await collapseBtn.boundingBox())!;
    const moreBox = (await moreBtn.boundingBox())!;
    expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(900);
    expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(600);
    expect(moreBox.x + moreBox.width).toBeLessThanOrEqual(900);

    // 3-dot menu includes Expand panel when collapsed & expands the timeline
    await moreBtn.click();
    const menuToggle = page.getByRole("menuitem", { name: "Expand panel" });
    await expect(menuToggle).toBeVisible();
    const menuBox = (await menuToggle.boundingBox())!;
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(600);
    await menuToggle.click();

    await expect.poll(async () => Math.round((await bottomPane.boundingBox())?.height ?? 0)).toBeGreaterThan(150);
    await expect(collapseBtn).toHaveAttribute("aria-label", "Collapse panel");

    // Also verify at even narrower 780x560 window size: collapse & reopen via button directly
    await page.setViewportSize({ width: 780, height: 560 });
    await expect(collapseBtn).toBeVisible();
    const narrowBtnBox = (await collapseBtn.boundingBox())!;
    expect(narrowBtnBox.x + narrowBtnBox.width).toBeLessThanOrEqual(780);

    await collapseBtn.click();
    await expect.poll(async () => Math.round((await bottomPane.boundingBox())?.height ?? 0)).toBeLessThanOrEqual(50);
    await expect(collapseBtn).toHaveAttribute("aria-label", "Expand panel");

    await collapseBtn.click();
    await expect.poll(async () => Math.round((await bottomPane.boundingBox())?.height ?? 0)).toBeGreaterThan(150);
  });
});
