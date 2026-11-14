/**
 * Design track D12 (Phases 83 and 84): split a text into words or lines, each at exactly its place, exposed to a screen reader once,
 * and animated one after another.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; name: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

const TEXT = "The quick brown fox jumps over the lazy dog and keeps running far away";

async function paragraph(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.keyboard.press("Delete");
    }
  }
  const before = new Set(Object.keys(await layers(page)));
  await page.getByRole("button", { name: /^Text/ }).first().click();
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.15, b.y + b.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.35, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.type(TEXT);
  await page.keyboard.press("Escape");
  const id = Object.values(await layers(page)).find((l) => !before.has(l.id))!.id;
  await expect(page.getByRole("button", { name: "Split into words", exact: true })).toBeVisible();
  return id;
}
/** Where each word of the drawn text is: its box on the screen. */
const drawnWords = (page: Page, id: string) =>
  page.evaluate((x) => {
    const node = document.querySelector(`[data-testid="stage-page"] [data-element-id="${x}"]`)!;
    const out: { text: string; left: number; top: number; right: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
      for (const m of t.data.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(t, m.index!);
        r.setEnd(t, m.index! + m[0].length);
        const b = r.getBoundingClientRect();
        out.push({ text: m[0], left: b.left, top: b.top, right: b.right, bottom: b.bottom });
      }
    }
    return out;
  }, id);

test.describe("Split text (D12)", () => {
  test("words: one layer per word, each at the place of its word, in a group a screen reader reads once", async ({ page }) => {
    const id = await paragraph(page);
    const original = await drawnWords(page, id);
    expect(original.length).toBe(TEXT.split(" ").length);
    expect(new Set(original.map((w) => Math.round(w.top))).size, "the paragraph wraps onto more than one line").toBeGreaterThan(1);

    await page.getByRole("button", { name: "Split into words", exact: true }).click();
    const all = await layers(page);
    expect(all[id], "the text itself is replaced").toBeUndefined();
    const group = Object.values(all).find((l) => l.properties["group.role"] === "words")!;
    expect(group.children.length).toBe(original.length);
    expect(group.properties["a11y.label"]).toBe(TEXT);
    expect(group.properties["a11y.role"]).toBe("group");
    const pieces = group.children.map((c) => all[c]);
    expect(pieces.map((p) => p.properties["content.text"])).toEqual(original.map((w) => w.text));
    expect(pieces.every((p) => p.properties["a11y.hidden"] === true)).toBe(true);

    // each piece sits where its word was drawn (within a pixel or two of the page's own scale)
    const drawn = await Promise.all(group.children.map((c) => page.locator(`[data-testid="stage-page"] [data-element-id="${c}"]`).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom }; })));
    const k = (await page.locator('[data-testid="stage-page"]').boundingBox())!.width / (await page.locator('[data-testid="stage-page"]').evaluate((e) => (e as HTMLElement).offsetWidth));
    original.forEach((w, i) => {
      expect(Math.abs(drawn[i].left - w.left), `"${w.text}" left`).toBeLessThan(2.5 * k + 1);
      expect(Math.abs((drawn[i].top + drawn[i].bottom) / 2 - (w.top + w.bottom) / 2), `"${w.text}" vertical centre`).toBeLessThan(3 * k + 1);
    });

    // the page: the group is named with the whole text, each piece is hidden
    const groupEl = page.locator(`[data-testid="stage-page"] [data-element-id="${group.id}"]`).first();
    await expect(groupEl).toHaveAttribute("aria-label", TEXT);
    await expect(groupEl).toHaveAttribute("role", "group");
    expect(await groupEl.locator('[aria-hidden="true"]').count()).toBe(original.length);
    // and what a screen reader is given: the text once
    const tree = await groupEl.ariaSnapshot();
    expect((tree.match(/The quick brown fox/g) ?? []).length, tree).toBe(1);
    expect(tree).not.toMatch(/- text: (The|quick|brown)\b/);

    // one undo step brings the paragraph back
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(async () => Object.values(await layers(page)).some((l) => l.properties["group.role"] === "words")).toBe(false);
  });

  test("lines: one layer per drawn line, each a whole line of text", async ({ page }) => {
    const id = await paragraph(page);
    const original = await drawnWords(page, id);
    const lineTops = [...new Set(original.map((w) => Math.round(w.top)))];
    await page.getByRole("button", { name: "Split into lines", exact: true }).click();
    const all = await layers(page);
    const group = Object.values(all).find((l) => l.properties["group.role"] === "lines")!;
    expect(group.children.length).toBe(lineTops.length);
    const texts = group.children.map((c) => String(all[c].properties["content.text"]));
    expect(texts.join(" ")).toBe(TEXT); // the lines read as the paragraph, in order
    expect(group.properties["a11y.label"]).toBe(TEXT);
    expect(texts.some((t) => t.includes(" ")), "a line holds several words").toBe(true);
    expect(texts.every((t) => t === t.trim() && t.length > 0)).toBe(true);
  });

  test("animate: the pieces come in one after another, a word at a time", async ({ page }) => {
    const id = await paragraph(page);
    await page.getByRole("button", { name: "Split into words", exact: true }).click();
    await page.getByRole("button", { name: "Animate letters", exact: true }).click();
    const doc = await page.evaluate(() => (window as unknown as { __LL_DOC__: { get: () => { clips: Record<string, { name: string; delay?: number; layerId: string }> } } }).__LL_DOC__.get().clips);
    const clips = Object.values(doc).sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0));
    expect(clips.length).toBe(TEXT.split(" ").length);
    expect(clips[0].name).toBe("Word 1 entrance");
    // a word at a time: 0.1 s apart (a letter would be 0.04)
    clips.forEach((c, i) => expect(Math.abs((c.delay ?? 0) - i * 0.1)).toBeLessThan(0.002));
    expect(id).toBeTruthy();
  });
});
