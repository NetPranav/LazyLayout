"use client";

import React, { useState } from "react";
import { Link2, ExternalLink, ArrowRight, Trash2 } from "lucide-react";
import { invokeCommand } from "@/core/commands";
import { pagesOf, anchorOf, resolveLink, type LinkKind } from "@/core/pages/pages";
import { useLayers } from "@/core/store/useDocumentStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";

export interface LinkSectionProps {
  selectedId?: string | null;
  className?: string;
}

const LINK_KIND_OPTIONS = [
  { value: "none", label: "None" },
  { value: "page", label: "Page" },
  { value: "anchor", label: "Section Anchor" },
  { value: "url", label: "External Web URL" },
];

export const LinkSection: React.FC<LinkSectionProps> = ({
  selectedId: propSelectedId,
  className = "",
}) => {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectedId = propSelectedId ?? selectedIds[0] ?? null;
  const layers = useLayers();
  const doc = useDocument((d) => d);

  const [customUrl, setCustomUrl] = useState("");

  if (!selectedId || !layers[selectedId]) {
    return (
      <div className={`ll:p-3 ll:text-micro ll:text-muted ll:text-center ${className}`}>
        Select a layer to configure links
      </div>
    );
  }

  const layer = layers[selectedId];
  const link = layer.link;
  const currentKind: string = link ? link.kind : "none";

  const pages = pagesOf(doc);
  const sections = pages.flatMap((p) =>
    Object.values(doc.layers)
      .filter((l) => l.section && l.parentId === p.id)
      .map((s) => ({ s, page: p }))
  );

  const handleKindChange = (kind: string) => {
    if (kind === "none") {
      void invokeCommand("link.clear", { ids: [layer.id] });
      return;
    }
    if (kind === "page" && pages.length > 0) {
      void invokeCommand("link.set", { kind: "page", target: pages[0].id, ids: [layer.id] });
    } else if (kind === "anchor" && sections.length > 0) {
      void invokeCommand("link.set", { kind: "anchor", target: sections[0].s.id, ids: [layer.id] });
    } else if (kind === "url") {
      void invokeCommand("link.set", { kind: "url", target: customUrl || "https://", ids: [layer.id] });
    }
  };

  const handlePageSelect = (pageId: string) => {
    void invokeCommand("link.set", { kind: "page", target: pageId, ids: [layer.id] });
  };

  const handleAnchorSelect = (sectionId: string) => {
    void invokeCommand("link.set", { kind: "anchor", target: sectionId, ids: [layer.id] });
  };

  const handleUrlSubmit = () => {
    if (!customUrl.trim()) return;
    void invokeCommand("link.set", { kind: "url", target: customUrl.trim(), ids: [layer.id] });
  };

  const handleTestLink = () => {
    if (!link) return;
    if (link.kind === "url" && typeof window !== "undefined") {
      window.open(link.target, "_blank", "noopener,noreferrer");
    } else if (link.kind === "page") {
      void invokeCommand("page.switch", { id: link.target });
    } else if (link.kind === "anchor") {
      void invokeCommand("frame.focus", { frameId: link.target, camera: true });
    }
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2.5 ll:p-3 ll:rounded-md ll:border ll:border-line-subtle ll:bg-surface-panel/40 ${className}`}>
      {/* Header */}
      <div className="ll:flex ll:items-center ll:justify-between">
        <span className="ll:flex ll:items-center ll:gap-1.5 ll:text-small ll:font-medium ll:text-primary">
          <Icon icon={Link2} size={14} className="ll:text-accent-foreground" />
          <span>Interactive Link</span>
        </span>
        {link && (
          <button
            type="button"
            aria-label="Remove link"
            title="Remove link"
            onClick={() => void invokeCommand("link.clear", { ids: [layer.id] })}
            className="ll:p-1 ll:rounded ll:text-muted ll:hover:text-danger ll:transition-colors ll:cursor-pointer"
          >
            <Icon icon={Trash2} size={12} />
          </button>
        )}
      </div>

      {/* Target Type Selector */}
      <Select
        size="sm"
        label="Link To"
        value={currentKind}
        options={LINK_KIND_OPTIONS}
        onChange={handleKindChange}
      />

      {/* Page Target */}
      {currentKind === "page" && (
        <div className="ll:flex ll:flex-col ll:gap-1">
          <Select
            size="sm"
            label="Destination Page"
            value={link?.target ?? pages[0]?.id ?? ""}
            options={pages.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.route})`,
            }))}
            onChange={handlePageSelect}
          />
        </div>
      )}

      {/* Anchor Target */}
      {currentKind === "anchor" && (
        <div className="ll:flex ll:flex-col ll:gap-1">
          <Select
            size="sm"
            label="Section Anchor"
            value={link?.target ?? sections[0]?.s.id ?? ""}
            options={
              sections.length > 0
                ? sections.map(({ s, page }) => ({
                    value: s.id,
                    label: `${page.route}#${anchorOf(s)}`,
                  }))
                : [{ value: "", label: "No sections defined yet" }]
            }
            onChange={handleAnchorSelect}
          />
        </div>
      )}

      {/* External URL Target */}
      {currentKind === "url" && (
        <div className="ll:flex ll:flex-col ll:gap-1.5">
          <label className="ll:text-micro ll:font-medium ll:text-muted">Web Address (URL)</label>
          <div className="ll:flex ll:gap-1.5">
            <input
              type="url"
              placeholder="https://example.com"
              value={customUrl || link?.target || ""}
              onChange={(e) => setCustomUrl(e.target.value)}
              onBlur={handleUrlSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              className="ll:flex-1 ll:h-7 ll:px-2 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-micro ll:text-primary ll:outline-none ll:focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Test Link Action Button */}
      {link && currentKind !== "none" && (
        <button
          type="button"
          onClick={handleTestLink}
          className="ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:w-full ll:py-1.5 ll:px-3 ll:mt-1 ll:rounded ll:bg-accent/15 ll:text-accent-foreground ll:border ll:border-accent/25 ll:text-micro ll:font-medium ll:hover:bg-accent/25 ll:transition-colors ll:cursor-pointer"
        >
          <Icon icon={link.kind === "url" ? ExternalLink : ArrowRight} size={12} />
          <span>Test Navigation ({link.kind})</span>
        </button>
      )}
    </div>
  );
};
