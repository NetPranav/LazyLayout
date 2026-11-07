"use client";

/**
 * Beside a loading page on the canvas: the page it comes from on the left and the page it leads to on the right, drawn
 * as they are, for reference while the loading screen is designed. Each has a dropdown at its top to choose which page
 * to show (any page, the same one twice too). They cannot be clicked into or edited here; open that page to change it.
 */

import React from "react";
import { RenderLayer } from "@/core/render";
import { Select } from "@/editor/components/Select";
import { referencePages, setTransitionPage } from "@/core/pages/loadingPages";
import type { PageDefinition } from "@/core/store/projectTypes";
import type { Layer } from "@/core/document/schema";

/** The space between the loading page and each reference, in page pixels. */
export const TRANSITION_GAP = 160;

const ENGINE_CTX = { frameAtOrigin: true };

interface SideProps {
  side: "from" | "to";
  loading: PageDefinition;
  pages: Record<string, PageDefinition>;
  layers: Record<string, Layer>;
  width: number;
  height: number;
  zoom: number;
}

const Side: React.FC<SideProps> = ({ side, loading, pages, layers, width, height, zoom }) => {
  const options = referencePages(pages).map((p) => ({ value: p.id, label: p.name }));
  const chosen = loading.transition?.[side] ?? null;
  const shown = chosen && pages[chosen] ? chosen : undefined;
  const rootId = shown ? pages[shown].rootElementId : undefined;
  const left = side === "from" ? -(width + TRANSITION_GAP) : width + TRANSITION_GAP;
  return (
    <div data-testid={`transition-${side}`} style={{ position: "absolute", left, top: 0, width, height }}>
      {/* The header keeps its size however far the canvas is zoomed out, so the dropdown stays usable. */}
      <div
        style={{ position: "absolute", left: 0, bottom: "100%", marginBottom: 10 / zoom, transform: `scale(${1 / zoom})`, transformOrigin: "0 100%", display: "flex", alignItems: "center", gap: 8 }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ll:font-sans ll:text-small ll:text-muted">{side === "from" ? "From" : "To"}</span>
        <Select
          size="sm"
          width={190}
          aria-label={side === "from" ? "Page shown on the left" : "Page shown on the right"}
          title={side === "from" ? "The page this loading screen comes from. Any page works, the same one too." : "The page this loading screen leads to. Any page works, the same one too."}
          options={options}
          value={shown}
          placeholder="Choose a page"
          onChange={(id) => setTransitionPage(loading.id, side, id)}
        />
      </div>
      <div
        data-testid={`transition-${side}-page`}
        data-page-id={shown}
        style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", background: "var(--ll-board-bg)", border: "1px solid var(--ll-board-line)", boxShadow: "var(--ll-shadow-soft)" }}
      >
        {rootId && layers[rootId] ? <RenderLayer layerId={rootId} layers={layers} ctx={ENGINE_CTX} root /> : null}
      </div>
    </div>
  );
};

export const TransitionReferences: React.FC<Omit<SideProps, "side">> = (props) => (
  <>
    <Side side="from" {...props} />
    <Side side="to" {...props} />
  </>
);
