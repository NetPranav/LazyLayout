/**
 * Text layer with an image fill (background-clip: text effect).
 * Checks that setting an image fill applies background-clip text, background-image,
 * that the layer's box has no visible background colour, and that removing the fill
 * restores the solid colour.
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = {
  id: string;
  archetype: string;
  name: string;
  parentId: string | null;
  children: string[];
  visible?: boolean;
  properties: Record<string, unknown>;
};

type Win = {
  __LL_TEST__: boolean;
  __LL_DOC__: {
    get: () => { layers: Record<string, L> };
    commands: {
      addLayer: (input: unknown) => string;
      updateProps: (id: string, p: Record<string, unknown>) => void;
    };
  };
};

const drawn = (page: Page, id: string) =>
  page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}

test.describe("text image fill (Phase 35/37 Task A)", () => {
  test("text layer filled with an image clips letters and restores solid colour on removal", async ({ page }) => {
    await ready(page);

    // 1. Add a text layer
    const textId = await page.evaluate(() => {
      const doc = (window as unknown as Win).__LL_DOC__.get();
      const rootId = Object.values(doc.layers).find((l) => l.archetype === "container" && l.parentId === null)?.id;
      return (window as unknown as Win).__LL_DOC__.commands.addLayer({
        archetype: "text",
        name: "MountainTitle",
        parentId: rootId ?? null,
        properties: {
          "content.text": "Mountain Peaks",
          "typography.fontSize": 48,
          "typography.color": "#2563eb",
          "frame.width": 400,
          "frame.height": 80,
          "frame.x": 100,
          "frame.y": 100,
          positioning: "absolute",
        },
      });
    });

    await expect(drawn(page, textId)).toBeVisible();

    // Select the text layer in the left layers list
    await page.getByText("MountainTitle", { exact: true }).first().click();

    // 2. In the inspector Fill section, open the fill settings popover
    const fillRow = page.locator('[data-k="fill"]').first();
    await expect(fillRow).toBeVisible();

    const swatchButton = fillRow.locator('[data-lead]').first();
    await swatchButton.click();

    // Change paint type to Image
    const paintTypeSelect = page.getByRole("combobox", { name: "Paint type" });
    await expect(paintTypeSelect).toBeVisible();
    await paintTypeSelect.click();

    const imageOption = page.getByRole("option", { name: "Image" });
    await expect(imageOption).toBeVisible();
    await imageOption.click();

    // Pick image file
    const fixturePath = path.resolve(process.cwd(), "tests/e2e/fixtures/mountain-subject.svg");
    const fileInput = page.locator('input[aria-label="Fill picture"]');
    await fileInput.setInputFiles(fixturePath);

    // 3. Verify drawn text node computed styles:
    // - has background-clip: text (or -webkit-background-clip: text)
    // - has a background-image
    // - box has no visible background colour (transparent)
    const textNode = drawn(page, textId);

    await expect.poll(async () => {
      return await textNode.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          clip: cs.backgroundClip || cs.webkitBackgroundClip,
          hasImage: cs.backgroundImage.includes("url("),
        };
      });
    }).toMatchObject({
      clip: "text",
      hasImage: true,
    });

    const boxBg = await textNode.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(["rgba(0, 0, 0, 0)", "transparent"]).toContain(boxBg);

    // 4. Remove the fill via the inspector minus button
    const removeButton = fillRow.locator('[data-rm]').first();
    await removeButton.click();

    // 5. Verify that removing the fill restores the solid colour and removes background-clip text
    await expect.poll(async () => {
      return await textNode.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          clip: cs.backgroundClip || cs.webkitBackgroundClip,
          image: cs.backgroundImage,
          color: cs.color,
        };
      });
    }).toMatchObject({
      image: "none",
      color: "rgb(37, 99, 235)", // #2563eb
    });

    const styleAfterRemove = await textNode.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        clip: cs.backgroundClip || cs.webkitBackgroundClip,
      };
    });
    expect(styleAfterRemove.clip).not.toBe("text");
  });
});
