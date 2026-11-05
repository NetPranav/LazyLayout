import { useMemo } from "react";
import { useLayers } from "@/core/store/useDocumentStore";
import { DEFAULT_DATA, DEFAULT_TYPE, DEFAULT_TXT, type LayerModel, type TextModel } from "./codeGenerator";

export interface CodeModels {
  data: Record<string, LayerModel>;
  type: Record<string, TextModel>;
  txt: Record<string, string>;
}

/** Layer, type and text models of the generated code, overlaid with the live document layers. */
export function useCodeModels(): CodeModels {
  const elements = useLayers();

  return useMemo<CodeModels>(() => {
    const data = { ...DEFAULT_DATA };
    const type = { ...DEFAULT_TYPE };
    const txt = { ...DEFAULT_TXT };
    if (!elements) return { data, type, txt };
    for (const [id, el] of Object.entries(elements)) {
      const shortId = id.replace(/^el_/, "");
      const p = (el.properties || {}) as Record<string, unknown>;
      if (data[shortId]) {
        const rad =
          typeof p["appearance.radius"] === "number"
            ? p["appearance.radius"]
            : typeof p["style.borderRadius"] === "number"
            ? p["style.borderRadius"]
            : data[shortId].rad;
        const op =
          typeof p["appearance.opacity"] === "number"
            ? Math.round(p["appearance.opacity"] * 100)
            : typeof p["style.opacity"] === "number"
            ? Math.round(p["style.opacity"] * 100)
            : data[shortId].op;
        const rawFill = p["appearance.background.color"] ?? p["style.fill"];
        const fill =
          typeof rawFill === "string" ? String(rawFill).replace(/^#/, "") : data[shortId].fill;

        data[shortId] = {
          ...data[shortId],
          w: typeof p["frame.width"] === "number" ? p["frame.width"] : data[shortId].w,
          h: typeof p["frame.height"] === "number" ? p["frame.height"] : data[shortId].h,
          rad,
          op,
          fill,
        };
      }
      if (type[shortId]) {
        const size =
          typeof p["typography.fontSize"] === "number"
            ? p["typography.fontSize"]
            : typeof p["text.fontSize"] === "number"
            ? p["text.fontSize"]
            : type[shortId].size;
        const rawWeight = p["typography.fontWeight"] ?? p["text.fontWeight"];
        const weight =
          typeof rawWeight === "number"
            ? rawWeight
            : typeof rawWeight === "string"
            ? parseInt(rawWeight, 10) || type[shortId].weight
            : type[shortId].weight;

        type[shortId] = {
          ...type[shortId],
          size,
          weight,
        };
      }
      if (txt[shortId]) {
        if (typeof p["content.text"] === "string") {
          txt[shortId] = p["content.text"];
        } else if (typeof p["content.label"] === "string") {
          txt[shortId] = p["content.label"];
        } else if (typeof p["text.content"] === "string") {
          txt[shortId] = p["text.content"];
        }
      }
    }
    return { data, type, txt };
  }, [elements]);
}
