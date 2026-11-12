"use client";

/**
 * ============================================================================
 * 3D TEXT PROPERTIES FLOATING PANEL (Phase 3D-026, Task B3-W3-addtext)
 * ============================================================================
 * Contextual parameter panel rendered while a 3D text object is selected:
 *   - Text string
 *   - Size (scale)
 *   - Depth (extrusion depth)
 *   - Bevel (bevel depth)
 *   - Bevel resolution (bevel segments)
 *   - Alignment (left, center, right)
 *   - Spacing (tracking / letter spacing)
 *   - "Convert to mesh" button invoking canonical `3d.text.convert_to_mesh`
 * Styled consistently with `AdjustLastOperationPanel` using solid neutral tokens.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { getDocument, documentStore } from "@/core/store/useDocumentStore";
import { runCommand } from "@/core/commands";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { TextField } from "@/editor/components/TextField";
import type { Text3d, Object3d } from "@/core/document/schema";

export interface TextPanel3dProps {
  className?: string;
}

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const TextPanel3d: React.FC<TextPanel3dProps> = ({ className = "" }) => {
  const selection = useViewportStore((s) => s.selection);
  const activeObjectId = selection.active ?? selection.selected[0] ?? null;

  const [docVersion, setDocVersion] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Live document listener
  useEffect(() => {
    return documentStore.subscribe(() => {
      setDocVersion((v) => v + 1);
    });
  }, []);

  // Retrieve active text object and data block
  const textInfo = React.useMemo<{ obj: Object3d; data: Text3d } | null>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    docVersion; // dependency
    if (!activeObjectId) return null;

    const doc = getDocument();
    const obj = doc.objects?.[activeObjectId];
    if (!obj || obj.type !== "text" || !obj.dataId) return null;

    const data = doc.texts?.[obj.dataId];
    if (!data) return null;

    return { obj, data };
  }, [activeObjectId, docVersion]);

  const handleUpdate = useCallback(
    (field: string, value: unknown) => {
      if (!activeObjectId) return;
      runCommand("3d.text.set", {
        objectId: activeObjectId,
        [field]: value,
      });
    },
    [activeObjectId]
  );

  const handleConvertToMesh = useCallback(() => {
    if (!activeObjectId) return;
    runCommand("3d.text.convert_to_mesh", {
      objectId: activeObjectId,
    });
  }, [activeObjectId]);

  if (!textInfo) return null;

  const { data } = textInfo;

  return (
    <div
      data-testid="text-panel-3d"
      className={`ll:w-64 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-md ll:overflow-hidden ll:select-none ll:font-sans ${className}`}
    >
      {/* Header */}
      <div
        className="ll:h-8 ll:px-3 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:items-center ll:justify-between ll:cursor-pointer"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:min-w-0">
          <Icon
            icon={isCollapsed ? ChevronRight : ChevronDown}
            size={14}
            className="ll:text-secondary ll:shrink-0"
          />
          <span className="ll:text-micro ll:font-semibold ll:text-primary ll:truncate">
            3D Text ({data.text})
          </span>
        </div>
      </div>

      {/* Body Controls */}
      {!isCollapsed && (
        <div className="ll:p-3 ll:flex ll:flex-col ll:gap-2.5 ll:max-h-80 ll:overflow-y-auto">
          {/* Text String */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary">Text</span>
            <TextField
              aria-label="Text"
              value={data.text}
              onChange={(val) => handleUpdate("text", val)}
              size="sm"
            />
          </div>

          {/* Size */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Size</span>
            <div className="ll:w-28">
              <NumberField
                aria-label="Size"
                value={data.size}
                min={0.01}
                step={0.1}
                onChange={(val) => handleUpdate("size", val)}
                size="sm"
              />
            </div>
          </div>

          {/* Depth (Extrude) */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Depth</span>
            <div className="ll:w-28">
              <NumberField
                aria-label="Depth"
                value={data.depth}
                min={0}
                step={0.05}
                onChange={(val) => handleUpdate("depth", val)}
                size="sm"
              />
            </div>
          </div>

          {/* Bevel Depth */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Bevel</span>
            <div className="ll:w-28">
              <NumberField
                aria-label="Bevel"
                value={data.bevel}
                min={0}
                step={0.01}
                onChange={(val) => handleUpdate("bevel", val)}
                size="sm"
              />
            </div>
          </div>

          {/* Bevel Resolution (Segments) */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Resolution</span>
            <div className="ll:w-28">
              <NumberField
                aria-label="Bevel Resolution"
                value={data.bevelSegments}
                min={0}
                max={16}
                step={1}
                onChange={(val) => handleUpdate("bevelSegments", Math.round(val))}
                size="sm"
              />
            </div>
          </div>

          {/* Alignment */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Align</span>
            <div className="ll:w-28">
              <Select
                aria-label="Align"
                value={data.align ?? "left"}
                options={ALIGN_OPTIONS}
                onChange={(val) => handleUpdate("align", val)}
                size="sm"
              />
            </div>
          </div>

          {/* Spacing (Tracking) */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">Spacing</span>
            <div className="ll:w-28">
              <NumberField
                aria-label="Spacing"
                value={data.tracking ?? 0}
                step={0.05}
                onChange={(val) => handleUpdate("tracking", val)}
                size="sm"
              />
            </div>
          </div>

          {/* Convert to Mesh Action Button */}
          <div className="ll:pt-1 ll:border-t ll:border-border">
            <button
              type="button"
              data-testid="convert-text-to-mesh-btn"
              onClick={handleConvertToMesh}
              className="ll:w-full ll:h-7 ll:px-2.5 ll:flex ll:items-center ll:justify-center ll:gap-1.5 ll:rounded-sm ll:bg-surface-bar ll:border ll:border-border ll:text-micro ll:font-medium ll:text-primary ll:hover:bg-neutral-100 ll:cursor-pointer ll:transition-colors"
            >
              <Wand2 size={13} className="ll:text-secondary ll:shrink-0" />
              <span>Convert to mesh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextPanel3d;
