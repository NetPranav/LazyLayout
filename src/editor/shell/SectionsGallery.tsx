"use client";

/**
 * Insert Section (ROADMAP Phase 51): the eight section templates with a small drawing of each, a button that adds one to
 * the page you are on, and the starter projects. The drawings are made from the templates themselves, so they can't
 * drift from what gets inserted. The dialog stays open so several sections can be added in a row.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { invokeCommand } from "@/core/commands";
import { SECTION_TEMPLATES, type SectionTemplate } from "@/core/templates/sections";
import { STARTERS } from "@/core/templates/starters";
import type { TNode } from "@/core/templates/spec";
import { useTemplatesUiStore } from "@/core/store/useTemplatesUiStore";

const SCALE = 0.16;
const ALIGN: Record<string, string> = { "flex-start": "flex-start", center: "center", "flex-end": "flex-end", stretch: "stretch", "space-between": "space-between" };

const px = (v: unknown): number => (typeof v === "number" ? v * SCALE : 0);

/** A tiny drawing of a node: boxes for frames and buttons, a bar for a line of text. */
const Mini: React.FC<{ node: TNode }> = ({ node }) => {
  const p = node.props;
  const w = p["sizing.horizontal"] === "fill" ? "100%" : typeof p["frame.width"] === "number" ? px(p["frame.width"]) : undefined;
  const maxW = typeof p["layout.maxWidth"] === "number" ? px(p["layout.maxWidth"]) : undefined;
  if (node.archetype === "text") {
    const size = (typeof p["typography.fontSize"] === "number" ? p["typography.fontSize"] : 16) * SCALE;
    const len = String(p["content.text"] ?? "").length;
    return <div style={{ height: Math.max(2, size * 0.7), width: w ?? Math.min(len * size * 0.55, maxW ?? 400), maxWidth: "100%", background: String(p["typography.color"] ?? "#888"), opacity: 0.75, borderRadius: 1 }} />;
  }
  if (node.archetype === "button") {
    return <div style={{ padding: `${px(p["layout.paddingY"])}px ${px(p["layout.paddingX"])}px`, minWidth: 18, minHeight: 6, background: String(p["appearance.background.color"]), border: p["appearance.border.width"] ? `1px solid ${String(p["appearance.border.color"])}` : undefined, borderRadius: px(p["appearance.radius"]) }}><div style={{ height: 2, width: 12, background: String(p["typography.color"]), opacity: 0.8 }} /></div>;
  }
  const dir = p["layout.flexDirection"] === "row" ? "row" : "column";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: dir,
        flexWrap: p["layout.flexWrap"] === "wrap" ? "wrap" : "nowrap",
        gap: px(p["layout.gap"]),
        padding: `${px(p["layout.paddingTop"])}px ${px(p["layout.paddingRight"])}px ${px(p["layout.paddingBottom"])}px ${px(p["layout.paddingLeft"])}px`,
        alignItems: ALIGN[String(p["layout.alignItems"])] ?? "flex-start",
        justifyContent: ALIGN[String(p["layout.justifyContent"])] ?? "flex-start",
        width: w,
        maxWidth: maxW,
        minWidth: typeof p["layout.minWidth"] === "number" ? px(p["layout.minWidth"]) : undefined,
        flex: p["layout.flexGrow"] ? "1 1 0" : undefined,
        height: typeof p["frame.height"] === "number" ? Math.max(1, px(p["frame.height"])) : undefined,
        background: String(p["appearance.background.color"]),
        border: p["appearance.border.width"] ? `1px solid ${String(p["appearance.border.color"])}` : undefined,
        borderRadius: px(p["appearance.radius"]),
        boxSizing: "border-box",
      }}
    >
      {node.children.map((c, i) => (
        <Mini key={i} node={c} />
      ))}
    </div>
  );
};

const Preview: React.FC<{ template: SectionTemplate }> = ({ template }) => {
  const bg = template.band.bg === "surface" ? "#f5f6f8" : template.band.bg === "primary" ? "#4f46e5" : "#ffffff";
  return (
    <div aria-hidden style={{ background: bg, border: "1px solid #d8dbe2", borderRadius: 6, padding: `${template.band.padY * SCALE * 0.6}px 8px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, overflow: "hidden", maxHeight: 150 }}>
      {template.build(template.copy).map((n, i) => (
        <Mini key={i} node={n} />
      ))}
    </div>
  );
};

const btn: React.CSSProperties = { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border, #3a3a40)", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12 };

export const SectionsGallery: React.FC = () => {
  const isOpen = useTemplatesUiStore((s) => s.isOpen);
  const [note, setNote] = useState("");
  if (!isOpen) return null;
  const close = () => useTemplatesUiStore.getState().close();
  const insert = (template: string, name: string) => {
    const ok = invokeCommand("insert.section", { template });
    setNote(ok ? `Added ${name}.` : `Couldn't add ${name}.`);
  };
  const addStarter = (id: string, name: string) => {
    const ok = invokeCommand("project.addStarter", { starter: id });
    setNote(ok ? `Added the ${name} pages.` : `Couldn't add ${name}.`);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Insert section" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div style={{ width: "min(960px, 94vw)", maxHeight: "88vh", overflow: "auto", background: "var(--panel-bg, #1f1f23)", color: "var(--text, #f2f2f2)", border: "1px solid var(--border, #3a3a40)", borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <strong style={{ fontSize: 16 }}>Insert section</strong>
          <button type="button" aria-label="Close" style={{ ...btn, border: "none" }} onClick={close}>
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: "0 0 14px", opacity: 0.75, fontSize: 12 }} aria-live="polite">
          {note || "Each section goes onto the page you are on and follows the brand colours, so switching to Dark restyles it. Words and colours are yours to change."}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
          {SECTION_TEMPLATES.map((t) => (
            <div key={t.id} style={{ border: "1px solid var(--border, #3a3a40)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <Preview template={t} />
              <div>
                <strong style={{ fontSize: 13 }}>{t.name}</strong>
                <div style={{ fontSize: 12, opacity: 0.7, minHeight: 32 }}>{t.description}</div>
              </div>
              <button type="button" style={btn} onClick={() => insert(t.id, t.name)} aria-label={`Insert ${t.name}`}>
                Insert
              </button>
            </div>
          ))}
        </div>
        <h3 style={{ margin: "22px 0 8px", fontSize: 14 }}>Starter projects</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {STARTERS.map((s) => (
            <div key={s.id} style={{ border: "1px solid var(--border, #3a3a40)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>{s.name}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{s.description}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{s.pages.length === 1 ? "1 page" : `${s.pages.length} pages`}, {s.pages.reduce((n, p) => n + p.sections.length, 0)} sections. Adds pages; nothing already here is removed.</div>
              <button type="button" style={btn} onClick={() => addStarter(s.id, s.name)} aria-label={`Add ${s.name}`}>
                Add pages
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
