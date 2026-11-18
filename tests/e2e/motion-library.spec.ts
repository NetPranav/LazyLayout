/**
 * ROADMAP Phase 91 gate (in part): the Motion library section in Motion. Search finds effects, an effect can go on the
 * selected layer, shows once as one collapsible card with its props, changes when a prop does, and Detach leaves
 * ordinary animation behind. Hover effects are refused on text with the reason.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type Win = {
  __LL_TEST__: boolean;
  __LL_SELECT__: (id: string) => void;
  __LL_DOC__: { get: () => { effects: Record<string, { effectId: string; propOverrides: Record<string, number> }>; clips: Record<string, { duration: number; layerId: string }> }; commands: { addLayer: (l: unknown) => string } };
};
test.use({ viewport: { width: 1600, height: 1000 } });
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get())) as ReturnType<Win["__LL_DOC__"]["get"]>);

test("Phase 91: search, insert, tune and detach a library effect", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_DOC__);
  const id = await page.evaluate(() => (window as unknown as Win).__LL_DOC__.commands.addLayer({ archetype: "text", parentId: "hero", name: "Words", properties: { positioning: "absolute", "frame.x": 20, "frame.y": 40, "frame.width": 200, "frame.height": 40 } }));
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
  const section = page.locator('[data-section="motion-library"]');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("status", { name: "Library results" })).toContainText("51 effects");

  // search narrows; a nonsense word finds nothing
  await section.getByLabel("Search the motion library").fill("zzzz-nothing");
  await expect(section.getByRole("status", { name: "Library results" })).toContainText("0 effects");
  await section.getByLabel("Search the motion library").fill("stagger");
  await expect(section.getByRole("status", { name: "Library results" })).not.toContainText("51 effects");
  await expect(section.getByTestId("library-thumb").first()).toBeVisible();

  // insert the first one that the text layer can take
  const insert = section.getByRole("button", { name: /^Insert / }).and(page.locator(":not([disabled])")).first();
  const label = (await insert.getAttribute("aria-label"))!.replace("Insert ", "");
  await insert.click();
  const card = section.locator("[data-instance]");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("button", { name: `${label} effect` })).toHaveAttribute("aria-expanded", "true");
  let d = await doc(page);
  expect(Object.keys(d.effects)).toHaveLength(1);
  const clipId = Object.keys(d.clips).find((k) => d.clips[k].layerId === id)!;
  const before = d.clips[clipId].duration;

  // tune: the duration changes the clip, and a collapsed card hides its controls
  const duration = card.getByLabel(`${label} Duration`);
  await duration.fill(String(+(before + 1).toFixed(2)));
  await duration.press("Enter");
  await expect.poll(async () => (await doc(page)).clips[clipId].duration).toBeCloseTo(before + 1, 2);
  await card.getByRole("button", { name: `${label} effect` }).click();
  await expect(duration).toHaveCount(0);
  await card.getByRole("button", { name: `${label} effect` }).click();
  await expect(duration).toBeVisible();

  // detach leaves the animation, forgets the effect
  await card.getByRole("button", { name: `Detach ${label}` }).click();
  await expect(card).toHaveCount(0);
  d = await doc(page);
  expect(Object.keys(d.effects)).toHaveLength(0);
  expect(d.clips[clipId]).toBeTruthy();

  // a hover effect is not offered to text, with the reason
  await section.getByLabel("Search the motion library").fill("hover");
  const refused = section.getByRole("button", { name: /^Insert / }).and(page.locator("[disabled]")).first();
  await expect(refused).toHaveAttribute("title", /Rule 6\.1/);
});
