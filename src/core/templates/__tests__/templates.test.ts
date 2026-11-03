/**
 * ROADMAP Phase 51: section templates and starter projects, on real documents. Each template inserts as a real section
 * with its colours and radius bound to the brand variables, switching the theme restyles all of them, inserting again
 * does not duplicate the variables, and a starter adds linked pages, each as one undo step.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument, getResolvedDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useModeStore } from "../../store/useModeStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { pagesOf, sectionsOf, resolveLink } from "../../pages/pages";
import { createPage } from "../../pages/pageOps";
import { BRAND_TOKENS, brandName } from "../brand";
import { SECTION_TEMPLATES, templateById } from "../sections";
import { STARTERS } from "../starters";
import { applyStarter, insertSection } from "../templateOps";

const L = () => getDocument().layers;
const subtree = (id: string): Layer[] => [L()[id], ...L()[id].children.flatMap(subtree)];
const brandVars = () => Object.values(getDocument().variables ?? {}).filter((v) => v.name.startsWith("brand/"));
const empty = () => {
  setDocument(createDocumentFromLayers([createLayer({ id: "root", archetype: "container", parentId: null, name: "Scratch", children: [], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 100, "frame.height": 100 } }) as Layer]));
  useSelectionStore.getState().clearSelection();
  useModeStore.getState().setActive(null);
};

describe("Phase 51: section templates", () => {
  beforeEach(empty);

  it("there are eight, each with a name, a description and words to edit", () => {
    assert.deepEqual(SECTION_TEMPLATES.map((t) => t.id), ["navbar", "hero", "features", "pricing", "testimonials", "faq", "cta", "footer"]);
    for (const t of SECTION_TEMPLATES) {
      assert.ok(t.name && t.description, t.id);
      assert.ok(Object.keys(t.copy).length >= 3, `${t.id} has copy to edit`);
      assert.ok(t.build(t.copy).length > 0, t.id);
    }
  });

  for (const template of SECTION_TEMPLATES) {
    it(`${template.name}: inserts as a section with real layers bound to the brand variables`, () => {
      const id = insertSection(template.id)!;
      assert.ok(id, "returned the section");
      const section = L()[id];
      assert.ok(section.section, "it is a section");
      assert.equal(section.name, template.name);
      assert.equal(pagesOf(getDocument()).length, 1, "a page was made for it");
      const all = subtree(id);
      assert.ok(all.length > 4, `${all.length} layers`);
      assert.ok(all.some((l) => l.archetype === "text"));
      const bound = all.filter((l) => l.tokens && Object.keys(l.tokens).length > 0);
      assert.ok(bound.length >= 2, `${bound.length} layers are bound to variables`);
      for (const l of bound) for (const b of Object.values(l.tokens!)) assert.ok(getDocument().variables?.[b.variable]?.name.startsWith("brand/"), `${l.name} binds to a brand variable`);
    });
  }

  it("makes the brand variables once, and uses them again for the next section", () => {
    insertSection("hero");
    const first = brandVars();
    assert.equal(first.length, BRAND_TOKENS.length);
    insertSection("features");
    insertSection("footer");
    assert.deepEqual(brandVars().map((v) => v.id).sort(), first.map((v) => v.id).sort(), "no variable was added or replaced");
    assert.deepEqual(new Set(brandVars().map((v) => v.name)), new Set(BRAND_TOKENS.map(brandName)));
  });

  it("keeps a person's edit to a brand variable", () => {
    insertSection("hero");
    const primary = brandVars().find((v) => v.name === brandName("primary"))!;
    const light = Object.keys(primary.values)[0];
    documentLayerEdit(primary.id, light, "#ff0000");
    insertSection("cta");
    assert.equal(brandVars().find((v) => v.name === brandName("primary"))!.values[light], "#ff0000");
  });

  it("switching the document to Dark restyles every layer of every template", () => {
    for (const t of SECTION_TEMPLATES) insertSection(t.id);
    const bound = Object.values(L()).filter((l) => l.tokens && Object.keys(l.tokens).length > 0);
    assert.ok(bound.length > 60, `${bound.length} bound layers`);
    const colour = (l: Layer, path: string) => String(l.properties[path]);
    const lightBg = Object.fromEntries(bound.map((l) => [l.id, colour(getResolvedDocument().layers[l.id], "appearance.background.color")]));
    useModeStore.getState().setActive("dark");
    const resolved = getResolvedDocument().layers;
    const darkBg = Object.fromEntries(bound.map((l) => [l.id, colour(resolved[l.id], "appearance.background.color")]));
    const bg = bound.filter((l) => l.tokens!["appearance.background.color"]);
    assert.ok(bg.length > 20);
    const changed = bg.filter((l) => lightBg[l.id] !== darkBg[l.id]);
    assert.equal(changed.length, bg.length, `all ${bg.length} background-bound layers changed (changed ${changed.length})`);
    const text = bound.filter((l) => l.tokens!["typography.color"]);
    assert.ok(text.length > 20);
    assert.equal(text.filter((l) => colour(getResolvedDocument().layers[l.id], "typography.color") !== "undefined").length, text.length);
    assert.notEqual(colour(resolved[text[0].id], "typography.color"), colour(Object.values(getDocument().layers).find((l) => l.id === text[0].id)!, "typography.color"), "text colour comes from the Dark value, not the literal");
  });

  it("the navbar goes first, the footer last, and the rest between, whatever order they were added in", () => {
    for (const id of ["footer", "cta", "hero", "navbar", "features"]) insertSection(id);
    const page = pagesOf(getDocument())[0].id;
    const names = sectionsOf(L(), page).map((s) => s.name);
    assert.equal(names[0], "Navbar");
    assert.equal(names.at(-1), "Footer");
    assert.deepEqual(new Set(names), new Set(["Navbar", "Hero", "Features", "Call to action", "Footer"]));
  });

  it("goes onto the page the selection is in, else the first page", () => {
    const a = createPage({ name: "A" })!;
    const b = createPage({ name: "B" })!;
    useSelectionStore.getState().selectMultiple([b], "element");
    const s = insertSection("hero")!;
    assert.equal(L()[s].parentId, b);
    useSelectionStore.getState().clearSelection();
    const faq = insertSection("faq")!;
    assert.equal(L()[faq].parentId, a);
  });

  it("the page grows with its sections instead of clipping them", () => {
    for (const id of ["navbar", "hero", "features"]) insertSection(id);
    const page = L()[pagesOf(getDocument())[0].id];
    assert.equal(page.properties["sizing.vertical"], "hug");
  });

  it("is one undo step, and takes its variables with it", () => {
    insertSection("pricing");
    assert.ok(brandVars().length > 0);
    historyCommands.undo();
    assert.equal(brandVars().length, 0, "the variables went with the section");
    assert.equal(pagesOf(getDocument()).length, 0, "and so did the page made for it");
  });

  it("refuses an unknown template", () => {
    assert.equal(insertSection("nope"), null);
    assert.equal(templateById("nope"), undefined);
  });

  it("the words can be replaced", () => {
    const id = insertSection("hero", { copy: { title: "Hello, world" }, name: "Intro" })!;
    assert.equal(L()[id].name, "Intro");
    assert.ok(subtree(id).some((l) => l.properties["content.text"] === "Hello, world"));
  });
});

describe("Phase 51: starter projects", () => {
  beforeEach(empty);

  it("a landing page is one page with all eight sections in order", () => {
    const made = applyStarter("landing")!;
    assert.equal(made.length, 1);
    assert.deepEqual(sectionsOf(L(), made[0]).map((s) => s.name), ["Navbar", "Hero", "Features", "Pricing", "Testimonials", "FAQ", "Call to action", "Footer"]);
  });

  it("the navbar links lead to the sections they name", () => {
    const [page] = applyStarter("landing")!;
    const navbar = sectionsOf(L(), page)[0];
    const links = subtree(navbar.id).filter((l) => l.link);
    assert.equal(links.length, 3, "Features, Pricing and FAQ are linked");
    for (const l of links) {
      const dest = resolveLink(getDocument(), l.link!);
      assert.equal(dest?.kind, "anchor");
      assert.equal(L()[(dest as { sectionId: string }).sectionId].parentId, page);
    }
  });

  it("a portfolio is two pages; its navigation reaches a section and the other page", () => {
    const [home, about] = applyStarter("portfolio")!;
    assert.deepEqual(pagesOf(getDocument()).map((p) => [p.name, p.route]), [["Home", "/"], ["About", "/about"]]);
    const links = subtree(sectionsOf(L(), home)[0].id).filter((l) => l.link).map((l) => resolveLink(getDocument(), l.link!)?.kind);
    assert.deepEqual(links.sort(), ["anchor", "anchor", "page"], "Work and Contact are sections, About is a page");
    assert.ok(sectionsOf(L(), about).length >= 3);
    const back = subtree(sectionsOf(L(), about)[0].id).filter((l) => l.link).map((l) => resolveLink(getDocument(), l.link!));
    assert.deepEqual(back.map((d) => d?.kind).sort(), ["anchor", "anchor", "page"], "the About page's navigation reaches the Home page's sections too");
    assert.ok(back.filter((d) => d?.kind === "anchor").every((d) => (d as { pageId: string }).pageId === home));
  });

  it("adds to what is there and removes nothing", () => {
    const before = createPage({ name: "Mine" })!;
    applyStarter("landing");
    assert.ok(L()[before], "the existing page is still there");
    assert.equal(pagesOf(getDocument()).length, 2);
  });

  it("is one undo step for the whole project", () => {
    applyStarter("portfolio");
    historyCommands.undo();
    assert.equal(pagesOf(getDocument()).length, 0);
    assert.equal(brandVars().length, 0);
  });

  it("refuses an unknown starter", () => {
    assert.equal(applyStarter("nope"), null);
    assert.ok(STARTERS.length >= 2);
  });
});

/** Sets one mode's value of a variable, as the Token Manager does. */
function documentLayerEdit(variableId: string, modeId: string, value: string) {
  const d = getDocument();
  const v = d.variables![variableId];
  setDocument({ ...d, variables: { ...d.variables, [variableId]: { ...v, values: { ...v.values, [modeId]: value } } } });
}
