/**
 * Design track D4: a driver (a binding) makes a layer react to the pointer. The engine runs in Motion and Preview; in Design
 * the canvas shows the design itself.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));

test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const drawnBox = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first().boundingBox();

test.describe("Drivers (D4)", () => {
  test("the pointer drives a layer's position in Motion; Design shows the design", async ({ page }) => {
    const r = await setup(page);
    const designX = (await drawnBox(page, r.id))!.x;

    await page.getByText("Motion", { exact: true }).first().click();
    await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
    await page.evaluate(
      ([id]) => (window as unknown as { __LL_ENGINE__: { addBinding: (t: string, o: string) => string } }).__LL_ENGINE__.addBinding(`pointer.x |> remap(0, 1000, 0, 300)\n-> ${id}.transform.x blend add`, id),
      [r.id],
    );

    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const at = async (fx: number) => {
      await page.mouse.move(page0.x + page0.width * fx, page0.y + page0.height * 0.8, { steps: 6 });
      await page.waitForTimeout(250);
      return (await drawnBox(page, r.id))!.x;
    };
    const left = await at(0.1);
    const right = await at(0.9);
    expect(right - left, "moving the pointer right moves the layer right").toBeGreaterThan(40);

    // the document itself is unchanged: a driver is behaviour, not a stored position
    expect((await layers(page))[r.id].properties["transform.x"] ?? 0).toBe(r.properties["transform.x"] ?? 0);

    // and Design shows the design again
    await page.getByText("Design", { exact: true }).first().click();
    await expect.poll(async () => Math.abs((await drawnBox(page, r.id))!.x - designX)).toBeLessThan(1.5);
  });

  test("the Driven by section adds, turns off and removes a driver", async ({ page }) => {
    const r = await setup(page);
    const section = page.getByText("Driven by", { exact: true }).first();
    await expect(section).toBeVisible();

    // defaults: pointer left to right drives Position X
    await page.getByRole("button", { name: "Add driver", exact: true }).click();
    const bindings = async () => Object.values(((await page.evaluate(() => (window as unknown as { __LL_DOC__: { get: () => { bindings: Record<string, unknown> } } }).__LL_DOC__.get().bindings)) ?? {}) as Record<string, { enabled: boolean; ownerLayerId: string; target: { path: string } }>);
    await expect.poll(async () => (await bindings()).length).toBe(1);
    const [b] = await bindings();
    expect(b.ownerLayerId).toBe(r.id);
    expect(b.target.path).toBe("transform.x");
    await expect(page.locator("[data-driver-id]")).toContainText("Pointer, left to right → Position X");

    // turn it off, then on, then remove
    await page.getByRole("button", { name: /^Turn off driver/ }).click();
    await expect.poll(async () => (await bindings())[0].enabled).toBe(false);
    await page.getByRole("button", { name: /^Turn on driver/ }).click();
    await expect.poll(async () => (await bindings())[0].enabled).toBe(true);
    await page.getByRole("button", { name: /^Remove driver/ }).click();
    await expect.poll(async () => (await bindings()).length).toBe(0);

    // one undo step brings it back
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(async () => (await bindings()).length).toBe(1);
  });

  test("a driver made in the panel moves the layer with the pointer in Motion", async ({ page }) => {
    const r = await setup(page);
    const designX = (await drawnBox(page, r.id))!.x;
    await page.getByRole("button", { name: "Add driver", exact: true }).click();
    await page.getByText("Motion", { exact: true }).first().click();
    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const at = async (fx: number) => {
      await page.mouse.move(page0.x + page0.width * fx, page0.y + page0.height * 0.8, { steps: 6 });
      await page.waitForTimeout(250);
      return (await drawnBox(page, r.id))!.x;
    };
    const left = await at(0.05);
    const right = await at(0.95);
    expect(right - left).toBeGreaterThan(30); // defaults: 0..1 of the page maps to 0..200 px
    expect(Math.abs(left - designX)).toBeLessThan(60);
  });

  test("Follow: the chosen point of a layer follows the pointer (D6)", async ({ page }) => {
    const r = await setup(page);
    await page.getByLabel("Follow pin", { exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Bottom", exact: true }).first().click();
    await page.waitForTimeout(500);
    const lag = page.getByLabel("Follow lag", { exact: true }).first();
    await lag.fill("0");
    await lag.press("Enter");
    await page.getByRole("button", { name: "Follow the pointer", exact: true }).click();
    await expect.poll(async () => Object.values(((await page.evaluate(() => (window as unknown as { __LL_DOC__: { get: () => { bindings: Record<string, unknown> } } }).__LL_DOC__.get().bindings)) ?? {}) as Record<string, { name?: string }>).filter((b) => b.name === "Follow pointer").length).toBe(2);
    await expect(page.locator("[data-driver-id]")).toHaveCount(2);

    await page.getByText("Motion", { exact: true }).first().click();
    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const target = { x: page0.x + page0.width * 0.7, y: page0.y + page0.height * 0.6 };
    await page.mouse.move(target.x - 80, target.y - 50, { steps: 4 });
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.waitForTimeout(400);
    const box = (await drawnBox(page, r.id))!;
    expect(Math.abs(box.x + box.width / 2 - target.x)).toBeLessThan(3);
    expect(Math.abs(box.y + box.height - target.y)).toBeLessThan(3); // the bottom edge sits on the pointer

    // one undo step takes the whole follow away
    await page.getByText("Design", { exact: true }).first().click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect(page.locator("[data-driver-id]")).toHaveCount(0);
  });

  test("a helper layer is drawn in the editor and left out of the export (D6)", async ({ page }) => {
    const r = await setup(page);
    const exported = () =>
      page.evaluate(async () => {
        const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
        const out = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
        return out.files.map((f) => f.text ?? "").join("\n");
      });
    const before = await exported();
    await page.getByRole("button", { name: "Helper layer", exact: true }).click();
    await expect.poll(async () => (await layers(page))[r.id].properties["render.role"]).toBe("helper");
    await expect(page.locator(`[data-testid="stage-page"] [data-element-id="${r.id}"]`).first()).toBeVisible(); // still drawn while designing
    const after = await exported();
    expect(after.length).toBeLessThan(before.length - 30);
    await page.getByRole("button", { name: "Helper layer", exact: true }).click();
    await expect.poll(async () => (await layers(page))[r.id].properties["render.role"] ?? "").toBe("");
    expect((await exported()).length).toBe(before.length);
  });
});
