/**
 * Static export v1 (ROADMAP Phase 49): a document as a site. `buildSiteExport` draws every page with the stage's render
 * definitions at every breakpoint and mode, turns the result into classes and responsive CSS, and lays files out for
 * plain HTML, Vite + React or Next.js (App Router), with one stylesheet, CSS Modules or Tailwind utilities.
 */

import type { MotionDocument } from "../../document/schema";
import { buildPlan, type SitePlan, type Styling } from "./plan";
import { writeTarget, type AssetBytes, type SiteFile, type Target } from "./targets";
import { cssText } from "./css";
import { toHtml, toJsx } from "./serialize";
import { buildDriversExport } from "../runtime/drivers";
import { hasLinks } from "../../links/linkModel";
import { hasExpressions } from "../../expressions/exprModel";

export type { SiteFile, Styling, Target, SitePlan };
export { buildPlan, exportedPages } from "./plan";

export interface SiteExportOptions {
  target: Target;
  styling: Styling;
  projectName?: string;
  /** The bytes of an imported file by its id; null when it is missing. */
  readAsset?: (id: string) => Promise<AssetBytes | null>;
  /** The project's loading pages (see `PlanOptions.loading`). Only the Next.js target writes them, as `loading.tsx`. */
  loading?: { rootId: string; toRootId: string | null }[];
}

export interface SiteExport {
  files: SiteFile[];
  warnings: string[];
  pages: { route: string; title: string }[];
}

export async function buildSiteExport(doc: MotionDocument, options: SiteExportOptions): Promise<SiteExport> {
  const styling: Styling = options.target === "html" ? "css" : options.styling;
  const plan = buildPlan(doc, { styling: options.styling, hrefs: options.target === "html" ? "files" : "routes", components: options.target !== "html", loading: options.loading });
  const assets = new Map<string, AssetBytes>();
  const warnings = [...plan.warnings];
  if (options.target !== "next" && (options.loading?.length ?? 0) > 0) warnings.push("Loading pages are written for the Next.js target only (as loading.tsx); this export leaves them out.");
  const loadingRoutes = plan.pages.filter((p) => p.kind === "loading").map((p) => p.route);
  const twice = loadingRoutes.filter((r, i) => loadingRoutes.indexOf(r) !== i);
  if (twice.length > 0) warnings.push(`More than one loading page leads to ${[...new Set(twice)].join(", ")}; only the last is written.`);
  if (options.target === "html" && options.styling !== "css") warnings.push("Plain HTML is written with one stylesheet; Tailwind and CSS Modules are for the React targets.");
  for (const id of plan.assets) {
    const bytes = options.readAsset ? await options.readAsset(id) : null;
    if (bytes) assets.set(id, bytes);
    else warnings.push(`A picture or font (${id.slice(0, 8)}) is missing from this browser's asset store and was left out.`);
  }
  const files = writeTarget(options.target, {
    plan: { ...plan, warnings },
    styling,
    projectName: options.projectName ?? "LazyLayout site",
    entries: doc.assets ?? {},
    assets,
  });
  // Links (Phase 76) and expressions (Phase 77) move layers at run time, and the static export has no runtime for them yet: say so.
  const linked = Object.values(doc.layers).filter((l) => hasLinks(l.properties) || hasExpressions(l.properties));
  if (linked.length > 0) warnings.push(`${linked.length === 1 ? "A layer has" : `${linked.length} layers have`} property links or expressions (${linked.slice(0, 3).map((l) => l.name).join(", ")}${linked.length > 3 ? ", ..." : ""}), which are not exported yet: the page keeps ${linked.length === 1 ? "it" : "them"} as designed.`);
  // Drivers (Design track D4): a standalone script for the plain HTML target, with only the operators the project uses.
  const drivers = buildDriversExport(doc);
  warnings.push(...drivers.warnings);
  if (drivers.source) {
    if (options.target === "html") {
      files.push({ path: "lazylayout-drivers.js", content: drivers.source });
      for (const f of files) {
        if (!f.path.endsWith("index.html") || typeof f.content !== "string") continue;
        const up = f.path === "index.html" ? "" : "../".repeat(f.path.split("/").length - 1);
        f.content = f.content.replace("</body>", `    <script src="${up}lazylayout-drivers.js" defer></script>\n  </body>`);
      }
    } else {
      warnings.push("Drivers are exported for the plain HTML target only; this target ships the page without them.");
    }
  }
  return { files, warnings, pages: plan.pages.filter((p) => p.kind !== "loading").map((p) => ({ route: p.route, title: p.title })) };
}

/** The files as text, for a viewer (binary files are named, not shown). */
export const textOf = (f: SiteFile): string => (typeof f.content === "string" ? f.content : `(${f.content.byteLength} bytes)`);

/** What the Code tab shows for a layer: its markup as HTML and as JSX, and its CSS (base rules, narrower breakpoints, other modes). */
export interface LayerCode {
  html: string;
  jsx: string;
  css: string;
  tailwind: string;
  warnings: string[];
}

export function exportLayerCode(doc: MotionDocument, layerId: string): LayerCode | null {
  if (!doc.layers[layerId]) return null;
  const plain = buildPlan(doc, { styling: "css", hrefs: "routes", only: layerId });
  const tw = buildPlan(doc, { styling: "tailwind", hrefs: "routes", only: layerId });
  const page = plain.pages[0];
  if (!page) return null;
  const strip = (t: string) => t.replace(/\{\{asset:([0-9a-f]{64})\}\}/g, (_m, id: string) => `assets/${id.slice(0, 12)}`);
  return {
    html: strip(toHtml(page.tree)),
    jsx: strip(toJsx(page.tree, { classExpr: (c) => `"${c}"`, classValue: (c) => `"${c}"` }, "  ")),
    css: strip(cssText(page.blocks)),
    tailwind: strip(toJsx(tw.pages[0].tree, { classExpr: (c) => `"${c}"`, classValue: (c) => `"${c}"` }, "  ")),
    warnings: plain.warnings,
  };
}
