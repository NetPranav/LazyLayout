/**
 * Loading pages: the screen shown between two pages. Hovering between two pages in the Pages menu shows a line with a +;
 * clicking it adds a thin "Loading" entry between them. Opening it shows the page it comes from on the left, the loading
 * page itself, and the page it leads to on the right, each reference with a dropdown to choose any page.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitSaved } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

const list = (page: Page) => page.locator('[role=listbox][aria-label="Pages list"] [role=option]');
const entries = (page: Page) =>
  list(page).evaluateAll((els) => els.map((e) => `${(e.textContent ?? "").trim()}:${e.getAttribute("data-kind")}`));

async function openMenu(page: Page) {
  await page.locator("#pagebtn").click();
  await expect(page.getByRole("menu", { name: "Pages" })).toBeVisible();
  await page.waitForTimeout(400); // the menu springs open
}

/** Moves the pointer onto the boundary between two rows of the Pages menu. */
async function hoverBetween(page: Page, upper: number) {
  const a = (await list(page).nth(upper).boundingBox())!;
  const b = (await list(page).nth(upper + 1).boundingBox())!;
  await page.mouse.move(a.x + 60, a.y + 6);
  await page.mouse.move(a.x + 60, b.y - 1, { steps: 4 });
}

/** Hovers between the first two rows and clicks the + that shows there. */
async function addLoadingBetweenFirstTwo(page: Page) {
  const plus = page.getByTestId("add-loading-between");
  await expect(async () => {
    await hoverBetween(page, 0);
    await expect(plus).toBeVisible({ timeout: 500 });
  }).toPass();
  await plus.click();
}

async function twoPages(page: Page) {
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await openMenu(page);
  await page.getByRole("menuitem", { name: /New page/ }).click();
  await expect(page.locator("#pagelabel")).not.toHaveText("Home");
}

test.describe("loading pages", () => {
  test("a + between two pages adds a thin Loading entry there, and it opens with both pages beside it", async ({ page }) => {
    await twoPages(page);
    await openMenu(page);
    expect(await entries(page)).toEqual(["Home:page", "Page 2:page"]);
    await expect(page.getByTestId("add-loading-between"), "nothing until the pointer is between two pages").toHaveCount(0);

    const plus = page.getByTestId("add-loading-between");
    await expect(async () => {
      await hoverBetween(page, 0);
      await expect(plus).toBeVisible({ timeout: 500 });
    }, "a line with a + shows between the two pages").toPass();
    await expect(plus).toHaveAccessibleName(/between Home and Page 2/);
    await plus.click();

    await expect(page.locator("#pagelabel")).toHaveText("Loading");
    await openMenu(page);
    expect(await entries(page), "the loading entry sits between the two pages").toEqual(["Home:page", "Loading:loading", "Page 2:page"]);
    const thin = (await list(page).nth(1).boundingBox())!.height;
    const full = (await list(page).nth(0).boundingBox())!.height;
    expect(thin, "a thin row").toBeLessThan(full - 4);
    // no + next to a loading entry: it is already between those two
    await hoverBetween(page, 0);
    await page.waitForTimeout(400);
    await expect(page.getByTestId("add-loading-between")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // the loading page is drawn between the page it comes from and the one it leads to
    const from = page.getByTestId("transition-from-page");
    const to = page.getByTestId("transition-to-page");
    await expect(from).toBeVisible();
    await expect(to).toBeVisible();
    const fromId = await from.getAttribute("data-page-id");
    const toId = await to.getAttribute("data-page-id");
    expect(fromId).not.toBe(toId);
    const f = (await from.boundingBox())!;
    const c = (await page.locator("[data-stage=artboard]").boundingBox())!;
    const t = (await to.boundingBox())!;
    expect(f.x + f.width, "From is left of the loading page").toBeLessThan(c.x);
    expect(t.x, "To is right of it").toBeGreaterThan(c.x + c.width);
    const view = (await page.locator("[data-stage=workspace]").boundingBox())!;
    for (const box of [f, c, t]) {
      expect(box.x, "all three fit on screen").toBeGreaterThanOrEqual(view.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width + 1);
    }
    // what a reference shows is that page, drawn
    await expect(from.locator("[data-archetype]").first()).toBeAttached();
  });

  test("each reference has a dropdown to pick any page, the same one on both sides too, and it is kept", async ({ page }) => {
    await twoPages(page);
    await openMenu(page);
    await addLoadingBetweenFirstTwo(page);
    await expect(page.locator("#pagelabel")).toHaveText("Loading");

    const right = page.getByRole("combobox", { name: "Page shown on the right" });
    const left = page.getByRole("combobox", { name: "Page shown on the left" });
    await expect(left).toContainText("Home");
    await expect(right).toContainText("Page 2");
    await expect(page.getByRole("menu", { name: "Pages" })).toHaveCount(0); // the Pages menu has finished closing
    await right.click();
    await expect(page.getByRole("option").first()).toBeVisible();
    const choices = await page.getByRole("option").allTextContents();
    expect(choices.map((x) => x.trim()), "pages only, no loading entries").toEqual(["Home", "Page 2"]);
    await page.getByRole("option", { name: "Home" }).click();
    await expect(right).toContainText("Home");
    expect(await page.getByTestId("transition-to-page").getAttribute("data-page-id")).toBe(await page.getByTestId("transition-from-page").getAttribute("data-page-id"));

    await waitSaved(page);
    await page.waitForTimeout(800);
    await waitSaved(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#pagelabel")).toHaveText("Loading");
    await expect(page.getByRole("combobox", { name: "Page shown on the right" })).toContainText("Home");
    await openMenu(page);
    expect(await entries(page)).toEqual(["Home:page", "Loading:loading", "Page 2:page"]);
  });

  test("an ordinary page shows no references, and the view returns to the page", async ({ page }) => {
    await twoPages(page);
    await openMenu(page);
    await addLoadingBetweenFirstTwo(page);
    await expect(page.getByTestId("transition-from")).toBeVisible();
    const zoomedOut = (await page.locator("[data-stage=artboard]").boundingBox())!.width;

    await openMenu(page);
    await page.getByRole("option", { name: "Home" }).click();
    await expect(page.locator("#pagelabel")).toHaveText("Home");
    await expect(page.getByTestId("transition-from")).toHaveCount(0);
    await expect.poll(async () => (await page.locator("[data-stage=artboard]").boundingBox())!.width, "the page fills the view again").toBeGreaterThan(zoomedOut * 2);
  });

  test("the last real page cannot be deleted just because a loading page is also there", async ({ page }) => {
    await twoPages(page);
    await openMenu(page);
    await addLoadingBetweenFirstTwo(page);
    await openMenu(page);
    await page.getByRole("option", { name: "Page 2" }).click();
    await openMenu(page);
    await page.getByRole("menuitem", { name: "Delete" }).click(); // Page 2: Home is still a real page, so this is allowed
    await openMenu(page);
    expect((await entries(page)).filter((e) => e.endsWith(":page")), "one real page left").toEqual(["Home:page"]);
    await expect(page.getByRole("menuitem", { name: "Delete" }), "the last real page stays").toBeDisabled();
  });
});

test("the Pages menu can be hovered when it is reopened straight after a choice", async ({ page }) => {
  await openEditor(page);
  await page.locator("#pagebtn").click();
  await page.getByRole("menu", { name: "Pages" }).waitFor();
  await page.getByRole("menuitem", { name: /New page/ }).click(); // closes the menu; it is still closing when it is opened again
  await expect(page.locator("#pagelabel")).not.toHaveText("Home");
  await page.locator("#pagebtn").click();
  await expect(page.getByRole("menu", { name: "Pages" })).toBeVisible();
  await expect.poll(() => page.getByRole("menu", { name: "Pages" }).evaluate((m) => getComputedStyle(m).pointerEvents), "the menu answers the pointer").toBe("auto");
});
