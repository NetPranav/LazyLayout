import { SECTION_TEMPLATES, type SectionTemplate, type TemplateId } from "@/core/templates/sections";

export type SectionCategory = "hero" | "content" | "pricing" | "navigation";

const CATEGORY_OF: Record<TemplateId, SectionCategory> = {
  hero: "hero",
  cta: "hero",
  features: "content",
  testimonials: "content",
  faq: "content",
  pricing: "pricing",
  navbar: "navigation",
  footer: "navigation",
};

const LABELS: Record<SectionCategory, string> = {
  hero: "Hero",
  content: "Content",
  pricing: "Pricing",
  navigation: "Navigation",
};

const ORDER: readonly SectionCategory[] = ["hero", "content", "pricing", "navigation"];

export const categoryOf = (t: SectionTemplate): SectionCategory => CATEGORY_OF[t.id];

/** The categories that really have templates, in display order. */
export const CATEGORIES: ReadonlyArray<{ id: SectionCategory; label: string }> = ORDER.filter((c) =>
  SECTION_TEMPLATES.some((t) => CATEGORY_OF[t.id] === c),
).map((id) => ({ id, label: LABELS[id] }));
