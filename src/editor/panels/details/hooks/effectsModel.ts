/**
 * The Effects rows and the document: a layer's shadows (`paint.shadows`), its layer blur (`filter.blur`) and its
 * background blur (`paint.backgroundBlur`) read as the rows the inspector shows, and a row list written back.
 * Hidden blurs are not stored (a blur of 0 draws nothing), so the section keeps their amount for as long as it is open.
 */
import { shadowsOf, setShadows, setBlur } from "@/core/paint/paintOps";
import { fromHex, parseCss, toCss, toHex, color as makeColor } from "@/core/paint/color";
import { DEFAULT_SHADOW, type Shadow } from "@/core/paint/paints";
import { getDocument } from "@/core/store/documentState";
import { transaction } from "@/core/editing/editOps";
import type { EffectItem } from "../types";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const hexOf = (css: string): string => {
  const c = parseCss(css);
  return c ? toHex(c).replace(/^#/, "").slice(0, 6).toUpperCase() : "000000";
};

/** The rows for one layer: shadows first (in order), then layer blur, then background blur. */
export function effectItemsOf(id: string | null | undefined): EffectItem[] {
  if (!id) return [];
  const layer = getDocument().layers[id];
  if (!layer) return [];
  const items: EffectItem[] = shadowsOf(id).map((s, i) => ({
    id: `shadow-${i}`,
    type: s.kind === "inner" ? "inner-shadow" : "drop-shadow",
    hex: hexOf(s.color),
    x: s.x,
    y: s.y,
    blur: s.blur,
    spread: s.spread,
    amount: 0,
    hidden: !s.visible,
  }));
  const layerBlur = num(layer.properties["filter.blur"]);
  const backBlur = num(layer.properties["paint.backgroundBlur"]);
  if (layerBlur > 0) items.push({ id: "layer-blur", type: "layer-blur", hex: "000000", x: 0, y: 0, blur: 0, spread: 0, amount: layerBlur });
  if (backBlur > 0) items.push({ id: "background-blur", type: "background-blur", hex: "000000", x: 0, y: 0, blur: 0, spread: 0, amount: backBlur });
  return items;
}

/** The alpha of a stored shadow colour, kept when only its hex is edited. */
function alphaAt(id: string, index: number): number {
  return parseCss(shadowsOf(id)[index]?.color ?? "")?.a ?? 0.25;
}

/** Writes the rows back for these layers as one undo step. `parked` holds amounts of hidden blurs. */
export function writeEffectItems(ids: readonly string[], items: readonly EffectItem[], primary: string): void {
  const shadows: Shadow[] = [];
  let layerBlur = 0;
  let backBlur = 0;
  items.forEach((e) => {
    if (e.type === "drop-shadow" || e.type === "inner-shadow") {
      const index = Number(e.id.replace("shadow-", ""));
      const base = fromHex(`#${e.hex}`) ?? makeColor(0, 0, 0, 1);
      const a = Number.isInteger(index) ? alphaAt(primary, index) : (parseCss(DEFAULT_SHADOW.color)?.a ?? 0.25);
      shadows.push({
        kind: e.type === "inner-shadow" ? "inner" : "drop",
        x: e.x,
        y: e.y,
        blur: Math.max(0, e.blur),
        spread: e.spread,
        color: toCss({ ...base, a }),
        visible: !e.hidden,
      });
    } else if (!e.hidden) {
      if (e.type === "layer-blur") layerBlur = Math.max(0, e.amount);
      else backBlur = Math.max(0, e.amount);
    }
  });
  transaction("Effects", () => {
    setShadows(ids, shadows);
    setBlur(ids, { layer: layerBlur, background: backBlur });
  });
}
