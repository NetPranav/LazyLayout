/**
 * Code generator for Code mode, ported directly from prototype P (lines 5635-6013).
 * Generates React (Next.js / Vite), Vue (Nuxt / Vite), and static HTML with
 * Tailwind, CSS modules, or inline styles, and CSS / Framer Motion / GSAP animations.
 */

export type FrameworkKey = "next" | "react" | "nuxt" | "vue" | "html";
export type StylingKey = "tw" | "mod" | "inline";
export type AnimationKey = "none" | "css" | "fm" | "gsap";

export interface CodeGeneratorState {
  fw: FrameworkKey;
  sty: StylingKey;
  anim: AnimationKey;
  ts: boolean;
  names: Record<string, string>;
  exp: Record<string, "Named" | "Default">;
  props: Record<string, Array<{ n: string; t: string }>>;
  deps: string[];
}

export interface EmittedLine {
  t: string;
  ref?: string | null;
}

export interface GeneratedFile {
  id: string;
  lines: EmittedLine[];
  rg: Record<string, [number, number]>;
  lang: "tsx" | "vue" | "html" | "css" | "json";
  text: string;
  deps: string[];
  rules: Array<{ sel: string; decls: Array<[string, string]>; ref?: string | null }>;
  kf: string[][];
  nodes: Record<string, { tag: string; node: TreeNode; at: string[] }>;
  uses: Record<string, number>;
}

export interface FileDescriptor {
  id: string;
  cat: "Components" | "Pages" | "Styles" | "Config";
  dir: string;
}

export interface DiffResult {
  m: Record<number, [number, number]>;
  first: number;
  n: number;
}

export const FRAMEWORKS: Record<FrameworkKey, { n: string; fmt: "React" | "Vue" | "HTML" }> = {
  next: { n: "Next.js", fmt: "React" },
  react: { n: "React (Vite)", fmt: "React" },
  nuxt: { n: "Nuxt", fmt: "Vue" },
  vue: { n: "Vue (Vite)", fmt: "Vue" },
  html: { n: "HTML (static)", fmt: "HTML" },
};

export const STYLINGS: Record<StylingKey, string> = {
  tw: "Tailwind",
  mod: "CSS modules",
  inline: "Inline",
};

export const ANIMATIONS: Record<AnimationKey, string> = {
  none: "None",
  css: "CSS",
  fm: "Framer Motion",
  gsap: "GSAP",
};

export const DEFAULT_CODE_STATE: CodeGeneratorState = {
  fw: "next",
  sty: "tw",
  anim: "none",
  ts: true,
  names: { hero: "Hero", features: "Features", footer: "Footer", home: "Home" },
  exp: { hero: "Named", features: "Named", footer: "Named" },
  props: {
    hero: [{ n: "title", t: "string" }, { n: "cta", t: "string" }],
    features: [{ n: "heading", t: "string" }],
    footer: [{ n: "copyright", t: "string" }],
  },
  deps: [],
};

export const FILE_OF: Record<string, string> = {
  hero: "hero",
  headline: "hero",
  subtitle: "hero",
  button: "hero",
  image: "hero",
  features: "features",
  footer: "footer",
  others: "home",
  input: "home",
  toggle: "home",
  divider: "home",
  background: "home",
  icon: "home",
  shape: "home",
  counter: "home",
  object3d: "home",
};

export function cxFmt(fw: FrameworkKey): "React" | "Vue" | "HTML" {
  return FRAMEWORKS[fw].fmt;
}

export function cxExt(state: CodeGeneratorState): string {
  const f = cxFmt(state.fw);
  return f === "React" ? (state.ts ? "tsx" : "jsx") : f === "Vue" ? "vue" : "html";
}

export function cxFiles(state: CodeGeneratorState): FileDescriptor[] {
  const L: FileDescriptor[] = [
    { id: "hero", cat: "Components", dir: "src/components" },
    { id: "features", cat: "Components", dir: "src/components" },
    { id: "footer", cat: "Components", dir: "src/components" },
  ];
  if (cxFmt(state.fw) === "React" && state.sty === "mod") {
    ["hero", "features", "footer"].forEach((i) => {
      L.push({ id: `${i}.mod`, cat: "Styles", dir: "src/components" });
    });
  }
  L.push(
    { id: "home", cat: "Pages", dir: "src/pages" },
    { id: "css", cat: "Styles", dir: "src/styles" },
    { id: "pkg", cat: "Config", dir: "" }
  );
  return L;
}

export function fValid(id: string, state: CodeGeneratorState): boolean {
  return cxFiles(state).some((f) => f.id === id);
}

export function fInfo(id: string, state: CodeGeneratorState): FileDescriptor {
  return (
    cxFiles(state).find((f) => f.id === id) || {
      id,
      cat: "Components",
      dir: "src/components",
    }
  );
}

export function fName(id: string, state: CodeGeneratorState): string {
  const b = id.replace(".mod", "");
  if (id === "css") return "globals.css";
  if (id === "pkg") return "package.json";
  if (id !== b) return `${state.names[b] || b}.module.css`;
  if (id === "home") {
    return cxFmt(state.fw) === "HTML" ? "index.html" : `${state.names.home || "Home"}.${cxExt(state)}`;
  }
  const nm = state.names[id] || id;
  return cxFmt(state.fw) === "HTML" ? `${nm.toLowerCase()}.html` : `${nm}.${cxExt(state)}`;
}

export function fPath(id: string, state: CodeGeneratorState): string {
  const i = fInfo(id, state);
  return (i.dir ? `${i.dir}/` : "") + fName(id, state);
}

export function fLang(id: string, state: CodeGeneratorState): "tsx" | "vue" | "html" | "css" | "json" {
  const n = fName(id, state);
  if (/\.(tsx|jsx)$/.test(n)) return "tsx";
  if (/\.vue$/.test(n)) return "vue";
  if (/\.html$/.test(n)) return "html";
  if (/\.css$/.test(n)) return "css";
  return "json";
}

export function fIcon(id: string, state: CodeGeneratorState): string {
  const l = fLang(id, state);
  return l === "css" ? "fcss" : l === "json" ? "fjson" : l === "vue" ? "fvue" : l === "html" ? "fhtml" : "ftsx";
}

export function fCompKind(id: string): boolean {
  return id === "hero" || id === "features" || id === "footer";
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, a) => a.toUpperCase());
}

function tw1(v: string | number): string {
  return String(v).replace(/ /g, "_");
}

const TWK: Record<string, string> = {
  "display:flex": "flex",
  "display:grid": "grid",
  "display:inline-flex": "inline-flex",
  "position:relative": "relative",
  "flex-direction:column": "flex-col",
  "align-items:center": "items-center",
  "justify-content:space-between": "justify-between",
  "justify-content:center": "justify-center",
  "object-fit:cover": "object-cover",
  "overflow:hidden": "overflow-hidden",
  "margin:0": "m-0",
  "font-weight:400": "font-normal",
  "font-weight:500": "font-medium",
  "font-weight:600": "font-semibold",
  "font-weight:700": "font-bold",
  "text-align:center": "text-center",
  "list-style:none": "list-none",
  "cursor:pointer": "cursor-pointer",
};

const TWP: Record<string, string> = {
  width: "w",
  height: "h",
  "min-width": "min-w",
  "max-width": "max-w",
  gap: "gap",
  "font-size": "text",
  "line-height": "leading",
  "letter-spacing": "tracking",
  "border-radius": "rounded",
  background: "bg",
  color: "text",
  opacity: "opacity",
  "grid-template-columns": "grid-cols",
  "font-family": "font",
};

function twTok(p: [string, string]): string {
  const k = `${p[0]}:${p[1]}`;
  const pre = TWP[p[0]];
  if (TWK[k]) return TWK[k];
  if (p[0] === "padding") {
    const m = String(p[1]).split(" ");
    if (m.length === 2) return `${m[0] === "0" ? "" : `py-[${m[0]}] `}px-[${m[1]}]`;
    return `p-[${tw1(p[1])}]`;
  }
  if (p[0] === "font-family") return `font-[${String(p[1]).replace(/"/g, "").replace(/ /g, "_")}]`;
  if (p[0] === "grid-template-columns") return `grid-cols-[${tw1(p[1])}]`;
  return pre ? `${pre}-[${tw1(p[1])}]` : `[${p[0]}:${tw1(p[1])}]`;
}

function styObj(st: Array<[string, string]>, react: boolean): string {
  return `{ ${st
    .map((p) => {
      const v = p[1];
      const n =
        /^-?\d+(\.\d+)?px$/.test(v) && react
          ? parseFloat(v)
          : /^-?\d+(\.\d+)?$/.test(String(v))
          ? react
            ? +v
            : `'${v}'`
          : null;
      return `${camel(p[0])}: ${n != null ? n : react ? `"${v}"` : `'${v}'`}`;
    })
    .join(", ")} }`;
}

export interface TreeNode {
  tag: string;
  ref?: string;
  cls?: string;
  st?: Array<[string, string]>;
  kids?: TreeNode[];
  x?: string;
  bind?: string;
  at?: Array<[string, string]>;
  img?: boolean;
  void?: boolean;
  comp?: string;
}

function N(tag: string, o?: Partial<TreeNode>, kids?: TreeNode[]): TreeNode {
  const node: TreeNode = { tag, kids: kids || [], ...o };
  return node;
}

// Elements dataset representation
export interface LayerModel {
  w: number;
  h: number;
  rad: number;
  fill: string;
  op: number;
}

export interface TextModel {
  font: string;
  size: number;
  weight: number;
  lineHeight: number;
  letterSpacing: number;
}

export const DEFAULT_DATA: Record<string, LayerModel> = {
  hero: { w: 800, h: 420, rad: 0, fill: "2C2C2C", op: 100 },
  headline: { w: 420, h: 80, rad: 0, fill: "FFFFFF", op: 100 },
  subtitle: { w: 420, h: 48, rad: 0, fill: "BFBFBF", op: 100 },
  button: { w: 140, h: 40, rad: 6, fill: "FFFFFF", op: 100 },
  image: { w: 340, h: 340, rad: 8, fill: "383838", op: 100 },
  features: { w: 800, h: 360, rad: 0, fill: "242424", op: 100 },
  footer: { w: 800, h: 80, rad: 0, fill: "1E1E1E", op: 100 },
  others: { w: 800, h: 100, rad: 0, fill: "2C2C2C", op: 100 },
  input: { w: 220, h: 36, rad: 6, fill: "383838", op: 100 },
  toggle: { w: 48, h: 26, rad: 13, fill: "383838", op: 100 },
  divider: { w: 80, h: 1, rad: 0, fill: "444444", op: 100 },
  icon: { w: 24, h: 24, rad: 0, fill: "BFBFBF", op: 100 },
  shape: { w: 48, h: 48, rad: 0, fill: "BFBFBF", op: 100 },
  counter: { w: 80, h: 32, rad: 0, fill: "FFFFFF", op: 100 },
  object3d: { w: 64, h: 64, rad: 6, fill: "383838", op: 100 },
};

export const DEFAULT_TYPE: Record<string, TextModel> = {
  headline: { font: "Geist", size: 36, weight: 700, lineHeight: 1.15, letterSpacing: -0.02 },
  subtitle: { font: "Geist", size: 16, weight: 400, lineHeight: 1.5, letterSpacing: 0 },
  button: { font: "Geist", size: 13, weight: 500, lineHeight: 1, letterSpacing: 0 },
  counter: { font: "Geist Mono", size: 14, weight: 600, lineHeight: 1.2, letterSpacing: 0 },
};

export const DEFAULT_TXT: Record<string, string> = {
  headline: "Design it once. Ship it lazily.",
  subtitle: "Build modern web apps visually. Clean code, zero lock-in, effortless motion.",
  button: "Get started",
};

const hex = (h: string) => `#${h}`;

function typo(id: string, data = DEFAULT_DATA, type = DEFAULT_TYPE): Array<[string, string]> {
  const T = type[id] || { font: "Geist", size: 14, weight: 400, lineHeight: 1.4, letterSpacing: 0 };
  const D = data[id] || { fill: "FFFFFF", op: 100, w: 100, h: 20, rad: 0 };
  const s: Array<[string, string]> = [];
  if (T.font && T.font !== "Geist") s.push(["font-family", `"${T.font}"`]);
  s.push(["font-size", `${T.size}px`], ["font-weight", String(T.weight)], ["line-height", String(T.lineHeight)]);
  if (T.letterSpacing) s.push(["letter-spacing", `${T.letterSpacing}em`]);
  s.push(["color", `#${D.fill}`]);
  if (D.op < 100) s.push(["opacity", String(D.op / 100)]);
  return s;
}

function box(id: string, extra: Array<[string, string]>, noFill?: boolean, data = DEFAULT_DATA): Array<[string, string]> {
  const D = data[id] || { fill: "383838", op: 100, rad: 0, w: 100, h: 40 };
  const s = extra.slice();
  if (!noFill) s.push(["background", `#${D.fill}`]);
  if (D.rad) s.push(["border-radius", `${D.rad}px`]);
  if (D.op < 100) s.push(["opacity", String(D.op / 100)]);
  return s;
}

function heroTree(data = DEFAULT_DATA, type = DEFAULT_TYPE, txt = DEFAULT_TXT): TreeNode[] {
  const H = data.hero;
  const B = data.button;
  const I = data.image;
  return [
    N(
      "section",
      {
        ref: "hero",
        cls: "hero",
        st: box(
          "hero",
          [
            ["display", "flex"],
            ["align-items", "center"],
            ["justify-content", "space-between"],
            ["gap", "32px"],
            ["width", `${H.w}px`],
            ["height", `${H.h}px`],
            ["padding", "0 36px"],
          ],
          false,
          data
        ),
      },
      [
        N("div", { cls: "copy", st: [["display", "flex"], ["flex-direction", "column"], ["gap", "12px"]] }, [
          N("h1", { ref: "headline", cls: "headline", st: typo("headline", data, type), x: txt.headline, bind: "title" }),
          N("p", { ref: "subtitle", cls: "subtitle", st: typo("subtitle", data, type), x: txt.subtitle }),
          N(
            "a",
            {
              ref: "button",
              cls: "cta",
              st: box(
                "button",
                [
                  ["display", "inline-flex"],
                  ["align-items", "center"],
                  ["justify-content", "center"],
                  ["min-width", `${B.w}px`],
                  ["height", `${B.h}px`],
                  ["padding", "0 16px"],
                  ["color", hex("1E1E1E")],
                  ["font-size", `${(type.button || DEFAULT_TYPE.button).size}px`],
                  ["font-weight", String((type.button || DEFAULT_TYPE.button).weight)],
                ],
                false,
                data
              ),
              x: txt.button,
              bind: "cta",
              at: [["href", "#start"]],
            }
          ),
        ]),
        N("img", {
          ref: "image",
          cls: "image",
          st: box("image", [["width", `${I.w}px`], ["height", `${I.h}px`], ["object-fit", "cover"]], false, data),
          img: true,
          void: true,
          at: [["alt", "Hero image"]],
        }),
      ]
    ),
  ];
}

function featuresTree(data = DEFAULT_DATA): TreeNode[] {
  const F = data.features;
  const card: Array<[string, string]> = [
    ["display", "flex"],
    ["flex-direction", "column"],
    ["gap", "8px"],
    ["padding", "24px"],
    ["border-radius", "8px"],
    ["background", "rgb(255 255 255 / 0.04)"],
  ];
  const C = [
    ["Visual editing", "Drag, resize and style on the canvas."],
    ["Clean code", "Readable components that you own."],
    ["Ship anywhere", "Export a repo or deploy in one click."],
  ];
  return [
    N(
      "section",
      {
        ref: "features",
        cls: "features",
        st: [
          ["display", "grid"],
          ["gap", "32px"],
          ["padding", "64px 36px"],
          ["background", `#${F.fill}`],
        ],
      },
      [
        N("h2", {
          cls: "heading",
          st: [
            ["font-size", "24px"],
            ["font-weight", "600"],
            ["color", hex("FFFFFF")],
          ],
          x: "Everything you need",
          bind: "heading",
        }),
        N(
          "div",
          {
            cls: "cards",
            st: [
              ["display", "grid"],
              ["grid-template-columns", "repeat(3, 1fr)"],
              ["gap", "16px"],
            ],
          },
          C.map((c) =>
            N("article", { cls: "card", st: card }, [
              N("h3", { cls: "cardTitle", st: [["font-size", "15px"], ["font-weight", "500"], ["color", hex("FFFFFF")]], x: c[0] }),
              N("p", { cls: "cardText", st: [["font-size", "13px"], ["color", hex("BFBFBF")]], x: c[1] }),
            ])
          )
        ),
      ]
    ),
  ];
}

function footerTree(data = DEFAULT_DATA): TreeNode[] {
  const F = data.footer;
  const lk: Array<[string, string]> = [
    ["font-size", "12px"],
    ["color", hex("BFBFBF")],
  ];
  return [
    N(
      "footer",
      {
        ref: "footer",
        cls: "footer",
        st: [
          ["display", "flex"],
          ["align-items", "center"],
          ["justify-content", "space-between"],
          ["height", `${F.h}px`],
          ["padding", "0 36px"],
          ["background", `#${F.fill}`],
        ],
      },
      [
        N("p", { cls: "copy", st: lk, x: "© 2026 Lazy Layout", bind: "copyright" }),
        N(
          "nav",
          { cls: "links", st: [["display", "flex"], ["gap", "16px"]] },
          [
            ["Docs", "#docs"],
            ["Pricing", "#pricing"],
            ["Contact", "#contact"],
          ].map((l) => N("a", { cls: "link", st: lk, x: l[0], at: [["href", l[1]]] }))
        ),
      ]
    ),
  ];
}

function homeTree(state: CodeGeneratorState, data = DEFAULT_DATA): TreeNode[] {
  const I = data.input;
  const T = data.toggle;
  const D = data.divider;
  const S = data.shape;
  const O = data.object3d;
  const G = data.icon;
  function comp(n: string) {
    return N(state.names[n] || n, { comp: n, void: true });
  }
  return [
    N("main", { cls: "page", st: [["display", "flex"], ["flex-direction", "column"], ["min-height", "100vh"]] }, [
      comp("hero"),
      comp("features"),
      comp("footer"),
      N(
        "section",
        { ref: "others", cls: "extras", st: [["display", "flex"], ["align-items", "center"], ["gap", "24px"], ["padding", "36px"]] },
        [
          N("input", {
            ref: "input",
            cls: "email",
            st: box("input", [["width", `${I.w}px`], ["height", `${I.h}px`], ["padding", "0 12px"]], false, data),
            void: true,
            at: [["type", "email"], ["placeholder", "you@example.com"]],
          }),
          N("button", {
            ref: "toggle",
            cls: "switch",
            st: box("toggle", [["width", `${T.w}px`], ["height", `${T.h}px`]], false, data),
            void: false,
            at: [["type", "button"], ["role", "switch"], ["aria-checked", "true"]],
          }),
          N("hr", {
            ref: "divider",
            cls: "rule",
            st: box("divider", [["width", `${D.w}px`], ["height", `${D.h}px`], ["border", "0"]], false, data),
            void: true,
          }),
          N(
            "svg",
            {
              ref: "icon",
              cls: "icon",
              st: [["width", `${G.w}px`], ["height", `${G.h}px`], ["color", `#${G.fill}`]],
              at: [["viewBox", "0 0 24 24"], ["aria-hidden", "true"]],
            },
            [
              N("path", {
                void: true,
                at: [["d", "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z"]],
              }),
            ]
          ),
          N(
            "svg",
            {
              ref: "shape",
              cls: "star",
              st: [["width", `${S.w}px`], ["height", `${S.h}px`]],
              at: [["viewBox", "0 0 48 48"], ["fill", `#${S.fill}`]],
            },
            [
              N("polygon", {
                void: true,
                at: [["points", "24,2 30,17 46,18 34,29 38,45 24,36 10,45 14,29 2,18 18,17"]],
              }),
            ]
          ),
          N("output", { ref: "counter", cls: "counter", st: typo("counter", data), x: "1,280+" }),
          N("canvas", {
            ref: "object3d",
            cls: "model",
            st: box("object3d", [["width", `${O.w}px`], ["height", `${O.h}px`]], false, data),
            at: [["data-model", "scene.glb"]],
          }),
        ]
      ),
    ]),
  ];
}

// Animation helpers
export interface AnimDescriptor {
  ref: string;
  delay: number;
  dur: number;
  from: Record<string, number>;
  to: Record<string, number>;
  ease: string;
}

const DEFAULT_ANIMS: Record<string, AnimDescriptor> = {
  headline: {
    ref: "headline",
    delay: 0,
    dur: 0.8,
    from: { opacity: 0, y: 20 },
    to: { opacity: 100, y: 0 },
    ease: "Ease out",
  },
  subtitle: {
    ref: "subtitle",
    delay: 0.1,
    dur: 0.8,
    from: { opacity: 0, y: 16 },
    to: { opacity: 100, y: 0 },
    ease: "Ease out",
  },
  button: {
    ref: "button",
    delay: 0.2,
    dur: 0.6,
    from: { opacity: 0, scale: 92 },
    to: { opacity: 100, scale: 100 },
    ease: "Back out",
  },
  image: {
    ref: "image",
    delay: 0.15,
    dur: 1.0,
    from: { opacity: 0, scale: 95 },
    to: { opacity: 100, scale: 100 },
    ease: "Ease out",
  },
};

function animOf(ref: string, state: CodeGeneratorState, force = false): AnimDescriptor | null {
  if (state.anim === "none" && !force) return null;
  return DEFAULT_ANIMS[ref] || null;
}

function av(p: string, v: number): number {
  return p === "opacity" || p === "scale" ? +(v / 100).toFixed(2) : v;
}

function aObj(o: Record<string, number>): string {
  const AKEY: Record<string, string> = { opacity: "opacity", x: "x", y: "y", scale: "scale", rot: "rotate" };
  const PORD = ["opacity", "x", "y", "scale", "rot"];
  return `{ ${PORD.filter((p) => o[p] != null)
    .map((p) => `${AKEY[p]}: ${av(p, o[p])}`)
    .join(", ")} }`;
}

function aEase(a: AnimDescriptor): string {
  if (a.ease === "Spring") return `{ type: "spring", duration: ${a.dur} }`;
  return `{ duration: ${a.dur}${a.delay ? `, delay: ${a.delay}` : ""}, ease: [0.16, 1, 0.3, 1] }`;
}

function gEase(a: AnimDescriptor): string {
  const map: Record<string, string> = {
    Linear: "none",
    "Ease in": "power2.in",
    "Ease out": "power2.out",
    "Ease in out": "power2.inOut",
    "Back out": "back.out(1.7)",
    Anticipate: "back.in(1.7)",
  };
  return map[a.ease] || "power3.out";
}

function aCssVal(a: AnimDescriptor): string {
  return `ll-${a.ref} ${a.dur}s cubic-bezier(0.16, 1, 0.3, 1) ${a.delay}s both`;
}

function aKf(a: AnimDescriptor): string[] {
  function blk(o: Record<string, number>): string[] {
    const d: string[] = [];
    if (o.opacity != null) d.push(`opacity: ${av("opacity", o.opacity)};`);
    if (o.x != null || o.y != null) d.push(`translate: ${o.x ? `${o.x}px` : "0"} ${o.y ? `${o.y}px` : "0"};`);
    if (o.scale != null) d.push(`scale: ${av("scale", o.scale)};`);
    if (o.rot != null) d.push(`rotate: ${o.rot}deg;`);
    return d;
  }
  return [
    `@keyframes ll-${a.ref} {`,
    "  from {",
    ...blk(a.from).map((s) => `    ${s}`),
    "  }",
    "  to {",
    ...blk(a.to).map((s) => `    ${s}`),
    "  }",
    "}",
  ];
}

const RM_CSS = [
  "@media (prefers-reduced-motion: reduce) {",
  "  * { animation: none !important; }",
  "}",
];

interface Context {
  id: string;
  f: "React" | "Vue" | "HTML";
  lines: EmittedLine[];
  rg: Record<string, [number, number]>;
  rs: Array<string | null>;
  rules: Array<{ sel: string; decls: Array<[string, string]>; ref?: string | null }>;
  kf: string[][];
  uses: Record<string, number>;
  defs: Record<string, string>;
  nodes: Record<string, { tag: string; node: TreeNode; at: string[] }>;
  root: TreeNode | null;
}

function propOf(state: CodeGeneratorState, id: string, n: string) {
  return (state.props[id] || []).find((p) => p.n === n);
}

function cxTag(n: TreeNode, c: Context, state: CodeGeneratorState): string {
  if (n.comp && c.f === "HTML") return "div";
  if (n.img && c.f === "React" && state.fw === "next" && state.anim !== "fm") {
    c.uses.Image = 1;
    return "Image";
  }
  if (n.ref && c.f === "React" && state.anim === "fm" && animOf(n.ref, state) && /^[a-z]/.test(n.tag)) {
    c.uses.motion = 1;
    return `motion.${n.tag}`;
  }
  return n.tag;
}

function cxAttrs(n: TreeNode, c: Context, state: CodeGeneratorState, data: Record<string, LayerModel>): string[] {
  const f = c.f;
  const a: string[] = [];
  const st = (n.st || []).slice();
  const an = n.ref ? animOf(n.ref, state) : null;
  let cl: string[] = [];

  function A(name: string, v: string) {
    a.push(`${name}="${v}"`);
  }

  if (c.root === n && state.anim === "gsap") a.push(f === "React" ? "ref={root}" : 'ref="root"');

  if (an && state.anim === "css") {
    if (state.sty === "tw") {
      cl.push(`animate-${n.ref}`, "motion-reduce:animate-none");
      if (f !== "React") {
        c.rules.push({ sel: `.animate-${n.ref}`, decls: [["animation", aCssVal(an)]], ref: n.ref });
        c.kf.push(aKf(an));
      }
    } else {
      st.push(["animation", aCssVal(an)]);
      c.kf.push(aKf(an));
    }
  }

  if (st.length) {
    if (state.sty === "tw") {
      cl = st.map(twTok).concat(cl);
      a.push(f === "React" ? `className="${cl.join(" ")}"` : `class="${cl.join(" ")}"`);
    } else if (state.sty === "mod" && n.cls) {
      c.rules.push({ sel: `.${f === "React" ? n.cls : kebab(n.cls)}`, decls: st, ref: n.ref || c.rs[c.rs.length - 1] });
      a.push(f === "React" ? `className={styles.${n.cls}}` : `class="${kebab(n.cls)}"`);
    } else if (state.sty === "inline") {
      if (f === "React") a.push(`style={${styObj(st, true)}}`);
      else if (f === "Vue") a.push(`:style="${styObj(st, false)}"`);
      else a.push(`style="${st.map((p) => `${p[0]}: ${p[1]}`).join("; ")}"`);
    }
  }

  if (n.comp && f === "HTML") {
    a.push(`data-include="components/${(state.names[n.comp] || n.comp).toLowerCase()}.html"`);
  }

  if (n.img) {
    a.push('src="/hero.jpg"');
  }

  (n.at || []).forEach((p) => {
    A(p[0], p[1]);
  });

  if (n.img) {
    const imgData = data.image || DEFAULT_DATA.image;
    if (f === "React") a.push(`width={${imgData.w}}`, `height={${imgData.h}}`);
    else a.push(`width="${imgData.w}"`, `height="${imgData.h}"`);
  }

  if (an && state.anim === "gsap") a.push(`data-anim="${n.ref}"`);
  if (an && state.anim === "fm" && f === "React") {
    a.push(`initial={${aObj(an.from)}}`, `animate={${aObj(an.to)}}`, `transition={${aEase(an)}}`);
  }

  return a;
}

function cxText(n: TreeNode, c: Context, state: CodeGeneratorState): string | undefined {
  if (n.bind && propOf(state, c.id, n.bind)) {
    c.defs[n.bind] = n.x || "";
    return c.f === "React" ? `{${n.bind}}` : c.f === "Vue" ? `{{ ${n.bind} }}` : n.x;
  }
  return n.x;
}

function cxTagLines(pad: string, tg: string, at: string[], self: boolean, f: string): string[] {
  const one = `${pad}<${tg}${at.length ? ` ${at.join(" ")}` : ""}${self ? (f === "HTML" ? ">" : " />") : ">"}`;
  if (one.length <= 96 && at.length <= 3) return [one];
  return [`${pad}<${tg}`, ...at.map((s) => `${pad}  ${s}`), `${pad}${self ? (f === "HTML" ? ">" : "/>") : ">"}`];
}

function cxEmit(n: TreeNode, c: Context, ind: number, state: CodeGeneratorState, data: Record<string, LayerModel>) {
  const pad = new Array(ind + 1).join("  ");
  const tg = cxTag(n, c, state);
  const at = cxAttrs(n, c, state, data);
  const kids = n.kids || [];
  const tx = n.x != null ? cxText(n, c, state) : null;
  const start = c.lines.length;
  const ref = n.ref || (c.rs.length ? c.rs[c.rs.length - 1] : null);
  const self = !!n.void;

  c.rs.push(ref);
  function put(t: string) {
    c.lines.push({ t, ref });
  }

  if (n.ref) c.nodes[n.ref] = { tag: tg, node: n, at };

  const o = cxTagLines(pad, tg, at, self, c.f);
  if (self) {
    o.forEach(put);
  } else if (tx != null && !kids.length) {
    if (o.length === 1 && (o[0] + tx + `</${tg}>`).length <= 110) {
      put(o[0] + tx + `</${tg}>`);
    } else {
      o.forEach(put);
      put(`${pad}  ${tx}`);
      put(`${pad}</${tg}>`);
    }
  } else {
    o.forEach(put);
    kids.forEach((k) => cxEmit(k, c, ind + 1, state, data));
    put(`${pad}</${tg}>`);
  }
  c.rs.pop();
  if (n.ref) c.rg[n.ref] = [start, c.lines.length - 1];
}

function cxCtx(id: string, state: CodeGeneratorState): Context {
  return {
    id,
    f: cxFmt(state.fw),
    lines: [],
    rg: {},
    rs: [],
    rules: [],
    kf: [],
    uses: {},
    defs: {},
    nodes: {},
    root: null,
  };
}

function cxBody(id: string, ind: number, state: CodeGeneratorState, data = DEFAULT_DATA, type = DEFAULT_TYPE, txt = DEFAULT_TXT): Context {
  const c = cxCtx(id, state);
  const treeMap: Record<string, () => TreeNode[]> = {
    hero: () => heroTree(data, type, txt),
    features: () => featuresTree(data),
    footer: () => footerTree(data),
    home: () => homeTree(state, data),
  };
  const tree = (treeMap[id] || treeMap.hero)();
  c.root = tree[0];
  tree.forEach((n) => cxEmit(n, c, ind, state, data));
  return c;
}

class OutBuilder {
  L: EmittedLine[] = [];
  rg: Record<string, [number, number]> = {};
  deps: string[] = [];

  put(t: string, ref?: string | null) {
    this.L.push({ t, ref: ref || null });
  }

  raw(a: string[]) {
    a.forEach((t) => this.L.push({ t, ref: null }));
  }

  body(c: Context) {
    const o = this.L.length;
    c.lines.forEach((l) => this.L.push(l));
    Object.keys(c.rg).forEach((k) => {
      this.rg[k] = [c.rg[k][0] + o, c.rg[k][1] + o];
    });
  }

  n() {
    return this.L.length;
  }
}

function putCss(o: OutBuilder, rules: Array<{ sel: string; decls: Array<[string, string]>; ref?: string | null }>, kf: string[][], ind: string) {
  let first = true;
  rules.forEach((r) => {
    const a = o.n();
    if (!first) o.put("");
    first = false;
    o.put(`${ind}${r.sel} {`, r.ref);
    r.decls.forEach((d) => o.put(`${ind}  ${d[0]}: ${d[1]};`, r.ref));
    o.put(`${ind}}`, r.ref);
    if (r.ref && !o.rg[r.ref]) o.rg[r.ref] = [a, o.n() - 1];
  });
  if (kf.length) {
    kf.forEach((k) => {
      if (!first) o.put("");
      first = false;
      k.forEach((s) => o.put(s ? ind + s : s));
    });
    o.put("");
    RM_CSS.forEach((s) => o.put(ind + s));
  }
}

function ptype(t: string, f: string): string {
  return t === "node" ? (f === "Vue" ? "VNode" : "ReactNode") : t;
}

function genReact(id: string, c: Context, o: OutBuilder, state: CodeGeneratorState) {
  const nm = state.names[id] || id;
  const P = state.props[id] || [];
  const ts = state.ts;
  const nx = state.fw === "next";
  const an = state.anim;
  const imp: string[] = [];
  const ex = state.exp[id] === "Default";
  const needNode = P.some((p) => p.t === "node");

  if (nx && (an === "fm" || an === "gsap")) {
    o.put('"use client";');
    o.put("");
  }
  if (an === "gsap") imp.push('import { useEffect, useRef } from "react";', 'import gsap from "gsap";');
  if (an === "fm") imp.push('import { motion, MotionConfig } from "framer-motion";');
  if (ts && needNode) imp.push('import type { ReactNode } from "react";');
  if (c.uses.Image) imp.push('import Image from "next/image";');
  if (state.sty === "mod") imp.push(`import styles from "./${nm}.module.css";`);

  imp.forEach((s) => o.put(s));
  if (imp.length) o.put("");

  if (ts && P.length) {
    o.put(`type ${nm}Props = {`);
    P.forEach((p) => o.put(`  ${p.n}?: ${ptype(p.t, "React")};`));
    o.put("};");
    o.put("");
  }

  const par = P.length
    ? `{ ${P.map((p) => p.n + (c.defs[p.n] != null ? ` = ${JSON.stringify(c.defs[p.n])}` : "")).join(", ")} }${
        ts ? `: ${nm}Props` : ""
      }`
    : "";
  o.put(`export ${ex ? "default " : ""}function ${nm}(${par}) {`);

  if (an === "gsap") {
    o.put(`  const root = useRef${ts ? "<HTMLElement>" : ""}(null);`);
    o.put("");
    o.put("  useEffect(() => {");
    o.put("    const mm = gsap.matchMedia(root);");
    o.put('    mm.add("(prefers-reduced-motion: no-preference)", () => {');
    const PORD = ["opacity", "x", "y", "scale", "rot"];
    const AKEY: Record<string, string> = { opacity: "opacity", x: "x", y: "y", scale: "scale", rot: "rotate" };
    Object.keys(c.nodes).forEach((r) => {
      const a = animOf(r, state);
      if (a) {
        o.put(
          `      gsap.from("[data-anim=${r}]", { ${PORD.filter((p) => a.from[p] != null)
            .map((p) => `${AKEY[p]}: ${av(p, a.from[p])}`)
            .join(", ")}, duration: ${a.dur}, delay: ${a.delay}, ease: "${gEase(a)}" });`,
          r
        );
      }
    });
    o.put("    });");
    o.put("    return () => mm.revert();");
    o.put("  }, []);");
    o.put("");
  }

  o.put("  return (");
  if (an === "fm") o.put('    <MotionConfig reducedMotion="user">');
  o.body(c);
  if (an === "fm") o.put("    </MotionConfig>");
  o.put("  );");
  o.put("}");
}

function genVue(id: string, c: Context, o: OutBuilder, state: CodeGeneratorState) {
  const P = state.props[id] || [];
  const ts = state.ts;
  const an = state.anim;
  let imp: string[] = [];

  imp.push(an === "gsap" ? 'import { onMounted, onBeforeUnmount, ref } from "vue";' : "");
  if (an === "gsap") imp.push('import gsap from "gsap";');
  imp = imp.filter(Boolean);

  o.put(`<script setup${ts ? ' lang="ts"' : ""}>`);
  imp.forEach((s) => o.put(s));
  if (imp.length) o.put("");

  if (P.length) {
    if (ts) {
      const dfs = P.filter((p) => c.defs[p.n] != null);
      const ty = `defineProps<{ ${P.map((p) => `${p.n}?: ${ptype(p.t, "Vue")}`).join("; ")} }>()`;
      o.put(
        dfs.length
          ? `withDefaults(${ty}, { ${dfs.map((p) => `${p.n}: ${JSON.stringify(c.defs[p.n])}`).join(", ")} });`
          : `${ty};`
      );
    } else {
      const typeMap: Record<string, string> = { string: "String", number: "Number", boolean: "Boolean", node: "Object" };
      o.put(
        `defineProps({ ${P.map(
          (p) =>
            `${p.n}: { type: ${typeMap[p.t] || "String"}${
              c.defs[p.n] != null ? `, default: ${JSON.stringify(c.defs[p.n])}` : ""
            } }`
        ).join(", ")} });`
      );
    }
  }

  if (an === "gsap") {
    if (P.length) o.put("");
    o.put(`const root = ref${ts ? "<HTMLElement | null>" : ""}(null);`);
    o.put(`let mm${ts ? ": gsap.MatchMedia | undefined" : ""};`);
    o.put("");
    o.put("onMounted(() => {");
    o.put("  mm = gsap.matchMedia(root.value);");
    o.put('  mm.add("(prefers-reduced-motion: no-preference)", () => {');
    const PORD = ["opacity", "x", "y", "scale", "rot"];
    const AKEY: Record<string, string> = { opacity: "opacity", x: "x", y: "y", scale: "scale", rot: "rotate" };
    Object.keys(c.nodes).forEach((r) => {
      const a = animOf(r, state);
      if (a) {
        o.put(
          `    gsap.from("[data-anim=${r}]", { ${PORD.filter((p) => a.from[p] != null)
            .map((p) => `${AKEY[p]}: ${av(p, a.from[p])}`)
            .join(", ")}, duration: ${a.dur}, delay: ${a.delay}, ease: "${gEase(a)}" });`,
          r
        );
      }
    });
    o.put("  });");
    o.put("});");
    o.put("onBeforeUnmount(() => mm?.revert());");
  }

  o.put("</script>");
  o.put("");
  o.put("<template>");
  o.body(c);
  o.put("</template>");

  if (c.rules.length || c.kf.length) {
    o.put("");
    o.put("<style scoped>");
    putCss(o, c.rules, c.kf, "");
    o.put("</style>");
  }
}

function genHtml(id: string, c: Context, o: OutBuilder, state: CodeGeneratorState) {
  const an = state.anim;
  o.put(`<!-- ${state.names[id] || id} -->`);
  o.body(c);
  if (c.rules.length || c.kf.length) {
    o.put("");
    o.put("<style>");
    putCss(o, c.rules, c.kf, "  ");
    o.put("</style>");
  }
  if (an === "gsap") {
    o.put("");
    o.put('<script type="module">');
    o.put('  import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm";');
    o.put("");
    o.put("  const mm = gsap.matchMedia();");
    o.put('  mm.add("(prefers-reduced-motion: no-preference)", () => {');
    const PORD = ["opacity", "x", "y", "scale", "rot"];
    const AKEY: Record<string, string> = { opacity: "opacity", x: "x", y: "y", scale: "scale", rot: "rotate" };
    Object.keys(c.nodes).forEach((r) => {
      const a = animOf(r, state);
      if (a) {
        o.put(
          `    gsap.from("[data-anim=${r}]", { ${PORD.filter((p) => a.from[p] != null)
            .map((p) => `${AKEY[p]}: ${av(p, a.from[p])}`)
            .join(", ")}, duration: ${a.dur}, delay: ${a.delay}, ease: "${gEase(a)}" });`,
          r
        );
      }
    });
    o.put("  });");
    o.put("</script>");
  }
}

function genHome(c: Context, o: OutBuilder, state: CodeGeneratorState) {
  const f = c.f;
  const ts = state.ts;
  if (f === "React") {
    ["hero", "features", "footer"].forEach((i) => {
      const nm = state.names[i] || i;
      o.put(
        state.exp[i] === "Default"
          ? `import ${nm} from "../components/${nm}";`
          : `import { ${nm} } from "../components/${nm}";`
      );
    });
    o.put("");
    o.put(`export default function ${state.names.home || "Home"}() {`);
    o.put("  return (");
    o.body(c);
    o.put("  );");
    o.put("}");
  } else if (f === "Vue") {
    o.put(`<script setup${ts ? ' lang="ts"' : ""}>`);
    ["hero", "features", "footer"].forEach((i) => {
      const nm = state.names[i] || i;
      o.put(`import ${nm} from "../components/${nm}.vue";`);
    });
    o.put("</script>");
    o.put("");
    o.put("<template>");
    o.body(c);
    o.put("</template>");
  } else {
    o.put("<!doctype html>");
    o.put('<html lang="en">');
    o.put("  <head>");
    o.put('    <meta charset="utf-8" />');
    o.put('    <meta name="viewport" content="width=device-width, initial-scale=1" />');
    o.put("    <title>MyProject</title>");
    o.put('    <link rel="stylesheet" href="../styles/globals.css" />');
    o.put("  </head>");
    o.put("  <body>");
    o.body(c);
    o.put("  </body>");
    o.put("</html>");
  }
}

function genCssFile(state: CodeGeneratorState): OutBuilder {
  const o = new OutBuilder();
  const f = cxFmt(state.fw);
  const hk = ["headline", "subtitle", "button", "image"];
  const an = state.anim === "css" && f === "React" && state.sty !== "mod";
  const scale = [
    ["sm", 0.8],
    ["base", 1],
    ["lg", 1.25],
    ["xl", 1.563],
    ["2xl", 1.953],
    ["3xl", 2.441],
  ];
  const tw = state.sty === "tw";

  if (tw) {
    o.put('@import "tailwindcss";');
    o.put("");
    o.put("@theme {");
    o.put(`  --color-primary: ${hex("6C5CE7")};`);
    o.put(`  --color-surface: ${hex("F4F3EF")};`);
    o.put(`  --color-ink: ${hex("22231E")};`);
    o.put('  --font-sans: "Geist", system-ui, sans-serif;');
    o.put("  --radius-base: 8px;");
    scale.forEach((s) => o.put(`  --text-${s[0]}: ${s[1]}rem;`));
    o.put("  --shadow-soft: 0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.06);");
    if (an) {
      hk.forEach((r) => {
        const a = animOf(r, state);
        if (a) {
          o.put("");
          o.put(`  --animate-${r}: ${aCssVal(a)};`);
          aKf(a).forEach((s) => o.put(`  ${s}`));
        }
      });
    }
    o.put("}");
    o.put("");
    o.put("@layer base {");
    o.put("  body {");
    o.put("    font-family: var(--font-sans);");
    o.put("    background: var(--color-surface);");
    o.put("    color: var(--color-ink);");
    o.put("  }");
    o.put("}");
  } else {
    o.put("/* Design tokens from the theme */");
    o.put(":root {");
    o.put(`  --color-primary: ${hex("6C5CE7")};`);
    o.put(`  --color-surface: ${hex("F4F3EF")};`);
    o.put(`  --color-ink: ${hex("22231E")};`);
    o.put('  --font-sans: "Geist", system-ui, sans-serif;');
    o.put("  --radius-base: 8px;");
    scale.forEach((s) => o.put(`  --text-${s[0]}: ${s[1]}rem;`));
    o.put("  --shadow-soft: 0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.06);");
    o.put("}");
    o.put("");
    o.put("*, *::before, *::after {");
    o.put("  box-sizing: border-box;");
    o.put("}");
    o.put("");
    o.put("body {");
    o.put("  margin: 0;");
    o.put("  font-family: var(--font-sans);");
    o.put("  background: var(--color-surface);");
    o.put("  color: var(--color-ink);");
    o.put("}");
    if (an) {
      hk.forEach((r) => {
        const a = animOf(r, state);
        if (a) {
          o.put("");
          o.raw(aKf(a));
        }
      });
      o.put("");
      o.raw(RM_CSS);
    }
  }
  return o;
}

function genPkg(state: CodeGeneratorState): OutBuilder {
  const f = state.fw;
  const d: Record<string, string> = {};
  const dv: Record<string, string> = {};
  let sc: Record<string, string>;
  const tw = state.sty === "tw";
  const o = new OutBuilder();

  if (f === "next") {
    d.next = "^16.0.0";
    d.react = "^19.0.0";
    d["react-dom"] = "^19.0.0";
    sc = { dev: "next dev", build: "next build", start: "next start" };
  } else if (f === "react") {
    d.react = "^19.0.0";
    d["react-dom"] = "^19.0.0";
    dv.vite = "^7.0.0";
    dv["@vitejs/plugin-react"] = "^5.0.0";
    sc = { dev: "vite", build: "vite build", preview: "vite preview" };
  } else if (f === "nuxt") {
    d.nuxt = "^4.0.0";
    d.vue = "^3.5.0";
    sc = { dev: "nuxt dev", build: "nuxt build", preview: "nuxt preview" };
  } else if (f === "vue") {
    d.vue = "^3.5.0";
    dv.vite = "^7.0.0";
    dv["@vitejs/plugin-vue"] = "^6.0.0";
    sc = { dev: "vite", build: "vite build", preview: "vite preview" };
  } else {
    dv.vite = "^7.0.0";
    sc = { dev: "vite", build: "vite build", preview: "vite preview" };
  }

  if (tw) {
    dv.tailwindcss = "^4.1.0";
    dv[f === "next" ? "@tailwindcss/postcss" : "@tailwindcss/vite"] = "^4.1.0";
  }
  if (state.anim === "fm") d["framer-motion"] = "^12.0.0";
  if (state.anim === "gsap") d.gsap = "^3.13.0";
  if (state.ts) {
    dv.typescript = "^5.9.0";
    if (cxFmt(state.fw) === "React") {
      dv["@types/react"] = "^19.0.0";
      dv["@types/react-dom"] = "^19.0.0";
    }
    if (f === "vue") dv["vue-tsc"] = "^3.0.0";
  }

  state.deps.forEach((n) => {
    d[n] = "latest";
  });

  function sorted(x: Record<string, string>): Record<string, string> {
    const r: Record<string, string> = {};
    Object.keys(x)
      .sort()
      .forEach((k) => {
        r[k] = x[k];
      });
    return r;
  }

  const obj = {
    name: "my-project",
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: sc,
    dependencies: sorted(d),
    devDependencies: Object.keys(dv).length ? sorted(dv) : undefined,
  };

  JSON.stringify(obj, null, 2)
    .split("\n")
    .forEach((s) => o.put(s));
  o.deps = Object.keys(d);
  return o;
}

export function cxGen(
  id: string,
  state: CodeGeneratorState,
  data: Record<string, LayerModel> = DEFAULT_DATA,
  type: Record<string, TextModel> = DEFAULT_TYPE,
  txt: Record<string, string> = DEFAULT_TXT
): GeneratedFile {
  let o = new OutBuilder();
  let c: Context | null = null;

  if (id === "pkg") {
    o = genPkg(state);
  } else if (id === "css") {
    o = genCssFile(state);
  } else if (id.slice(-4) === ".mod") {
    const b = cxGen(id.replace(".mod", ""), state, data, type, txt);
    putCss(o, b.rules, b.kf, "");
  } else {
    const f = cxFmt(state.fw);
    const ind = id === "home" ? (f === "Vue" ? 1 : 2) : f === "React" ? (state.anim === "fm" ? 3 : 2) : f === "Vue" ? 1 : 0;
    c = cxBody(id, ind, state, data, type, txt);
    if (id === "home") genHome(c, o, state);
    else if (f === "React") genReact(id, c, o, state);
    else if (f === "Vue") genVue(id, c, o, state);
    else genHtml(id, c, o, state);
  }

  const text = o.L.map((l) => l.t).join("\n");
  return {
    id,
    lines: o.L,
    rg: o.rg,
    lang: fLang(id, state),
    text,
    deps: o.deps,
    rules: c ? c.rules : [],
    kf: c ? c.kf : [],
    nodes: c ? c.nodes : {},
    uses: c ? c.uses : {},
  };
}

export function cxSize(state: CodeGeneratorState): number {
  return cxFiles(state).reduce((acc, f) => acc + new Blob([cxGen(f.id, state).text]).size, 0);
}

export function cxKB(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export function cxDiff(oldLines: string[], newLines: string[]): DiffResult {
  let p = 0;
  let q = 0;
  const m: Record<number, [number, number]> = {};
  let first = -1;
  let cnt = 0;

  while (p < oldLines.length && p < newLines.length && oldLines[p] === newLines[p]) p++;
  while (q < oldLines.length - p && q < newLines.length - p && oldLines[oldLines.length - 1 - q] === newLines[newLines.length - 1 - q]) q++;

  for (let i = p; i < newLines.length - q; i++) {
    const a = newLines[i];
    const b = i < oldLines.length - q ? oldLines[i] : "";
    let x = 0;
    let y = 0;
    cnt++;
    while (x < a.length && x < b.length && a[x] === b[x]) x++;
    while (y < a.length - x && y < b.length - x && a[a.length - 1 - y] === b[b.length - 1 - y]) y++;
    let s = x;
    let e = a.length - y;
    while (s > 0 && /[\w#.%-]/.test(a[s - 1])) s--;
    while (e < a.length && /[\w#.%-]/.test(a[e])) e++;
    if (e <= s) {
      s = Math.max(0, a.search(/\S/));
      e = a.length;
    }
    m[i] = [s, e];
    if (first < 0) first = i;
  }
  return { m, first, n: cnt };
}
