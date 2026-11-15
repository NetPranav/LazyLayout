"use client";

/**
 * Colour tools (Phase 123), for the selected layer:
 * - **Contrast** (text): the text's colour against what is behind it, as a WCAG ratio with its level and as APCA Lc.
 *   "Fix" gives it the nearest colour that passes the chosen target.
 * - **Palette** (image): the picture's main colours, saved as colour tokens.
 * - **Harmony** and **Tints & shades** (any layer with a colour), saved as colour tokens.
 */

import React, { useState } from "react";
import { invokeCommand } from "@/core/commands";
import { useLayers } from "@/core/store/useDocumentStore";
import { getDocument } from "@/core/store/documentState";
import { useAssetUrl } from "@/core/assets/useAssetUrl";
import { parseColor } from "@/core/paint/colorMath";
import { checkContrast, HARMONY_LABEL, HARMONY_RULES, hexOf, paletteFromPixels, type ContrastTarget, type HarmonyRule } from "@/core/paint/colorTools";
import { backgroundBehind, textColorOf } from "@/core/editing/colorToolOps";
import { parseFills } from "@/core/paint/paints";
import { Select } from "@/editor/components/Select";
import { Button } from "@/editor/components/Button";
import { TextField } from "@/editor/components/TextField";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const TARGETS: { value: string; label: string; target: ContrastTarget }[] = [
  { value: "aa", label: "WCAG AA (4.5:1)", target: { wcag: 4.5 } },
  { value: "aaa", label: "WCAG AAA (7:1)", target: { wcag: 7 } },
  { value: "aaLarge", label: "WCAG AA large (3:1)", target: { wcag: 3 } },
  { value: "lc60", label: "APCA Lc 60", target: { apca: 60 } },
  { value: "lc75", label: "APCA Lc 75", target: { apca: 75 } },
];

/** A layer's own colour: its text colour, first solid fill, background or shape fill. */
function colorOf(id: string): string | null {
  const l = getDocument().layers[id];
  if (!l) return null;
  const p = l.properties;
  if (l.archetype === "text") return hexOf(textColorOf(id));
  const solid = parseFills(p["paint.fills"])?.find((f) => f.type === "solid" && f.visible);
  const candidates = [solid && solid.type === "solid" ? solid.color : null, p["appearance.background.color"], p["svg.fill"]];
  for (const c of candidates) {
    const rgb = typeof c === "string" ? parseColor(c) : null;
    if (rgb && rgb.a > 0) return hexOf(rgb);
  }
  return null;
}

/** A picture's pixels, drawn small (at most 200 px across) so a palette is quick. */
async function pixelsOf(url: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const k = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const width = Math.max(1, Math.round(img.naturalWidth * k));
  const height = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

const Swatches: React.FC<{ colors: string[]; label: string }> = ({ colors, label }) => (
  <div role="list" aria-label={label} className="ll:flex ll:gap-1 ll:flex-wrap">
    {colors.map((c, i) => (
      <span key={i} role="listitem" title={c} aria-label={c} className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-border" style={{ background: c }} />
    ))}
  </div>
);

export const ColorToolsSection: React.FC<InspectorSectionProps> = ({ selectedId, className = "" }) => {
  useLayers();
  const layer = selectedId ? getDocument().layers[selectedId] : undefined;
  const [targetKey, setTargetKey] = useState("aa");
  const [rule, setRule] = useState<HarmonyRule>("complementary");
  const [name, setName] = useState("");
  const [palette, setPalette] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const src = layer?.archetype === "image" ? String(layer.properties["media.src"] ?? "") : "";
  const url = useAssetUrl(src || null);
  if (!layer || !selectedId) return null;
  const isText = layer.archetype === "text";
  const own = colorOf(selectedId);
  const target = TARGETS.find((t) => t.value === targetKey)!.target;
  const report = isText ? checkContrast(textColorOf(selectedId), backgroundBehind(selectedId), target) : null;
  const group = name.trim() || layer.name || "Colours";

  const makePalette = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const px = await pixelsOf(url);
      const colors = paletteFromPixels(px.data, px.width, px.height, 6).map((s) => hexOf(s.color));
      setPalette(colors);
      await invokeCommand("color.savePalette", { name: name.trim() || `${layer.name || "Photo"} palette`, colors });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {report && (
        <OptionGroup>
          <OptionRow label="Contrast">
            <span data-contrast-report="" className={`ll:font-mono ll:text-micro ${report.passes ? "ll:text-primary" : "ll:text-danger"}`}>
              {`${report.wcag.toFixed(2)}:1 ${report.level} · Lc ${Math.round(report.apca)}`}
            </span>
          </OptionRow>
          <OptionRow label="Target">
            <Select size="sm" aria-label="Contrast target" value={targetKey} options={TARGETS} width="100%" onChange={setTargetKey} />
          </OptionRow>
          <OptionRow label="">
            <Button size="sm" variant="secondary" disabled={report.passes} onClick={() => void invokeCommand("color.fixContrast", { ids: [selectedId], ...target })}>
              {report.passes ? "Passes" : "Fix contrast"}
            </Button>
          </OptionRow>
        </OptionGroup>
      )}
      <OptionGroup>
        <OptionRow label="Name">
          <TextField size="sm" aria-label="Colour token group" placeholder={layer.name || "Colours"} value={name} onChange={(e) => setName(e.target.value)} />
        </OptionRow>
        {layer.archetype === "image" && (
          <OptionRow label="Palette">
            <Button size="sm" variant="secondary" disabled={!url || busy} onClick={() => void makePalette()}>
              Palette from picture
            </Button>
          </OptionRow>
        )}
        {palette && <Swatches colors={palette} label="Picture palette" />}
        {own && (
          <>
            <OptionRow label="Harmony">
              <Select size="sm" aria-label="Harmony rule" value={rule} options={HARMONY_RULES.map((r) => ({ value: r, label: HARMONY_LABEL[r] }))} width="100%" onChange={(v) => setRule(v as HarmonyRule)} />
            </OptionRow>
            <OptionRow label="">
              <div className="ll:flex ll:gap-1 ll:flex-wrap">
                <Button size="sm" variant="secondary" onClick={() => void invokeCommand("color.harmony", { name: `${group} ${HARMONY_LABEL[rule].toLowerCase()}`, color: own, rule })}>
                  Save harmony
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void invokeCommand("color.scale", { name: group, color: own })}>
                  Save tints &amp; shades
                </Button>
              </div>
            </OptionRow>
          </>
        )}
      </OptionGroup>
    </div>
  );
};

