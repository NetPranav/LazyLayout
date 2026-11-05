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
        data[shortId] = {
          ...data[shortId],
          w: typeof p["frame.width"] === "number" ? p["frame.width"] : data[shortId].w,
          h: typeof p["frame.height"] === "number" ? p["frame.height"] : data[shortId].h,
          rad: typeof p["style.borderRadius"] === "number" ? p["style.borderRadius"] : data[shortId].rad,
          op: typeof p["style.opacity"] === "number" ? Math.round(p["style.opacity"] * 100) : data[shortId].op,
          fill: typeof p["style.fill"] === "string" ? String(p["style.fill"]).replace(/^#/, "") : data[shortId].fill,
        };
      }
      if (type[shortId]) {
        type[shortId] = {
          ...type[shortId],
          size: typeof p["text.fontSize"] === "number" ? p["text.fontSize"] : type[shortId].size,
          weight: typeof p["text.fontWeight"] === "number" ? p["text.fontWeight"] : type[shortId].weight,
        };
      }
      if (txt[shortId] && typeof p["text.content"] === "string") {
        txt[shortId] = p["text.content"];
      }
    }
    return { data, type, txt };
  }, [elements]);
}
