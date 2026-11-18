"use client";
import React, { useState } from "react";
import { useStore } from "zustand";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { tryRunCommand } from "@/core/commands";
import { documentStore } from "@/core/store/documentState";
import { pageTransitionOf, sharedPairs } from "@/core/pages/pageTransitions";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Page transition (ROADMAP Phase 89). On a page (a frame): how Preview moves to it. On a layer inside a page: a
 * shared-element name; a layer with the same name on another page travels from one to the other. Commands:
 * `page.setTransition`, `layer.setSharedElement`.
 */
const TYPES = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide over" },
  { value: "push", label: "Push" },
  { value: "zoom", label: "Zoom" },
];

export const PageTransitionSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, className = "" }) => {
  const doc = useStore(documentStore, (s) => s.document);
  const [message, setMessage] = useState("");
  const layer = selectedId && !isMulti ? doc.layers[selectedId] : undefined;
  if (!layer || !selectedId) return null;
  const run = (id: string, args: Record<string, unknown>) => {
    const out = tryRunCommand(id, args);
    setMessage(out.ok ? "" : (out.message ?? "That did not work."));
  };

  if (layer.parentId === null) {
    const spec = pageTransitionOf(layer);
    return (
      <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="page-transition">
        <OptionRow label="Entering">
          <Select aria-label="How this page is entered" size="sm" width="100%" options={TYPES} value={spec.type} onChange={(type) => run("page.setTransition", { frame: selectedId, type })} />
        </OptionRow>
        {spec.type !== "none" && (
          <OptionRow label="Time">
            <NumberField size="sm" aria-label="Page transition time" value={+spec.duration.toFixed(2)} min={0.05} max={10} step={0.05} suffix="s" onChange={(duration) => run("page.setTransition", { frame: selectedId, duration })} />
          </OptionRow>
        )}
        <p className="ll:m-0 ll:text-micro ll:text-muted">How Preview moves to this page from another. Back plays it the other way.</p>
        {message && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{message}</p>}
      </div>
    );
  }

  const name = typeof layer.properties["sharedElement.id"] === "string" ? (layer.properties["sharedElement.id"] as string) : "";
  const frameOf = (id: string): string => { let c = doc.layers[id]; while (c && c.parentId !== null) c = doc.layers[c.parentId]; return c?.id ?? id; };
  const mine = frameOf(selectedId);
  const partners = name ? Object.values(doc.layers).filter((l) => l.parentId === null && l.id !== mine && sharedPairs(doc, mine, l.id).some(([k]) => k === name)) : [];
  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-section="page-transition">
      <OptionRow label="Shared name">
        <input
          aria-label="Shared element name"
          className="ll:w-full ll:rounded ll:border ll:border-default ll:bg-transparent ll:px-1.5 ll:py-1 ll:text-micro"
          placeholder="e.g. hero-image"
          defaultValue={name}
          key={`${selectedId}-${name}`}
          onBlur={(e) => e.target.value.trim() !== name && run("layer.setSharedElement", { ids: [selectedId], name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </OptionRow>
      <p className="ll:m-0 ll:text-micro ll:text-muted" role="status" aria-label="Shared element partners">
        {!name ? "Give a layer on two pages the same name and it travels between them in Preview." : partners.length ? `Also on: ${partners.map((p) => p.name).join(", ")}` : "No other page has a layer with this name yet."}
      </p>
      {message && <p role="alert" className="ll:m-0 ll:text-micro ll:text-primary">{message}</p>}
    </div>
  );
};
