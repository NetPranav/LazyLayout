import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("Grid Alignment & Canvas Zoom", () => {
  test("7. Grid Layout 3x3 alignment matrix highlights clicked dot and aligns child rectangle", async ({ page }) => {
    await openEditor(page);

    // Draw a Frame on the stage
    const vp = (await page.locator('[data-testid="stage-viewport"]').boundingBox())!;
    await page.mouse.click(vp.x + vp.width / 2, vp.y + 40);
    await page.keyboard.press("f");
    await page.mouse.move(vp.x + 120, vp.y + 120);
    await page.mouse.down();
    await page.mouse.move(vp.x + 420, vp.y + 380);
    await page.mouse.up();

    const frameId = await page.locator('[data-testid="layer-row"][data-selected="true"]').first().getAttribute("data-layer-id");
    expect(frameId).toBeTruthy();

    // Apply Grid Layout
    await page.getByRole("radio", { name: "Grid layout" }).click();

    // Draw a fixed-size Rectangle inside the Grid Frame
    await page.keyboard.press("r");
    await page.mouse.move(vp.x + 140, vp.y + 140);
    await page.mouse.down();
    await page.mouse.move(vp.x + 200, vp.y + 180);
    await page.mouse.up();

    const rectId = await page.locator('[data-testid="layer-row"][data-selected="true"]').first().getAttribute("data-layer-id");
    expect(rectId).toBeTruthy();

    // Select the Frame again and switch to 1 column so all 9 dots span the full frame
    await page.locator(`[data-testid="layer-row"][data-layer-id="${frameId}"]`).click();
    const colsInput = page.getByLabel("Columns", { exact: true });
    await colsInput.fill("1");
    await colsInput.press("Enter");

    const matrix = page.getByRole("group", { name: "Alignment matrix" });
    const labels = [
      "Top left",
      "Top center",
      "Top right",
      "Middle left",
      "Center",
      "Middle right",
      "Bottom left",
      "Bottom center",
      "Bottom right",
    ] as const;

    const positions: Record<string, { relX: number; relY: number }> = {};

    for (const label of labels) {
      const btn = matrix.getByRole("button", { name: label, exact: true });
      await btn.click();
      await expect(btn).toHaveAttribute("aria-pressed", "true");

      // Only the clicked dot should be pressed
      const pressedCount = await matrix.locator('button[aria-pressed="true"]').count();
      expect(pressedCount).toBe(1);

      const box = await page.evaluate(
        ({ fid, rid }) => {
          const f = document.querySelector(`[data-element-id="${fid}"]`)!.getBoundingClientRect();
          const r = document.querySelector(`[data-element-id="${rid}"]`)!.getBoundingClientRect();
          return { relX: Math.round(r.x - f.x), relY: Math.round(r.y - f.y) };
        },
        { fid: frameId!, rid: rectId! }
      );
      positions[label] = box;
    }

    // Horizontal alignment progression: left < center < right
    expect(positions["Top left"].relX).toBeLessThan(positions["Top center"].relX);
    expect(positions["Top center"].relX).toBeLessThan(positions["Top right"].relX);
    expect(positions["Bottom left"].relX).toBeLessThan(positions["Bottom center"].relX);
    expect(positions["Bottom center"].relX).toBeLessThan(positions["Bottom right"].relX);

    // Vertical alignment progression: top < middle < bottom
    expect(positions["Top left"].relY).toBeLessThan(positions["Middle left"].relY);
    expect(positions["Middle left"].relY).toBeLessThan(positions["Bottom left"].relY);
    expect(positions["Top right"].relY).toBeLessThan(positions["Middle right"].relY);
    expect(positions["Middle right"].relY).toBeLessThan(positions["Bottom right"].relY);
  });

  test("8. Ctrl + Scroll changes canvas zoom gradually in small increments", async ({ page }) => {
    await openEditor(page);

    const zoomReadout = () =>
      page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /^\d+%$/.test(b.textContent?.trim() ?? "")
        );
        return btn ? parseInt(btn.textContent!.trim(), 10) : null;
      });

    const initialZoom = await zoomReadout();
    expect(initialZoom).not.toBeNull();

    const vp = await page.locator('[data-testid="stage-viewport"]').boundingBox();
    expect(vp).not.toBeNull();

    await page.mouse.move(vp!.x + vp!.width / 2, vp!.y + vp!.height / 2);
    await page.keyboard.down("Control");

    await page.mouse.wheel(0, -144);
    await expect.poll(zoomReadout).toBeGreaterThan(initialZoom!);
    const afterZoomIn = (await zoomReadout())!;
    // Gradual zoom step: at most +25% relative change (e.g. 50% -> ~57%, never a massive jump)
    expect(afterZoomIn).toBeLessThanOrEqual(Math.ceil(initialZoom! * 1.25));

    await page.mouse.wheel(0, 144);
    await expect.poll(zoomReadout).toBeLessThan(afterZoomIn);

    await page.keyboard.up("Control");
  });
});
