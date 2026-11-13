"use client";
import React, { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { composeStyleCode, styleCodePatch, type StyleCodeError } from "@/core/style/styleCode";
import type { InspectorSectionProps } from "../types";

/**
 * Style code (Design track D3): write CSS declarations for the layer as in a stylesheet. A declaration that is a control
 * (padding, opacity, border-radius, ...) sets that control; any other is kept as written, drawn and exported. The text is
 * applied when the box loses focus or on Ctrl/Cmd+Enter, and nothing is applied while it has an error.
 */
export const StyleCodeSection: React.FC<InspectorSectionProps> = ({ layer, selectedId, isMulti, onUpdateProps, className = "" }) => {
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const [errors, setErrors] = useState<StyleCodeError[]>([]);
  if (!layer || isMulti || !selectedId) return null;

  const composed = composeStyleCode(layer);
  const editing = draft !== null && draft.id === selectedId;
  const text = editing ? draft.text : composed;

  const apply = () => {
    if (!editing) return;
    const result = styleCodePatch(layer, draft.text);
    setErrors(result.errors);
    if (result.errors.length > 0) return;
    onUpdateProps?.(result.patch);
    setDraft(null);
  };

  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`}>
      <textarea
        aria-label="Style code"
        title="CSS declarations for this layer, like padding: 24px; backdrop-filter: blur(8px). Known properties become the controls above; the rest are kept as written. Applies when you leave the box, or with Ctrl/Cmd+Enter."
        spellCheck={false}
        rows={Math.min(12, Math.max(4, text.split("\n").length + 1))}
        placeholder={"padding: 24px;\nbackdrop-filter: blur(8px);"}
        value={text}
        onChange={(e) => {
          setDraft({ id: selectedId, text: e.target.value });
          if (errors.length > 0) setErrors([]);
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            apply();
          }
        }}
        className={`ll-dfield ll:w-full ll:resize-y ll:bg-surface-bar ll:rounded-sm ll:border ll:px-2 ll:py-1.5 ll:font-mono ll:text-micro ll:leading-snug ll:text-primary ll:outline-none ll:placeholder:text-muted ${
          errors.length > 0 ? "ll:border-border-active" : "ll:border-transparent ll:focus:border-primary"
        }`}
      />
      {errors.length > 0 && (
        <ul role="alert" aria-label="Style code errors" className="ll:flex ll:flex-col ll:gap-1 ll:m-0 ll:p-0 ll:list-none">
          {errors.map((e, i) => (
            <li key={i} className="ll:flex ll:items-start ll:gap-1.5 ll:text-micro ll:text-primary">
              <Icon icon={TriangleAlert} size={12} className="ll:mt-px ll:shrink-0" />
              <span>
                Line {e.line}: {e.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
