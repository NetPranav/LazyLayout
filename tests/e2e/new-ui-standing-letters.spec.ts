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
      addLayer: (input: unknown, label?: string) => string;
      updateProps: (id: string, p: Record<string, unknown>) => void;
      moveLayer: (id: string, parentId: string | null, index?: number, label?: string) => void;
      removeLayer: (id: string) => void;
    };
  };
  __LL_COMMANDS__?: {
    run: (id: string, args?: unknown) => boolean;
  };
};

const layers = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_DOC__.get().layers);
const drawn = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe("Task F: 3D standing letters with thickness", () => {
  test("type FERRARI, split, stand up, extrude, remove depth, and car layering", async ({ page }) => {
    // 1. Initialize editor with test seam enabled
    await page.addInitScript(() => {
      (window as unknown as Win).__LL_TEST__ = true;
    });
    await openEditor(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();

    // 2. Create the "FERRARI" text layer
    const textLayerId = await page.evaluate(() => {
      const win = window as unknown as Win;
      const root = Object.values(win.__LL_DOC__.get().layers).find((l) => l.parentId === null);
      if (!root) throw new Error("Root layer not found");
      return win.__LL_DOC__.commands.addLayer(
        {
          archetype: "text",
          parentId: root.id,
          name: "FERRARI",
          properties: {
            "content.text": "FERRARI",
            "frame.x": 120,
            "frame.y": 200,
            "frame.width": 450,
            "frame.height": 80,
            "typography.fontSize": 56,
            "typography.fontFamily": "Inter",
            "typography.fontWeight": "700",
            "typography.color": "#E11D48",
            positioning: "absolute",
          },
        },
        "Add FERRARI text",
      );
    });

    const textEl = drawn(page, textLayerId);
    await expect(textEl).toBeVisible();

    // Select the text layer
    await page.locator(`[data-testid="stage-element"][data-element-id="${textLayerId}"]`).click();

    // 3. Split into letters
    const splitBtn = page.getByRole("button", { name: "Split into letters" });
    if (await splitBtn.isVisible().catch(() => false)) {
      await splitBtn.click();
    } else {
      await page.evaluate((id) => {
        const win = window as unknown as Win;
        win.__LL_COMMANDS__?.run("text.splitLetters", { id });
      }, textLayerId);
    }

    // Wait for the letters group to appear
    await expect.poll(async () => {
      const docLayers = await layers(page);
      return Object.values(docLayers).some((l) => l.name === "FERRARI letters" && l.archetype === "container");
    }, "letters group created").toBe(true);

    const docAfterSplit = await layers(page);
    const lettersGroup = Object.values(docAfterSplit).find((l) => l.name === "FERRARI letters" && l.archetype === "container")!;
    expect(lettersGroup).toBeTruthy();

    const letterChildren = lettersGroup.children
      .map((cid) => docAfterSplit[cid])
      .filter((l): l is L => Boolean(l && l.archetype === "text"));
    expect(letterChildren.length).toBeGreaterThanOrEqual(7);

    // Select the letters group through the Layers panel (groups have no stage box of their own)
    await page.locator(`#p-layers .row[data-sel="${lettersGroup.id}"]`).click();

    // 4. Stand letters up
    const standBtn = page.getByRole("button", { name: "Stand letters up" });
    if (await standBtn.isVisible().catch(() => false)) {
      await standBtn.click();
    } else {
      await page.evaluate((id) => {
        const win = window as unknown as Win;
        win.__LL_COMMANDS__?.run("text.standLetters", { id });
      }, lettersGroup.id);
    }

    // Check that the group has transform-style: preserve-3d
    await expect.poll(async () => {
      return drawn(page, lettersGroup.id).evaluate((el) => getComputedStyle(el).transformStyle);
    }, "group has transform-style preserve-3d").toBe("preserve-3d");

    // Check that each letter's computed transform contains rotateX (as matrix3d in computed style)
    for (const letter of letterChildren) {
      await expect.poll(async () => {
        return drawn(page, letter.id).evaluate((el) => getComputedStyle(el).transform);
      }, `letter ${letter.name} computed transform contains matrix3d`).toContain("matrix3d");
    }

    // 5. Extrude letters (give depth)
    const extrudeBtn = page.getByRole("button", { name: "Give letters depth" });
    if (await extrudeBtn.isVisible().catch(() => false)) {
      await extrudeBtn.click();
    } else {
      await page.evaluate((id) => {
        const win = window as unknown as Win;
        win.__LL_COMMANDS__?.run("text.extrudeLetters", { id, depth: 24 });
      }, lettersGroup.id);
    }

    // Check that every letter has 8 depth copies at distinct translateZ
    await expect.poll(async () => {
      const doc = await layers(page);
      const allCopies = Object.values(doc).filter((l) => l.name.includes(" depth ") && l.archetype === "text");
      return allCopies.length;
    }, "8 depth copies per letter created").toBe(letterChildren.length * 8);

    const docAfterExtrude = await layers(page);
    for (const letter of letterChildren) {
      const copies = Object.values(docAfterExtrude).filter(
        (l) => l.name.startsWith(`${letter.name} depth `) && l.archetype === "text"
      );
      // FERRARI has two R's: copies are matched by name, so each repeated letter owns 8 per occurrence
      const occurrences = letterChildren.filter((l) => l.name === letter.name).length;
      expect(copies, `letter ${letter.name} must have 8 copies per occurrence`).toHaveLength(8 * occurrences);

      const tzValues = copies.map((c) => Number(c.properties["transform.translateZ"]));
      const uniqueTz = new Set(tzValues);
      expect(uniqueTz.size, `distinct translateZ for letter ${letter.name}`).toBe(8);

      for (const tz of tzValues) {
        expect(tz, "depth translateZ is negative").toBeLessThan(0);
      }
    }

    // 6. Remove depth restores the clean letters group
    const removeBtn = page.getByRole("button", { name: "Remove depth" });
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
    } else {
      await page.evaluate((id) => {
        const win = window as unknown as Win;
        win.__LL_COMMANDS__?.run("text.removeDepth", { id });
      }, lettersGroup.id);
    }

    await expect.poll(async () => {
      const doc = await layers(page);
      const remainingDepth = Object.values(doc).filter((l) => l.name.includes(" depth"));
      return remainingDepth.length;
    }, "depth copies removed").toBe(0);

    const docAfterRemove = await layers(page);
    const restoredGroup = docAfterRemove[lettersGroup.id];
    expect(restoredGroup.children.length).toBe(letterChildren.length);

    // 7. Layering test: check that a letter placed above a car image in the Layers list draws above it
    const carImageId = await page.evaluate((parentGId) => {
      const win = window as unknown as Win;
      const root = Object.values(win.__LL_DOC__.get().layers).find((l) => l.parentId === null);
      if (!root) throw new Error("Root not found");
      return win.__LL_DOC__.commands.addLayer(
        {
          archetype: "image",
          parentId: root.id,
          name: "Car",
          properties: {
            "frame.x": 100,
            "frame.y": 180,
            "frame.width": 400,
            "frame.height": 200,
            "appearance.background.color": "#1E293B",
            positioning: "absolute",
          },
        },
        "Add Car",
      );
    }, lettersGroup.id);

    await expect(drawn(page, carImageId)).toBeVisible();

    // In root.children: place car first, lettersGroup after it (so in Layers list, lettersGroup is ABOVE Car)
    await page.evaluate(([cId, gId]) => {
      const win = window as unknown as Win;
      const root = Object.values(win.__LL_DOC__.get().layers).find((l) => l.parentId === null)!;
      // Move car to index 0, group to index 1
      win.__LL_DOC__.commands.moveLayer(cId, root.id, 0);
      win.__LL_DOC__.commands.moveLayer(gId, root.id, 1);
    }, [carImageId, lettersGroup.id]);

    // Verify DOM order: lettersGroup follows car in DOM, meaning lettersGroup draws above car
    const drawnAbove = await page.evaluate(([cId, gId]) => {
      const carEl = document.querySelector(`[data-element-id="${cId}"]`);
      const groupEl = document.querySelector(`[data-element-id="${gId}"]`);
      if (!carEl || !groupEl) return false;
      return Boolean(carEl.compareDocumentPosition(groupEl) & Node.DOCUMENT_POSITION_FOLLOWING);
    }, [carImageId, lettersGroup.id]);

    expect(drawnAbove, "letters group drawn above car in DOM painting order").toBe(true);
  });
});
