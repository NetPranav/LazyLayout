/**
 * @file embedScriptAndVitals.ts
 * @module core/export/embedScriptAndVitals
 * @description Phase 198: Framework-free `<script type="module">` + `<div data-fx>`
 * embed snippet builder for Webflow, Framer, Wix, WordPress, and plain HTML,
 * checking per-family runtime size budgets (estimated), poster box reservation (`aspect-ratio`, so CLS 0),
 * and the CSP nonce. The embed runtime it loads (`embed-v1.mjs`, which would defer to LCP and pause offscreen)
 * is not built yet, and the audit says so instead of claiming those.
 */

import type { EffectDefinitionV1, EffectFamily } from "../effects/effectSdk";
import { selectVendoredModules } from "./interactiveExportRuntime";

export type EmbedPlatformKind =
  | "webflow"
  | "framer"
  | "wix"
  | "wordpress"
  | "html";

export const FAMILY_RUNTIME_BUDGET_KB: Readonly<Record<EffectFamily, number>> = {
  interaction: 20,
  background: 24,
  interactive_background: 30,
  cursor: 22,
  distortion: 28,
  micro_interaction: 24,
  glass_light_outline: 30,
  deformation_fracture: 34,
  sound_pack: 16,
};

export interface EmbedBundleAudit {
  readonly effectId: string;
  readonly family: EffectFamily;
  readonly estimatedGzipKb: number;
  readonly budgetKb: number;
  readonly withinSizeBudget: boolean;
  /**
   * 0 when the snippet reserves the poster's box with `aspect-ratio` (so nothing shifts when the effect mounts);
   * null when the effect has no usable aspect ratio. Derived from the markup, not measured in a browser.
   */
  readonly expectedCls: 0 | null;
  /** An ESTIMATE from the module count (2.5 ms + 1.8 ms per module), not a measured long task. */
  readonly maxInitTaskMs: number;
  /**
   * Whether the embed runtime waits for LCP / pauses offscreen. The snippet asks for both with data attributes, but
   * the runtime it loads (`embed-v1.mjs`) is not built by this repo yet, so nothing does either: false.
   */
  readonly waitsForLcp: boolean;
  readonly pausesOffscreen: boolean;
  /** True only when a nonce is given (the snippet has no inline script; a strict CSP needs the nonce on the tag). */
  readonly strictNonceCspCompliant: boolean;
  /** False until the embed runtime the snippet loads exists. */
  readonly runtimeBuilt: false;
}

export interface EmbedSnippetResult {
  readonly htmlSnippet: string;
  readonly audit: EmbedBundleAudit;
}

/**
 * Measure total vendored module runtime byte size + check per-family CI budget,
 * LCP deferral, offscreen pausing, CLS=0 box reservation, and nonce CSP compliance.
 */
export function auditEmbedVitals(effect: EffectDefinitionV1, options: { readonly cspNonce?: string } = {}): EmbedBundleAudit {
  const mods = selectVendoredModules(effect.requiredRuntimeModules);
  const rawBytes = mods.reduce((sum, m) => sum + m.byteLength, 0) + 420; // +420B bootstrapper
  // Conservative 0.55x minified/gzip ratio model for standalone ESM chunks
  const estimatedGzipKb = Number(((rawBytes * 0.55) / 1024).toFixed(2));
  const budgetKb = FAMILY_RUNTIME_BUDGET_KB[effect.family];
  const maxInitTaskMs = Number(
    Math.min(24, 2.5 + mods.length * 1.8).toFixed(2)
  );

  return {
    effectId: effect.id,
    family: effect.family,
    estimatedGzipKb,
    budgetKb,
    withinSizeBudget: estimatedGzipKb <= budgetKb,
    expectedCls: hasUsableAspectRatio(effect.poster.aspectRatio) ? 0 : null,
    maxInitTaskMs,
    waitsForLcp: false,
    pausesOffscreen: false,
    strictNonceCspCompliant: sanitizeNonce(options.cspNonce).length > 0,
    runtimeBuilt: false,
  };
}

function sanitizeNonce(nonce: string | undefined): string {
  return (nonce ?? "").replace(/[^a-zA-Z0-9+/=-]/g, "");
}

/** `16 / 9`, `1.5`, `4/3`: a positive ratio CSS `aspect-ratio` accepts. */
function hasUsableAspectRatio(raw: unknown): boolean {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0;
  if (typeof raw !== "string") return false;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = m[2] === undefined ? 1 : Number(m[2]);
  return a > 0 && b > 0;
}

/** Generate framework-free copy-paste `<div data-fx>` + `<script type="module">` snippet. */
export function buildFrameworkFreeEmbedSnippet(
  effect: EffectDefinitionV1,
  options: {
    readonly platform?: EmbedPlatformKind;
    readonly cspNonce?: string;
    readonly baseRuntimeUrl?: string;
  } = {}
): EmbedSnippetResult {
  const audit = auditEmbedVitals(effect, { cspNonce: options.cspNonce });
  const nonce = sanitizeNonce(options.cspNonce);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : "";
  const runtimeSrc = `${(options.baseRuntimeUrl ?? "/lazylayout-runtime").replace(/\/$/, "")}/embed-v1.mjs`;
  const platform = options.platform ?? "html";

  const container = `<div data-fx="${effect.id}" data-ll-platform="${platform}" data-ll-lcp-defer="true" data-ll-offscreen-pause="true" style="aspect-ratio:${effect.poster.aspectRatio};contain:layout;">${effect.poster.svgPreview}</div>`;
  const scriptTag = `<script type="module"${nonceAttr} src="${runtimeSrc}" defer></script>`;

  return {
    htmlSnippet: `${container}\n${scriptTag}`,
    audit,
  };
}
