/**
 * Design track D22 (the Phase 45 gate, ported to the new editor): the Variables & styles section. Switching the mode restyles
 * every bound layer and a detached one stays put; changing a variable's colour updates every layer bound to it; Bind and Detach
 * from the section; a text style restyles every layer that follows it; deleting a variable keeps the look and one undo brings
 * it back.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

type Doc = {
  commands: { addLayer: (input: unknown, label?: string) => string; updateProps: (id: string, patch: Record<string, unknown>) => void };
  get: () => { layers: Record<string, { id: string; parentId: string | null; page?: unknown; tokens?: Record<string, { variable: string; detached?: boolean }>; properties: Record<string, unknown> }>; variables?: Record<string, { id: string; name: string; values: Record<string, unknown> }>; styles?: Record<string, { id: string; name: string }> };
};
type Reg = { all: () => { id: string; run: (a?: unknown) => unknown }[] };
test.use({ viewport: { width: 1600, height: 1000 } });

const run = (page: Page, id: string, args?: unknown) => page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: Reg }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });
const doc = (page: Page) => page.evaluate(() => { const d = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get(); return { layers: d.layers, variables: d.variables ?? {}, styles: d.styles ?? {} }; });
const select = (page: Page, id: string | null) => page.evaluate((i) => { if (i) (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(i); }, id);
const css = (page: Page, id: string, prop: string) => page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first().evaluate((e, p) => (getComputedStyle(e) as unknown as Record<string, string>)[p], prop);

async function build(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  return page.evaluate(() => {
    const docApi = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const reg = (window as unknown as { __LL_COMMANDS__: Reg }).__LL_COMMANDS__;
    const call = (id: string, args: unknown) => reg.all().find((c) => c.id === id)!.run(args) as { id?: string };
    const root = Object.values(docApi.get().layers).find((l) => l.name === "Hero")!;
    const card = (name: string, x: number) => docApi.commands.addLayer({ archetype: "container", parentId: root.id, name, properties: { positioning: "absolute", "frame.x": x, "frame.y": 20, "frame.width": 100, "frame.height": 80, "appearance.background.color": "#cccccc" } });
    const cards = [card("c1", 10), card("c2", 130), card("c3", 250)];
    const text = (name: string, x: number) => docApi.commands.addLayer({ archetype: "text", parentId: root.id, name, properties: { positioning: "absolute", "frame.x": x, "frame.y": 200, "frame.width": 160, "frame.height": 30, "content.text": "Hello", "typography.fontSize": 14, "typography.color": "#000000" } });
    const texts = [text("t1", 10), text("t2", 200)];
    const surface = call("token.createVariable", { name: "surface/bg", type: "color", values: { light: "#ffffff", dark: "#101010" } }).id!;
    call("token.bind", { path: "appearance.background.color", variable: surface, ids: [cards[0], cards[1]] });
    // c3 was bound and let go, and has its own colour
    call("token.bind", { path: "appearance.background.color", variable: surface, ids: [cards[2]] });
    call("token.detach", { path: "appearance.background.color", ids: [cards[2]] });
    docApi.commands.updateProps(cards[2], { "appearance.background.color": "#ff8800" });
    return { root: root.id, cards, texts, surface };
  });
}
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

test.describe("Variables & styles (D22)", () => {
  test("switching to Dark restyles every bound layer; the detached one stays put; Light brings it back", async ({ page }) => {
    const f = await build(page);
    await expect(page.getByTestId("variables-section")).toBeVisible();
    for (const id of [f.cards[0], f.cards[1]]) await expect.poll(() => css(page, id, "backgroundColor")).toBe(rgb("#ffffff"));
    await page.getByRole("button", { name: "View Dark", exact: true }).click();
    for (const id of [f.cards[0], f.cards[1]]) await expect.poll(() => css(page, id, "backgroundColor")).toBe(rgb("#101010"));
    expect(await css(page, f.cards[2], "backgroundColor")).toBe(rgb("#ff8800"));
    await page.getByRole("button", { name: "View Light", exact: true }).click();
    for (const id of [f.cards[0], f.cards[1]]) await expect.poll(() => css(page, id, "backgroundColor")).toBe(rgb("#ffffff"));
  });

  test("a colour changed in the section updates every layer bound to it, in the mode being viewed; it says where it is used", async ({ page }) => {
    const f = await build(page);
    await expect(page.getByTestId(`used-${f.surface}`)).toHaveText("2 used");
    const field = page.getByLabel("surface/bg in Light", { exact: true });
    await field.fill("#336699");
    for (const id of [f.cards[0], f.cards[1]]) await expect.poll(() => css(page, id, "backgroundColor")).toBe(rgb("#336699"));
    expect((await doc(page)).variables[f.surface].values.dark).toBe("#101010"); // the other mode is its own
  });

  test("Bind from the section, then Detach keeps what is shown; Re-link follows the variable again", async ({ page }) => {
    const f = await build(page);
    await select(page, f.texts[0]);
    await page.getByLabel("New variable name").fill("ink/text");
    await chooseOption(page, "New variable type", "Colour");
    await page.getByRole("button", { name: "Add variable", exact: true }).click();
    await expect.poll(async () => Object.values((await doc(page)).variables).some((v) => v.name === "ink/text")).toBe(true);
    await page.getByLabel("ink/text in Light", { exact: true }).fill("#0000ff");
    await chooseOption(page, "Variable to bind", "ink/text");
    await chooseOption(page, "Property to bind", "Text colour");
    await page.getByRole("button", { name: "Bind property to variable", exact: true }).click();
    await expect.poll(() => css(page, f.texts[0], "color")).toBe(rgb("#0000ff"));
    await expect(page.locator('[data-binding-path="typography.color"]')).toContainText("follows ink/text");

    await page.getByRole("button", { name: "Detach Text colour", exact: true }).click();
    await expect(page.locator('[data-binding-path="typography.color"]')).toContainText("detached from ink/text");
    await page.getByLabel("ink/text in Light", { exact: true }).fill("#00aa00");
    expect(await css(page, f.texts[0], "color")).toBe(rgb("#0000ff")); // a detached value stays put
    await page.getByRole("button", { name: "Re-link Text colour", exact: true }).click();
    await expect.poll(() => css(page, f.texts[0], "color")).toBe(rgb("#00aa00"));
  });

  test("a text style: made from one text, applied to another, a change restyles both", async ({ page }) => {
    const f = await build(page);
    await select(page, f.texts[0]);
    await run(page, "token.createVariable", { name: "x", type: "number", values: { light: 1 } }); // (keeps the section busy with data)
    await page.evaluate(([id]) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.commands.updateProps(id, { "typography.fontSize": 31 }), [f.texts[0]]);
    await page.getByLabel("New style name").fill("Headline");
    await page.getByRole("button", { name: "Create style from selection", exact: true }).click();
    await expect.poll(async () => Object.values((await doc(page)).styles).map((s) => s.name)).toEqual(["Headline"]);
    await select(page, f.texts[1]);
    await page.getByRole("button", { name: "Apply Headline", exact: true }).click();
    await expect.poll(() => css(page, f.texts[1], "fontSize")).toBe("31px");
    const style = Object.values((await doc(page)).styles)[0];
    await run(page, "style.update", { id: style.id, props: { "typography.fontSize": 40 } });
    for (const id of f.texts) await expect.poll(() => css(page, id, "fontSize")).toBe("40px");
  });

  test("deleting a variable keeps the look, and one undo brings the variable and its bindings back", async ({ page }) => {
    const f = await build(page);
    await page.getByRole("button", { name: "Delete surface/bg", exact: true }).click();
    await expect.poll(async () => Object.keys((await doc(page)).variables).length).toBe(0);
    expect(await css(page, f.cards[0], "backgroundColor")).toBe(rgb("#ffffff")); // the look stays
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(async () => Object.keys((await doc(page)).variables).length).toBe(1);
    expect((await doc(page)).layers[f.cards[0]].tokens?.["appearance.background.color"]?.variable).toBe(f.surface);
  });

  test("editing a bound value by hand detaches it, the section says so, Re-link binds it again", async ({ page }) => {
    const f = await build(page);
    await select(page, f.cards[0]);
    await expect(page.locator('[data-binding-path="appearance.background.color"]')).toContainText("follows surface/bg");
    await page.evaluate(([id]) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.commands.updateProps(id, { "appearance.background.color": "#123456" }), [f.cards[0]]);
    await expect(page.locator('[data-binding-path="appearance.background.color"]')).toContainText("detached from surface/bg");
    await expect.poll(() => css(page, f.cards[0], "backgroundColor")).toBe(rgb("#123456"));
    await page.getByRole("button", { name: "Re-link Fill", exact: true }).click();
    await expect.poll(() => css(page, f.cards[0], "backgroundColor")).toBe(rgb("#ffffff"));
  });
});
