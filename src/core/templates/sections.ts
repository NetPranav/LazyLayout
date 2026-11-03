/**
 * ============================================================================
 * THE SECTION TEMPLATES (ROADMAP Phase 51)
 * ============================================================================
 * Eight full-width bands a page is built from: navbar, hero, features, pricing, testimonials, FAQ, call to action and
 * footer. They are original layouts (nothing copied from a template kit), made of auto-layout frames, text and
 * buttons, and every colour and radius is a brand token, so switching the theme restyles them all. The words are
 * placeholders a person replaces; a starter project can pass its own.
 * ============================================================================
 */

import { button, frame, goes, picture, rule, text, type TNode } from "./spec";

export type TemplateId = "navbar" | "hero" | "features" | "pricing" | "testimonials" | "faq" | "cta" | "footer";

export interface SectionTemplate {
  id: TemplateId;
  name: string;
  description: string;
  /** Where it goes on a page: the first thing, the last thing, or in between. */
  place: "top" | "middle" | "bottom";
  /** The section's own frame, without a width limit; `inner` builds what sits in the centred column. */
  band: { bg: "background" | "surface" | "primary" | null; padY: number };
  /** The text a person edits, by key, with its starting words. */
  copy: Record<string, string>;
  build(copy: Record<string, string>): TNode[];
}

const MAX = 1120;

/** The centred column every band keeps its content in. */
const column = (name: string, children: TNode[], gap = 0, align: "flex-start" | "center" = "flex-start"): TNode =>
  frame(name, { dir: "column", gap, w: "fill", maxWidth: MAX, align }, children);

const heading = (name: string, content: string, align: "left" | "center" = "center"): TNode =>
  text(name, content, { size: 40, weight: 700, align, w: "fill", maxWidth: 720, lineHeight: 1.15 });

const lead = (name: string, content: string, align: "left" | "center" = "center", color: "muted" | "on-primary" = "muted"): TNode =>
  text(name, content, { size: 18, color, align, w: "fill", maxWidth: 640, lineHeight: 1.55 });

/** A heading with the line under it, centred. */
const intro = (title: string, sub: string): TNode =>
  frame("Intro", { dir: "column", gap: 12, align: "center", w: "fill" }, [heading("Heading", title), lead("Subheading", sub)]);

export const SECTION_TEMPLATES: readonly SectionTemplate[] = [
  {
    id: "navbar",
    name: "Navbar",
    description: "Logo on the left, links in the middle, a button on the right.",
    place: "top",
    band: { bg: "background", padY: 0 },
    copy: { brand: "Brand", link1: "Features", link2: "Pricing", link3: "FAQ", action: "Get started" },
    build: (c) => [
      column("Bar", [
        frame("Row", { dir: "row", justify: "space-between", align: "center", w: "fill", pad: [18, 0], wrap: true, gap: 16 }, [
          text("Logo", c.brand, { size: 22, weight: 700 }),
          frame("Links", { dir: "row", gap: 28, align: "center" }, [
            goes(text("Link 1", c.link1, { weight: 500, color: "muted" }), c.link1),
            goes(text("Link 2", c.link2, { weight: 500, color: "muted" }), c.link2),
            goes(text("Link 3", c.link3, { weight: 500, color: "muted" }), c.link3),
          ]),
          button("Action", c.action, "primary"),
        ]),
      ]),
      rule("Divider"),
    ],
  },
  {
    id: "hero",
    name: "Hero",
    description: "A big headline, a line of support, two buttons and a picture.",
    place: "middle",
    band: { bg: "background", padY: 88 },
    copy: { badge: "New", title: "Build something people remember", sub: "A short, honest sentence about what this does and who it is for.", primary: "Get started", secondary: "See how it works" },
    build: (c) => [
      column(
        "Hero",
        [
          frame("Badge", { pad: [6, 14], bg: "surface", round: true, border: true }, [text("Badge text", c.badge, { size: 13, weight: 600, color: "muted" })]),
          text("Title", c.title, { size: 60, weight: 800, align: "center", w: "fill", maxWidth: 820, lineHeight: 1.08 }),
          lead("Subtitle", c.sub),
          frame("Buttons", { dir: "row", gap: 12, justify: "center", wrap: true }, [button("Primary", c.primary, "primary"), button("Secondary", c.secondary, "secondary")]),
          picture("Picture", 420),
        ],
        28,
        "center",
      ),
    ],
  },
  {
    id: "features",
    name: "Features",
    description: "A heading and three cards, each with an icon, a title and a line.",
    place: "middle",
    band: { bg: "surface", padY: 88 },
    copy: { title: "Everything you need", sub: "Three reasons it is worth your time.", f1: "Fast to start", f1b: "Pick a template, change the words, and you are live.", f2: "Made to adapt", f2b: "Looks right on a phone, a tablet and a wide screen.", f3: "Yours to keep", f3b: "Export clean code that does not depend on us." },
    build: (c) => {
      const card = (n: string, t: string, b: string) =>
        frame(`Card ${n}`, { dir: "column", gap: 12, pad: 28, w: "fill", grow: true, minWidth: 260, bg: "background", round: true, border: true }, [
          frame(`Icon ${n}`, { w: 44, h: 44, bg: "primary", round: true }),
          text(`Title ${n}`, t, { size: 20, weight: 700 }),
          text(`Body ${n}`, b, { color: "muted", w: "fill" }),
        ]);
      return [column("Features", [intro(c.title, c.sub), frame("Cards", { dir: "row", gap: 24, w: "fill", wrap: true }, [card("1", c.f1, c.f1b), card("2", c.f2, c.f2b), card("3", c.f3, c.f3b)])], 48, "center")];
    },
  },
  {
    id: "pricing",
    name: "Pricing",
    description: "Three plans side by side, the middle one highlighted.",
    place: "middle",
    band: { bg: "background", padY: 88 },
    copy: { title: "Simple pricing", sub: "Start free. Upgrade when you need more.", name1: "Starter", price1: "$0", name2: "Pro", price2: "$19", name3: "Team", price3: "$49", note: "per month", cta: "Choose plan" },
    build: (c) => {
      const plan = (n: string, name: string, price: string, hot: boolean, lines: string[]) => {
        const card = frame(`Plan ${n}`, { dir: "column", gap: 16, pad: 28, w: "fill", grow: true, minWidth: 260, bg: hot ? "surface" : "background", round: true, border: true }, [
          text(`Name ${n}`, name, { size: 16, weight: 700, color: hot ? "primary" : "muted" }),
          frame(`Price ${n}`, { dir: "row", gap: 6, align: "flex-start" }, [text(`Amount ${n}`, price, { size: 44, weight: 800, lineHeight: 1.1 }), text(`Per ${n}`, c.note, { size: 14, color: "muted" })]),
          rule(`Rule ${n}`),
          frame(`Includes ${n}`, { dir: "column", gap: 10, w: "fill" }, lines.map((l, i) => text(`Line ${n}.${i + 1}`, l, { color: "muted" }))),
          button(`Choose ${n}`, c.cta, hot ? "primary" : "secondary"),
        ]);
        if (hot) {
          card.props["appearance.border.width"] = 2;
          card.props["appearance.border.color"] = "#4f46e5";
          card.bind["appearance.border.color"] = "primary";
        }
        return card;
      };
      return [
        column(
          "Pricing",
          [
            intro(c.title, c.sub),
            frame("Plans", { dir: "row", gap: 24, w: "fill", wrap: true }, [
              plan("1", c.name1, c.price1, false, ["One project", "Community support", "Basic export"]),
              plan("2", c.name2, c.price2, true, ["Unlimited projects", "Priority support", "All export targets"]),
              plan("3", c.name3, c.price3, false, ["Everything in Pro", "Shared libraries", "Roles and review"]),
            ]),
          ],
          48,
          "center",
        ),
      ];
    },
  },
  {
    id: "testimonials",
    name: "Testimonials",
    description: "Three short quotes with a name and a role.",
    place: "middle",
    band: { bg: "surface", padY: 88 },
    copy: { title: "Loved by people who ship", sub: "A few words from the people using it.", q1: "It took an afternoon to do what used to take a week.", n1: "Alex Morgan", r1: "Founder", q2: "The layout just works on every screen I tried.", n2: "Sam Rivera", r2: "Designer", q3: "I export it and hand it to the team as it is.", n3: "Jordan Lee", r3: "Developer" },
    build: (c) => {
      const quote = (n: string, q: string, name: string, role: string) =>
        frame(`Quote ${n}`, { dir: "column", gap: 20, pad: 28, w: "fill", grow: true, minWidth: 260, bg: "background", round: true, border: true }, [
          text(`Words ${n}`, `“${q}”`, { size: 18, weight: 500, w: "fill", lineHeight: 1.5 }),
          frame(`Person ${n}`, { dir: "row", gap: 12, align: "center" }, [
            frame(`Avatar ${n}`, { w: 40, h: 40, bg: "primary", round: true }),
            frame(`Who ${n}`, { dir: "column", gap: 2 }, [text(`Name ${n}`, name, { weight: 600 }), text(`Role ${n}`, role, { size: 14, color: "muted" })]),
          ]),
        ]);
      return [column("Testimonials", [intro(c.title, c.sub), frame("Quotes", { dir: "row", gap: 24, w: "fill", wrap: true }, [quote("1", c.q1, c.n1, c.r1), quote("2", c.q2, c.n2, c.r2), quote("3", c.q3, c.n3, c.r3)])], 48, "center")];
    },
  },
  {
    id: "faq",
    name: "FAQ",
    description: "A heading and four questions with their answers.",
    place: "middle",
    band: { bg: "background", padY: 88 },
    copy: { title: "Questions, answered", sub: "Can't find yours? Write to us.", q1: "How do I get started?", a1: "Pick a template, change the words, and publish.", q2: "Can I use my own colours?", a2: "Yes. Edit the brand variables and every section follows.", q3: "Does it work on phones?", a3: "Every section adapts to the width of the screen.", q4: "Can I take the code with me?", a4: "Yes. Export Next.js, Vite or plain HTML." },
    build: (c) => {
      const item = (n: string, q: string, a: string) => frame(`Item ${n}`, { dir: "column", gap: 8, w: "fill", pad: [20, 0] }, [text(`Question ${n}`, q, { size: 18, weight: 600, w: "fill" }), text(`Answer ${n}`, a, { color: "muted", w: "fill" }), ]);
      const items: TNode[] = [];
      for (const n of ["1", "2", "3", "4"]) {
        items.push(item(n, c[`q${n}`], c[`a${n}`]));
        if (n !== "4") items.push(rule(`Rule ${n}`));
      }
      return [column("FAQ", [intro(c.title, c.sub), frame("Items", { dir: "column", w: "fill", maxWidth: 760 }, items)], 40, "center")];
    },
  },
  {
    id: "cta",
    name: "Call to action",
    description: "A bold block that asks for one thing.",
    place: "middle",
    band: { bg: "background", padY: 72 },
    copy: { title: "Ready to start?", sub: "It takes a few minutes, and you can change everything later.", action: "Get started free" },
    build: (c) => [
      frame("Block", { dir: "column", gap: 20, pad: [64, 32], align: "center", w: "fill", maxWidth: MAX, bg: "primary", round: true }, [
        text("Title", c.title, { size: 40, weight: 800, color: "on-primary", align: "center", w: "fill", lineHeight: 1.15 }),
        lead("Subtitle", c.sub, "center", "on-primary"),
        button("Action", c.action, "inverse"),
      ]),
    ],
  },
  {
    id: "footer",
    name: "Footer",
    description: "Brand and a line about it, two columns of links, and the small print.",
    place: "bottom",
    band: { bg: "surface", padY: 56 },
    copy: { brand: "Brand", about: "A short line about what you make.", c1: "Product", l11: "Features", l12: "Pricing", l13: "FAQ", c2: "Company", l21: "About", l22: "Contact", l23: "Careers", legal: "© 2026 Brand. All rights reserved." },
    build: (c) => {
      const links = (n: string, title: string, items: string[]) =>
        frame(`Column ${n}`, { dir: "column", gap: 10 }, [text(`Heading ${n}`, title, { size: 14, weight: 700 }), ...items.map((l, i) => text(`Link ${n}.${i + 1}`, l, { size: 14, color: "muted" }))]);
      return [
        column(
          "Footer",
          [
            frame("Top", { dir: "row", justify: "space-between", gap: 40, w: "fill", wrap: true }, [
              frame("About", { dir: "column", gap: 10, maxWidth: 320 }, [text("Logo", c.brand, { size: 22, weight: 700 }), text("Line", c.about, { color: "muted", w: "fill" })]),
              frame("Links", { dir: "row", gap: 64, wrap: true }, [links("1", c.c1, [c.l11, c.l12, c.l13]), links("2", c.c2, [c.l21, c.l22, c.l23])]),
            ]),
            rule("Divider"),
            text("Legal", c.legal, { size: 13, color: "muted" }),
          ],
          32,
        ),
      ];
    },
  },
];

export const templateById = (id: string): SectionTemplate | undefined => SECTION_TEMPLATES.find((t) => t.id === id);
