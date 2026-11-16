import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1280, height: 800 } });

test("Motion tab timeline collapse button turns into expand button and restores the pane", async ({ page }) => {
  await openEditor(page);

  await page.getByRole("tab", { name: "Motion" }).click();
  const bottomPane = page.locator(".ll-shell-bottom");
  await expect(bottomPane).toBeVisible();

  const toggleBtn = page.getByTestId("bottom-collapse");
  await expect(toggleBtn).toBeVisible();
  await expect(toggleBtn).toHaveAttribute("aria-label", "Collapse panel");
  await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

  const expandedBox = (await bottomPane.boundingBox())!;
  expect(expandedBox.height).toBeGreaterThan(200);

  // Collapse the timeline pane
  await toggleBtn.click();

  await expect(toggleBtn).toHaveAttribute("aria-label", "Expand panel");
  await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => Math.round((await bottomPane.boundingBox())?.height ?? 0)).toBeLessThanOrEqual(50);

  // Ensure the expand button itself remains completely inside the collapsed strip and viewport
  const collapsedBtnBox = (await toggleBtn.boundingBox())!;
  const collapsedPaneBox = (await bottomPane.boundingBox())!;
  expect(collapsedBtnBox.y).toBeGreaterThanOrEqual(collapsedPaneBox.y);
  expect(collapsedBtnBox.y + collapsedBtnBox.height).toBeLessThanOrEqual(collapsedPaneBox.y + collapsedPaneBox.height + 2);
  expect(collapsedBtnBox.y + collapsedBtnBox.height).toBeLessThanOrEqual(800);

  // Expand the timeline pane back
  await toggleBtn.click();

  await expect(toggleBtn).toHaveAttribute("aria-label", "Collapse panel");
  await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  await expect.poll(async () => Math.round((await bottomPane.boundingBox())?.height ?? 0)).toBeGreaterThan(200);
  await expect(page.getByRole("tablist", { name: "Compositions" })).toBeVisible();
});
