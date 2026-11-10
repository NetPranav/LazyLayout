/** Template commands (ROADMAP Phase 51, Law 20): the gallery opens from `insert.sectionsGallery`; the other two are what agents call. */

import { z } from "zod";
import { defineCommand, defineTypedCommand } from "../commands";
import { useTemplatesUiStore } from "../store/useTemplatesUiStore";
import { SECTION_TEMPLATES } from "./sections";
import { STARTERS } from "./starters";
import { applyStarter, insertSection } from "./templateOps";

export function registerTemplateCommands(): () => void {
  const category = "Insert";
  const offs = [
    defineCommand({ id: "insert.sectionsGallery", title: "Insert Section...", category, run: () => useTemplatesUiStore.getState().open() }),
    defineTypedCommand({
      id: "insert.section",
      title: "Insert Section",
      category,
      description: `Adds a section template to a page: ${SECTION_TEMPLATES.map((t) => t.id).join(", ")}. Its colours follow the brand variables, so switching the theme restyles it.`,
      args: z.object({
        template: z.enum(SECTION_TEMPLATES.map((t) => t.id) as [string, ...string[]]),
        pageId: z.string().optional(),
        name: z.string().max(120).optional(),
        copy: z.record(z.string(), z.string().max(500)).optional(),
      }),
      run: ({ template, pageId, name, copy }) => {
        const id = insertSection(template, { pageId, name, copy });
        if (!id) throw new Error(`Couldn't insert \`${template}\`.`);
        return { id };
      },
    }),
    defineTypedCommand({
      id: "project.addStarter",
      title: "Add Starter Project",
      category,
      description: `Adds the pages of a starter project (${STARTERS.map((s) => s.id).join(", ")}). Nothing already in the document is removed.`,
      args: z.object({ starter: z.enum(STARTERS.map((s) => s.id) as [string, ...string[]]) }),
      run: ({ starter }) => ({ pages: applyStarter(starter) ?? [] }),
    }),
  ];
  return () => offs.forEach((off) => off());
}
