/**
 * The Effects rows and the document:
 * - a layer's shadows and glows (`paint.shadows`; a glow is a shadow with no offset, Phase 121);
 * - its layer and background blurs: plain (`filter.blur`, `paint.backgroundBlur`), or progressive (in the effect list,
 *   `paint.effects`);
 * - its grain (a mono noise in the effect list).
 * They are read as the rows the inspector shows, and a row list is written back. Effects the rows don't show (texture,
 * glass, other noises) are kept as they are. Hidden blurs are not stored (a blur of 0 draws nothing), so the section
 * keeps their amount for as long as it is open.
 */
import { shadowsOf, setShadows, setBlur } from "@/core/paint/paintOps";
import { fromHex, parseCss, toCss, toHex, color as makeColor } from "@/core/paint/color";
import { DEFAULT_SHADOW, type Shadow } from "@/core/paint/paints";
import { blurOf, parseEffects, serializeEffects, type Effect } from "@/core/paint/effects";
import { DEFAULT_GLOW, directionOf, grainIn, withGrain, withProgressiveBlur } from "@/core/paint/effectsII";
import { getDocument } from "@/core/store/documentState";
import { setLayerProps, transaction } from "@/core/editing/editOps";
import type { EffectItem } from "../types";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const hexOf = (css: string): string => {
  const c = parseCss(css);
  return c ? toHex(c).replace(/^#/, "").slice(0, 6).toUpperCase() : "000000";
};

const BLANK = { hex: "000000", x: 0, y: 0, blur: 0, spread: 0 };

/** A blur row: progressive from the effect list, else the plain property. */
function blurItem(effects: readonly Effect[], kind: "layerBlur" | "backgroundBlur", plain: number): EffectItem | null {
  const type = kind === "layerBlur" ? "layer-blur" : "background-blur";
  const b = blurOf(effects, kind);
  if (b && b.blurType === "progressive") return { id: type, type, ...BLANK, amount: b.radius, progressive: true, startAmount: b.startRadius, direction: directionOf(b.start, b.end) };
  if (b && b.radius > 0) return { id: type, type, ...BLANK, amount: b.radius };
  return plain > 0 ? { id: type, type, ...BLANK, amount: plain } : null;
}

/** The rows for one layer: shadows and glows first (in order), then layer blur, background blur and grain. */
export function effectItemsOf(id: string | null | undefined): EffectItem[] {
  if (!id) return [];
  const layer = getDocument().layers[id];
  if (!layer) return [];
  const items: EffectItem[] = shadowsOf(id).map((s, i) => ({
    id: `shadow-${i}`,
    type: s.glow ? (s.kind === "inner" ? "inner-glow" : "outer-glow") : s.kind === "inner" ? "inner-shadow" : "drop-shadow",
    hex: hexOf(s.color),
    x: s.x,
    y: s.y,
    blur: s.blur,
    spread: s.spread,
    amount: 0,
    hidden: !s.visible,
  }));
  const effects = parseEffects(layer.properties["paint.effects"]);
  const lb = blurItem(effects, "layerBlur", num(layer.properties["filter.blur"]));
  const bb = blurItem(effects, "backgroundBlur", num(layer.properties["paint.backgroundBlur"]));
  if (lb) items.push(lb);
  if (bb) items.push(bb);
  const grain = grainIn(effects);
  const noise = effects.find((e) => e.type === "noise" && e.mode === "mono");
  if (grain) items.push({ id: "grain", type: "grain", ...BLANK, amount: Math.round(grain.amount * 100), size: grain.size, hidden: noise ? !noise.visible : false });
  return items;
}

/** The alpha of a stored shadow colour, kept when only its hex is edited. */
function alphaAt(id: string, index: number): number {
  return parseCss(shadowsOf(id)[index]?.color ?? "")?.a ?? 0.25;
}

const isShadowRow = (t: EffectItem["type"]) => t === "drop-shadow" || t === "inner-shadow" || t === "outer-glow" || t === "inner-glow";

/** Writes the rows back for these layers as one undo step. `parked` holds amounts of hidden blurs. */
export function writeEffectItems(ids: readonly string[], items: readonly EffectItem[], primary: string): void {
  const shadows: Shadow[] = [];
  let layerBlur: EffectItem | null = null;
  let backBlur: EffectItem | null = null;
  let grain: EffectItem | null = null;
  items.forEach((e) => {
    if (isShadowRow(e.type)) {
      const glow = e.type === "outer-glow" || e.type === "inner-glow";
      const index = Number(e.id.replace("shadow-", ""));
      const base = fromHex(`#${e.hex}`) ?? makeColor(0, 0, 0, 1);
      const fresh = parseCss((glow ? DEFAULT_GLOW : DEFAULT_SHADOW).color)?.a ?? 0.25;
      const a = Number.isInteger(index) ? alphaAt(primary, index) : fresh;
      shadows.push({
        kind: e.type === "inner-shadow" || e.type === "inner-glow" ? "inner" : "drop",
        x: glow ? 0 : e.x,
        y: glow ? 0 : e.y,
        blur: Math.max(0, e.blur),
        spread: e.spread,
        color: toCss({ ...base, a }),
        visible: !e.hidden,
        ...(glow ? { glow: true } : {}),
      });
    } else if (e.type === "grain") grain = e;
    else if (!e.hidden) {
      if (e.type === "layer-blur") layerBlur = e;
      else backBlur = e;
    }
  });
  const plain = (b: EffectItem | null) => (b && !b.progressive ? Math.max(0, b.amount) : 0);
  transaction("Effects", () => {
    setShadows(ids, shadows);
    setBlur(ids, { layer: plain(layerBlur), background: plain(backBlur) });
    for (const id of ids) {
      const layer = getDocument().layers[id];
      if (!layer) continue;
      let effects = parseEffects(layer.properties["paint.effects"]);
      const ramp = (b: EffectItem | null) => (b && b.progressive ? { radius: Math.max(0, b.amount), startRadius: Math.max(0, b.startAmount ?? 0), direction: b.direction ?? "up" } : null);
      effects = withProgressiveBlur(effects, "layerBlur", ramp(layerBlur));
      effects = withProgressiveBlur(effects, "backgroundBlur", ramp(backBlur));
      const g = grain as EffectItem | null;
      effects = withGrain(effects, g ? { size: g.size ?? 0.5, amount: Math.max(0, Math.min(100, g.amount)) / 100 } : null);
      if (g?.hidden) effects = effects.map((e) => (e.type === "noise" && e.mode === "mono" ? { ...e, visible: false } : e));
      const json = serializeEffects(effects);
      if (json !== (layer.properties["paint.effects"] ?? "")) setLayerProps([id], { "paint.effects": json || null }, "Effects");
    }
  });
}
