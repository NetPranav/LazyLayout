import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

test.describe("panels, arrow-key alignment guides, and small-window timeline toggle", () => {
  test("individual left and right panels can close, reopen, and drag-snap open/closed without header collapse buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openEditor(page);

    const leftPane = page.locator(".ll-shell-left");
    const rightPane = page.locator(".ll-shell-right");
    const shellRoot = page.locator(".ll-editor-root");

    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // Header collapse buttons are removed from both left and right panel headers
    await expect(page.getByTestId("close-left-panel")).toHaveCount(0);
    await expect(page.getByTestId("close-right-panel")).toHaveCount(0);

    // 1. Close ONLY left panel via canvas toolbar toggle -> right panel remains open
    await page.getByTestId("toggle-left-panel").click();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBe(0);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // 2. Drag left edge handle only slightly (20px) and release -> snaps back closed to 0
    const leftHandle = page.getByTestId("left-panel-drag-handle");
    const lBox = (await leftHandle.boundingBox())!;
    await page.mouse.move(lBox.x + 2, lBox.y + lBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(lBox.x + 22, lBox.y + lBox.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBe(0);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");

    // 3. Drag left edge handle past snap-open threshold (110px) -> snaps open with spring settle to >= 240px
    const lBox2 = (await leftHandle.boundingBox())!;
    await page.mouse.move(lBox2.x + 2, lBox2.y + lBox2.height / 2);
    await page.mouse.down();
    await page.mouse.move(lBox2.x + 110, lBox2.y + lBox2.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(240);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");

    // 4. Drag open left panel inward past collapse threshold -> snaps closed while right stays open
    const lOpenBox = (await leftHandle.boundingBox())!;
    await page.mouse.move(lOpenBox.x + lOpenBox.width / 2, lOpenBox.y + lOpenBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(40, lOpenBox.y + lOpenBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBe(0);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThan(150);

    // 5. Reopen left panel via canvas toolbar toggle, then drag-close & drag-open RIGHT panel
    await page.getByTestId("toggle-left-panel").click();
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(240);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");

    const rightHandle = page.getByTestId("right-panel-drag-handle");
    const rOpenBox = (await rightHandle.boundingBox())!;
    await page.mouse.move(rOpenBox.x + rOpenBox.width / 2, rOpenBox.y + rOpenBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(1240, rOpenBox.y + rOpenBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBe(0);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");
    await expect.poll(async () => Math.round((await leftPane.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(240);

    const rCollapsedBox = (await rightHandle.boundingBox())!;
    await page.mouse.move(rCollapsedBox.x + 4, rCollapsedBox.y + rCollapsedBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rCollapsedBox.x - 110, rCollapsedBox.y + rCollapsedBox.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await rightPane.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(280);
    await expect(shellRoot).not.toHaveAttribute("data-pfx", "");
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
