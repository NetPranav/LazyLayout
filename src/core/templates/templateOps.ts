/**
 * ============================================================================
 * INSERTING SECTIONS AND STARTER PROJECTS (ROADMAP Phase 51)
 * ============================================================================
 * `insertSection` puts a template at the right place on a page as a real section: it makes the brand variables if the
 * document lacks them, builds the layers, binds their colours and radii to those variables, and is one undo step.
 * `applyStarter` adds the pages of a starter project the same way, then links the navigation text to the sections and
 * pages it names. Nothing here deletes anything: a starter only adds pages.
 * ============================================================================
 */

import { documentCommands } from "../store/useDocumentStore";
import { getDocument } from "../store/documentState";
import { useSelectionStore } from "../store/useSelectionStore";
import { transaction } from "../editing/editOps";
import { bindVariable } from "../tokens/tokenOps";
import { addSection, createPage, setLink } from "../pages/pageOps";
import { anchorName, anchorOf, pagesOf, sectionsOf } from "../pages/pages";
import { ensureBrandTokens, BRAND_DEFAULTS, type Token } from "./brand";
import { templateById, type SectionTemplate } from "./sections";
import type { TNode } from "./spec";
import { STARTERS, starterById } from "./starters";

export interface PendingLink {
  layerId: string;
  /** The name of the section or page the text should lead to. */
  target: string;
}

export interface InsertOptions {
  pageId?: string;
  /** Words to use in place of the template's own, by key. */
  copy?: Record<string, string>;
  /** The section's name (and so its anchor), when it should not be the template's. */
  name?: string;
}

/** The page new sections go to: the page the selection is in, else the first page, else a new one. */
export function currentPage(): string {
  const doc = getDocument();
  const pages = pagesOf(doc);
  const topOf = (id: string): string | null => {
    let l = doc.layers[id];
    for (let guard = 0; l && guard < 10_000; guard++) {
      if (l.parentId === null) return l.id;
      l = doc.layers[l.parentId];
    }
    return null;
  };
  for (const id of useSelectionStore.getState().selectedIds) {
    const top = topOf(id);
    if (top && pages.some((p) => p.id === top)) return top;
  }
  return pages[0]?.id ?? (createPage() as string);
}

/** Builds one node and its children under `parentId`, binds its tokens, and records the links it asks for. */
function buildNode(node: TNode, parentId: string, tokens: Record<Token, string>, links: PendingLink[]): string {
  const id = documentCommands.addLayer({ archetype: node.archetype, parentId, name: node.name.slice(0, 120), properties: node.props }, "Insert section");
  for (const [path, token] of Object.entries(node.bind)) bindVariable([id], path, tokens[token]);
  if (node.goes) links.push({ layerId: id, target: node.goes });
  for (const child of node.children) buildNode(child, id, tokens, links);
  return id;
}

function buildSection(template: SectionTemplate, pageId: string, options: InsertOptions, links: PendingLink[]): string {
  const tokens = ensureBrandTokens();
  const copy = { ...template.copy, ...options.copy };
  const id = addSection(pageId, { name: options.name ?? template.name, height: 100 });
  if (!id) throw new Error("Couldn't add a section to that page.");
  // a page of stacked sections grows with them, instead of clipping what doesn't fit its starting height
  if (getDocument().layers[pageId].properties["sizing.vertical"] !== "hug") documentCommands.updateProps(pageId, { "sizing.vertical": "hug" });
  const { bg, padY } = template.band;
  documentCommands.updateProps(id, {
    "layout.auto": true,
    "layout.display": "flex",
    "layout.flexDirection": "column",
    "layout.gap": 0,
    "layout.alignItems": "center",
    "layout.justifyContent": "flex-start",
    "layout.paddingTop": padY,
    "layout.paddingBottom": padY,
    "layout.paddingLeft": 24,
    "layout.paddingRight": 24,
    "sizing.horizontal": "fill",
    "sizing.vertical": "hug",
    "appearance.background.color": bg ? (BRAND_DEFAULTS[bg].light as string) : "transparent",
  });
  if (bg) bindVariable([id], "appearance.background.color", tokens[bg]);
  for (const node of template.build(copy)) buildNode(node, id, tokens, links);
  // the navbar goes first and the footer last; anything else stays above the footer
  const page = getDocument().layers[pageId];
  if (template.place === "top") documentCommands.moveLayer(id, pageId, 0);
  else if (template.place === "bottom") documentCommands.moveLayer(id, pageId, page.children.length - 1);
  else {
    const footerAt = page.children.findIndex((k) => k !== id && getDocument().layers[k]?.section && getDocument().layers[k].name === "Footer");
    if (footerAt >= 0) documentCommands.moveLayer(id, pageId, footerAt);
  }
  return id;
}

/** Links the text that names a section or a page to it. Names that match nothing are left alone. Returns how many were linked. */
export function resolveLinks(links: readonly PendingLink[]): number {
  let n = 0;
  for (const { layerId, target } of links) {
    const doc = getDocument();
    const layer = doc.layers[layerId];
    if (!layer) continue;
    let top = layer;
    for (let guard = 0; top.parentId && guard < 10_000; guard++) top = doc.layers[top.parentId];
    const wanted = anchorName(target);
    // a section on the same page first, then one on another page (the navigation of a second page points back at the first)
    const section = sectionsOf(doc.layers, top.id).find((s) => anchorOf(s) === wanted) ?? pagesOf(doc).flatMap((p) => sectionsOf(doc.layers, p.id)).find((s) => anchorOf(s) === wanted);
    if (section) n += setLink([layerId], { kind: "anchor", target: section.id });
    else {
      const page = pagesOf(doc).find((p) => anchorName(p.name) === wanted || p.route.replace(/^\//, "") === wanted);
      if (page) n += setLink([layerId], { kind: "page", target: page.id });
    }
  }
  return n;
}

/** Inserts a section template on a page. Returns the new section's id, or null for an unknown template. */
export function insertSection(templateId: string, options: InsertOptions = {}): string | null {
  const template = templateById(templateId);
  if (!template) return null;
  let id: string | null = null;
  transaction(`Insert ${template.name}`, () => {
    const pageId = options.pageId ?? currentPage();
    const links: PendingLink[] = [];
    id = buildSection(template, pageId, options, links);
    resolveLinks(links);
    useSelectionStore.getState().selectMultiple([id], "element");
  });
  return id;
}

/** Adds the pages of a starter project to the document. Returns the new pages' ids, or null for an unknown starter. */
export function applyStarter(starterId: string): string[] | null {
  const starter = starterById(starterId);
  if (!starter) return null;
  const made: string[] = [];
  transaction(`Add starter: ${starter.name}`, () => {
    const links: PendingLink[] = [];
    for (const page of starter.pages) {
      const pageId = createPage({ name: page.name, route: page.route });
      if (!pageId) continue;
      made.push(pageId);
      for (const s of page.sections) {
        const template = templateById(s.template);
        if (template) buildSection(template, pageId, { copy: s.copy, name: s.name }, links);
      }
    }
    resolveLinks(links);
    if (made.length) useSelectionStore.getState().selectMultiple([made[0]], "element");
  });
  return made;
}

export { STARTERS };
