/**
 * ============================================================================
 * STARTER PROJECTS (ROADMAP Phase 51)
 * ============================================================================
 * A starter is a list of pages, each a list of section templates with the words they should carry. A landing page is
 * one page of all eight sections; a portfolio is two pages. Applying one adds pages and never removes anything.
 * ============================================================================
 */

import type { TemplateId } from "./sections";

export interface StarterSection {
  template: TemplateId;
  /** The section's name, and so its anchor, when it should not be the template's. */
  name?: string;
  copy?: Record<string, string>;
}

export interface StarterPage {
  name: string;
  route: string;
  sections: StarterSection[];
}

export interface Starter {
  id: string;
  name: string;
  description: string;
  pages: StarterPage[];
}

export const STARTERS: readonly Starter[] = [
  {
    id: "landing",
    name: "Landing page",
    description: "One page that explains a product: navbar, hero, features, pricing, quotes, questions, a call to action and a footer.",
    pages: [
      {
        name: "Home",
        route: "/",
        sections: [{ template: "navbar" }, { template: "hero" }, { template: "features" }, { template: "pricing" }, { template: "testimonials" }, { template: "faq" }, { template: "cta" }, { template: "footer" }],
      },
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "A home page with selected work and an About page, linked from the navigation.",
    pages: [
      {
        name: "Home",
        route: "/",
        sections: [
          { template: "navbar", copy: { brand: "Ava Stone", link1: "Work", link2: "About", link3: "Contact", action: "Hire me" } },
          { template: "hero", copy: { badge: "Available for projects", title: "I design calm, useful products", sub: "Product designer with ten years of making complicated things feel simple.", primary: "See my work", secondary: "About me" } },
          { template: "features", name: "Work", copy: { title: "Selected work", sub: "Three projects I am proud of.", f1: "Atlas", f1b: "A maps app that people actually enjoy using.", f2: "Beacon", f2b: "A dashboard that turns data into decisions.", f3: "Cove", f3b: "A booking flow that cut drop-off in half." } },
          { template: "testimonials", copy: { title: "Kind words", sub: "From people I have worked with." } },
          { template: "cta", name: "Contact", copy: { title: "Let's work together", sub: "Tell me about your project and I will reply within two days.", action: "Say hello" } },
          { template: "footer", copy: { brand: "Ava Stone", about: "Product designer, available worldwide.", legal: "© 2026 Ava Stone." } },
        ],
      },
      {
        name: "About",
        route: "/about",
        sections: [
          { template: "navbar", copy: { brand: "Ava Stone", link1: "Work", link2: "About", link3: "Contact", action: "Hire me" } },
          { template: "hero", name: "About me", copy: { badge: "About", title: "Hello, I am Ava", sub: "I have led design at two startups and one very large company, and I like small teams best.", primary: "Contact me", secondary: "View work" } },
          { template: "faq", copy: { title: "Working with me", sub: "How I usually work.", q1: "What do you take on?", a1: "Product design from first idea to shipped screens.", q2: "How long does a project take?", a2: "Most take four to eight weeks.", q3: "Do you work with teams?", a3: "Yes, embedded or remote.", q4: "How do we start?", a4: "Send a note and we will set up a call." } },
          { template: "footer", copy: { brand: "Ava Stone", about: "Product designer, available worldwide.", legal: "© 2026 Ava Stone." } },
        ],
      },
    ],
  },
];

export const starterById = (id: string): Starter | undefined => STARTERS.find((s) => s.id === id);
