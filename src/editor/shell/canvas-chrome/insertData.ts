/**
 * Insert catalog items ported from prototype (DOCS/UI/design/editor-design-mode-blocks-dark.html, lines 1283-1290).
 * Wireframes are defined by space-separated "left,top,width,height" percentage rects.
 */

export const WIREFRAMES: Record<string, string> = {
  frame: "10,10,80,80",
  text: "10,20,80,8 10,34,70,8 10,48,76,8",
  button: "30,40,40,20",
  image: "10,12,80,76 20,62,20,14",
  divider: "6,48,88,2",
  input: "14,28,30,6 14,40,72,20",
  navbar: "6,8,88,12 8,11,14,6 58,11,8,6 70,11,8,6 82,11,10,6",
  card: "12,12,76,44 12,62,50,6 12,72,34,5",
  modal: "20,18,60,64 26,28,48,6 26,40,40,5 56,70,18,8",
  tabs: "6,10,24,10 32,10,24,10 6,26,88,64",
  accordion: "6,12,88,14 6,30,88,14 6,48,88,14 6,66,88,14",
  form: "18,12,64,12 18,30,64,12 18,48,64,12 60,66,22,14",
  toggle: "10,38,80,24 54,42,16,16",
  icon: "30,30,40,40",
  counter: "20,34,60,32",
  bg: "6,6,88,88 12,12,30,6",
  o3d: "20,30,40,40 38,18,40,40",
  hs: "8,20,44,10 8,36,40,5 8,46,40,5 8,60,20,10 58,18,34,64",
  hc: "28,26,44,12 22,44,56,5 30,54,40,5 38,66,24,10",
  hi: "6,6,88,88 10,60,46,10 10,74,22,8",
  pt: "6,8,88,12 6,24,88,8 6,36,88,8 6,48,88,8 6,60,88,8 6,72,88,8",
  pc: "6,14,27,72 37,8,27,82 68,14,27,72",
  cmp: "6,8,30,10 42,8,20,10 66,8,28,10 6,24,30,6 42,24,20,6 66,24,28,6 6,36,30,6 42,36,20,6 66,36,28,6",
  fs: "6,70,88,2 6,80,30,6 66,80,28,6",
  fl: "6,62,18,30 30,62,18,30 54,62,18,30 78,62,16,30",
  fb: "6,50,88,44 10,58,20,6 10,68,20,6 34,58,20,6 34,68,20,6 62,58,20,6 62,68,20,6",
};

export interface InsertItem {
  name: string;
  wireframe?: string;
  kind?: "a" | "f"; // 'a' = asset, 'f' = font
}

export interface InsertGroup {
  groupName: string;
  items: InsertItem[];
}

export const INSERT_CATALOG: Record<string, InsertGroup[]> = {
  Basics: [
    {
      groupName: "",
      items: [
        { name: "Frame", wireframe: WIREFRAMES.frame },
        { name: "Text", wireframe: WIREFRAMES.text },
        { name: "Button", wireframe: WIREFRAMES.button },
        { name: "Image", wireframe: WIREFRAMES.image },
        { name: "Divider", wireframe: WIREFRAMES.divider },
        { name: "Input", wireframe: WIREFRAMES.input },
        { name: "Toggle", wireframe: WIREFRAMES.toggle },
        { name: "Icon", wireframe: WIREFRAMES.icon },
        { name: "Counter", wireframe: WIREFRAMES.counter },
        { name: "Background", wireframe: WIREFRAMES.bg },
        { name: "3D object", wireframe: WIREFRAMES.o3d },
      ],
    },
  ],
  Sections: [
    {
      groupName: "Hero",
      items: [
        { name: "Hero split", wireframe: WIREFRAMES.hs },
        { name: "Hero centered", wireframe: WIREFRAMES.hc },
        { name: "Hero image", wireframe: WIREFRAMES.hi },
      ],
    },
    {
      groupName: "Pricing",
      items: [
        { name: "Pricing table", wireframe: WIREFRAMES.pt },
        { name: "Pricing cards", wireframe: WIREFRAMES.pc },
        { name: "Comparison", wireframe: WIREFRAMES.cmp },
      ],
    },
    {
      groupName: "Footer",
      items: [
        { name: "Footer simple", wireframe: WIREFRAMES.fs },
        { name: "Footer links", wireframe: WIREFRAMES.fl },
        { name: "Footer large", wireframe: WIREFRAMES.fb },
      ],
    },
  ],
  Components: [
    {
      groupName: "",
      items: [
        { name: "Navbar", wireframe: WIREFRAMES.navbar },
        { name: "Card", wireframe: WIREFRAMES.card },
        { name: "Modal", wireframe: WIREFRAMES.modal },
        { name: "Tabs", wireframe: WIREFRAMES.tabs },
        { name: "Accordion", wireframe: WIREFRAMES.accordion },
        { name: "Form", wireframe: WIREFRAMES.form },
      ],
    },
  ],
  Assets: [
    {
      groupName: "",
      items: [
        { name: "logo.svg", kind: "a" },
        { name: "hero.jpg", kind: "a" },
        { name: "icons.svg", kind: "a" },
      ],
    },
  ],
  Fonts: [
    {
      groupName: "",
      items: [
        { name: "Geist", kind: "f" },
        { name: "Inter", kind: "f" },
        { name: "Playfair Display", kind: "f" },
      ],
    },
  ],
  Recent: [
    {
      groupName: "",
      items: [
        { name: "Hero split", wireframe: WIREFRAMES.hs },
        { name: "Pricing cards", wireframe: WIREFRAMES.pc },
        { name: "Navbar", wireframe: WIREFRAMES.navbar },
      ],
    },
  ],
};
