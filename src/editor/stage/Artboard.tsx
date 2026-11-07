"use client";

import React, { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { EmptyState } from "@/editor/components/EmptyState";
import { LayerContextMenuContent } from "@/editor/shell/left-panel/LayerContextMenu";
import { TransformOverlay } from "./TransformOverlay";
import { MotionPathOverlay } from "./MotionPathOverlay";
import { ValueHud } from "./ValueHud";
import { EngineLayer } from "./EngineLayer";
import { setLayerProps } from "@/core/editing/editOps";
import type { ArtboardProps, StagePreset } from "./types";
import {
  STAGE_CONSTANTS,
  STAGE_PRESETS,
  SIZES_MAP,
} from "./constants";

/** The scale, skew, 3D turn and offset a layer is given in the inspector (`transform.*`), as the CSS the wrapper puts on it. */
function designTransform(properties: Record<string, unknown>): { transform?: string; transformOrigin?: string } {
  const n = (k: string, d: number) => (typeof properties[k] === "number" ? (properties[k] as number) : d);
  const tx = n("transform.x", 0), ty = n("transform.y", 0);
  const rx = n("transform.rotateX", 0), ry = n("transform.rotateY", 0), rz = n("transform.rotate", 0);
  const s = n("transform.scale", 1), sx = n("transform.scaleX", 1) * s, sy = n("transform.scaleY", 1) * s;
  const kx = n("transform.skewX", 0), ky = n("transform.skewY", 0);
  const parts: string[] = [];
  if (tx || ty) parts.push(`translate(${tx}px, ${ty}px)`);
  if (rx) parts.push(`rotateX(${rx}deg)`);
  if (ry) parts.push(`rotateY(${ry}deg)`);
  if (rz) parts.push(`rotate(${rz}deg)`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx}, ${sy})`);
  if (kx || ky) parts.push(`skew(${kx}deg, ${ky}deg)`);
  const origin = typeof properties["transform.origin"] === "string" ? (properties["transform.origin"] as string) : undefined;
  return { transform: parts.length ? parts.join(" ") : undefined, transformOrigin: origin };
}

/** The outline of what a creation tool is drawing: the shape it will make, not always a box. */
const PreviewOutline: React.FC<{ archetype?: string; width: number; height: number }> = ({ archetype, width, height }) => {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const common = { fill: "none", stroke: "var(--ll-text-primary)", strokeWidth: 1, vectorEffect: "non-scaling-stroke" as const };
  let shape: React.ReactNode;
  switch (archetype) {
    case "ellipse":
      shape = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
      break;
    case "line":
    case "arrow":
      shape = <line x1={0} y1={h / 2} x2={w} y2={h / 2} {...common} />;
      break;
    case "polygon":
      shape = <polygon points={`${w / 2},0 ${w},${h * 0.38} ${w * 0.81},${h} ${w * 0.19},${h} 0,${h * 0.38}`} {...common} />;
      break;
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 1 : 0.4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${w / 2 + (Math.cos(a) * r * w) / 2},${h / 2 + (Math.sin(a) * r * h) / 2}`;
      }).join(" ");
      shape = <polygon points={pts} {...common} />;
      break;
    }
    default:
      shape = <rect x={0} y={0} width={w} height={h} {...common} />;
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", display: "block" }}>
      {archetype === "line" || archetype === "arrow" ? null : <rect x={0} y={0} width={w} height={h} fill="none" stroke="var(--ll-text-primary)" strokeWidth={1} strokeDasharray="4 3" opacity={0.35} vectorEffect="non-scaling-stroke" />}
      {shape}
    </svg>
  );
};

/** The three elements of the seeded prototype page keep their prototype drawing; every other layer is drawn by the engine. */
const PROTOTYPE_DRAWN = new Set(["headline", "button", "image"]);

export const Artboard: React.FC<ArtboardProps> = ({
  id = "artboard",
  title = "LazyLayout",
  preset: controlledPreset,
  onPresetChange,
  width: propWidth,
  height: propHeight,
  background,
  zoom = STAGE_CONSTANTS.defaultZoom,
  pan = { x: 0, y: 0 },
  elements,
  layers,
  drawPreview = null,
  selectedIds,
  hoveredId,
  onSelect,
  onHover,
  snapGuides = false,
  empty = false,
  onAddFrame,
  onInsert,
  onAskAi,
  onLayerAction,
  onToggleHidden,
  onToggleLocked,
  mode = "design",
  snapLines = [],
  spacingMarks = [],
  onStartMove,
  onStartResize,
  isGesturing = false,
  showValueHud = false,
}) => {
  const [internalPreset, setInternalPreset] = useState<StagePreset>("1440");
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    coords: { x: number; y: number };
    elementId: string;
  } | null>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);
  // Double-clicking a text layer edits its words in place; leaving the box (or Esc / Ctrl+Enter) writes them as one undo step.
  const [editingText, setEditingText] = useState<string | null>(null);

  const activePresetId = controlledPreset !== undefined ? controlledPreset : internalPreset;
  const currentPresetDef =
    STAGE_PRESETS.find((p) => p.id === activePresetId) || STAGE_PRESETS[0];

  const artboardWidth =
    propWidth !== undefined ? propWidth : currentPresetDef.artboardWidth;
  const artboardHeight =
    propHeight !== undefined ? propHeight : currentPresetDef.artboardHeight;

  // Scale computation: prototype uses `zoom / .59 * .9`
  const zoomScale = zoom > 0 ? zoom : 1;

  const handleSelectPreset = (newPreset: StagePreset) => {
    setInternalPreset(newPreset);
    onPresetChange?.(newPreset);
    setIsSizeMenuOpen(false);
  };

  const hasElements = Object.keys(elements).length > 0 && !empty;

  return (
    <div
      id={id}
      data-stage="artboard"
      data-testid="stage-artboard"
      className="ll-artboard ll:absolute ll:select-none ll:transition-shadow"
      style={{
        left: STAGE_CONSTANTS.artboardLeftPercent,
        top:
          mode === "motion" || mode === "code"
            ? STAGE_CONSTANTS.artboardMotionTopPercent
            : STAGE_CONSTANTS.artboardTopPercent,
        width: artboardWidth,
        height: artboardHeight,
        transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoomScale})`,
        transformOrigin: "center center",
        backgroundColor: background ?? "var(--ll-board-bg)",
        border: `${STAGE_CONSTANTS.selectionBorderWidth}px solid var(--ll-board-line)`,
        boxShadow: "var(--ll-shadow-soft)",
      }}
      onClick={(e) => {
        // Clicking directly on artboard background deselects elements
        if (e.target === e.currentTarget) {
          onSelect(null);
        }
      }}
    >
      {/* 1. Canvas Size Label / Dropdown Trigger (.lbl / #albl) */}
      <button
        ref={sizeButtonRef}
        id="albl"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isSizeMenuOpen}
        title="Canvas size"
        className="ll-lbl lbl ll:absolute ll:flex ll:items-center ll:gap-1 ll:cursor-pointer ll:text-secondary ll:rounded-sm ll:outline-none ll:hover:bg-surface-panel ll:hover:text-primary ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
        style={{
          left: STAGE_CONSTANTS.sizeLabelOffsetLeft,
          top: STAGE_CONSTANTS.sizeLabelOffsetTop,
          height: STAGE_CONSTANTS.sizeLabelHeight,
          paddingLeft: "var(--ll-spacing-1)",
          paddingRight: "var(--ll-spacing-1)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsSizeMenuOpen((prev) => !prev);
        }}
      >
        <span
          id="albltx"
          className="ll:flex ll:items-center ll:gap-1 ll:whitespace-nowrap ll:text-small ll:font-normal"
        >
          {SIZES_MAP[activePresetId] || "Desktop"} ·{" "}
          <span className="mono ll:font-mono">{activePresetId}</span>
        </span>
        <Icon
          icon={ChevronDown}
          size={STAGE_CONSTANTS.sizeLabelIconSize}
          className="ll:shrink-0 ll:text-muted"
        />
      </button>

      {/* Preset Menu */}
      <Menu
        open={isSizeMenuOpen}
        onClose={() => setIsSizeMenuOpen(false)}
        anchorRef={sizeButtonRef}
        width={STAGE_CONSTANTS.sizeDropdownWidth}
        aria-label="Canvas size menu"
      >
        {STAGE_PRESETS.map((p) => (
          <MenuItem
            key={p.id}
            onClick={() => handleSelectPreset(p.id)}
            checked={p.id === activePresetId}
          >
            <div className="ll:flex ll:items-center ll:justify-between ll:w-full">
              <span>{p.label}</span>
              <span className="ll:font-mono ll:text-muted ll:text-micro">
                {p.width}
              </span>
            </div>
          </MenuItem>
        ))}
      </Menu>

      {/* 2. Artboard Title Row (.atit / #atit) */}
      <div
        id="atit"
        className="ll-atit atit ll:absolute ll:left-0 ll:right-0 ll:top-0 ll:flex ll:items-center ll:px-2.5 ll:font-mono ll:text-secondary ll:bg-surface-panel ll:border-b ll:border-border ll:select-none"
        style={{
          height: STAGE_CONSTANTS.artboardTitleHeight,
          fontSize: "var(--ll-text-micro-size)",
          fontWeight: "var(--ll-text-micro-weight)",
        }}
      >
        {title}
      </div>

      {/* 3. Center Alignment Guides (.guide.v and .guide.h) */}
      {snapGuides && (
        <>
          <div
            className="ll-guide guide v ll-guide-v ll:absolute ll:pointer-events-none"
            style={{
              left: "50%",
              top: 0,
              bottom: 0,
              width: STAGE_CONSTANTS.selectionBorderWidth,
              backgroundColor: "var(--ll-text-muted)",
              opacity: 0.4,
            }}
          />
          <div
            className="ll-guide guide h ll-guide-h ll:absolute ll:pointer-events-none"
            style={{
              top: "52%",
              left: 0,
              right: 0,
              height: STAGE_CONSTANTS.selectionBorderWidth,
              backgroundColor: "var(--ll-text-muted)",
              opacity: 0.4,
            }}
          />
        </>
      )}

      {/* 4. Empty State if no elements or explicitly empty */}
      {(!hasElements || empty) && (
        <div id="es" className="ll-es es ll:absolute ll:inset-0 ll:flex ll:items-center ll:justify-center">
          <EmptyState
            title="Start with"
            onAddFrame={onAddFrame}
            onInsert={onInsert}
            onAskAi={onAskAi}
          />
        </div>
      )}

      {/* 5. Elements Layer */}
      {hasElements &&
        Object.values(elements).map((el) => {
          if (el.hidden) return null;
          const layer = layers?.[el.id];
          const engineDrawn = !!layer && !PROTOTYPE_DRAWN.has(el.id);
          const isSelected = selectedIds.includes(el.id) || (el.id === "headline" && selectedIds.includes("subtitle"));

          return (
            <div
              key={el.id}
              id={el.id === "headline" ? "el-text" : el.id === "button" ? "el-button" : el.id === "image" ? "el-image" : `el-${el.id}`}
              data-sel={el.id}
              data-element-id={el.id}
              data-testid="stage-element"
              data-selected={isSelected ? "true" : "false"}
              className={`ll-element ll:absolute ll:select-none ${
                isSelected ? "ll-sel sel " : ""
              }${
                engineDrawn
                  ? "ll:cursor-default "
                  : el.type === "button"
                  ? "ll-pg-b pg-b ll:cursor-pointer ll:grid ll:place-items-center ll:bg-control-primary ll:text-control-primary-fg ll:rounded-sm ll:font-medium "
                  : el.type === "image"
                  ? "ll-pg-img pg-img ll:cursor-pointer ll:bg-placeholder ll:border ll:border-border ll:rounded-sm "
                  : "ll-pg-h pg-h ll:cursor-default "
              }`}
              style={{
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                ...(engineDrawn && layer ? designTransform(layer.properties) : {}),
                ...(layer && typeof layer.properties["appearance.cursor"] === "string" && layer.properties["appearance.cursor"] !== "auto" ? { cursor: layer.properties["appearance.cursor"] as string } : {}),
              }}
              onDoubleClick={(e) => {
                if (layer && (layer.archetype === "text" || layer.archetype === "button") && !layer.locked) {
                  e.stopPropagation();
                  setEditingText(el.id);
                }
              }}
              onPointerDown={(e) => {
                if (editingText === el.id) return;
                onStartMove?.(el.id, e);
              }}
              onMouseEnter={() => onHover(el.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(el.id, e.shiftKey);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!selectedIds.includes(el.id)) {
                  onSelect(el.id, false);
                }
                setContextMenu({
                  coords: { x: e.clientX, y: e.clientY },
                  elementId: el.id,
                });
              }}
            >
              {engineDrawn && layer && layers && <EngineLayer layer={layer} layers={layers} />}
              {editingText === el.id && layer && (
                <textarea
                  autoFocus
                  aria-label="Edit text"
                  data-testid="stage-text-editor"
                  defaultValue={String(layer.properties[layer.archetype === "button" ? "content.label" : "content.text"] ?? "")}
                  onFocus={(e) => e.currentTarget.select()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) e.currentTarget.blur();
                  }}
                  onBlur={(e) => {
                    const value = e.currentTarget.value;
                    setEditingText(null);
                    const key = layer.archetype === "button" ? "content.label" : "content.text";
                    if (value !== String(layer.properties[key] ?? "")) setLayerProps([el.id], { [key]: value }, "Edit text");
                  }}
                  className="ll:absolute ll:inset-0 ll:w-full ll:h-full ll:m-0 ll:p-0 ll:border-0 ll:outline-none ll:resize-none ll:overflow-hidden ll:bg-white/90"
                  style={{
                    font: "inherit",
                    fontFamily: String(layer.properties["typography.fontFamily"] ?? "inherit"),
                    fontSize: Number(layer.properties["typography.fontSize"] ?? 16),
                    fontWeight: Number(layer.properties["typography.fontWeight"] ?? 400),
                    textTransform: (layer.properties["typography.textTransform"] as React.CSSProperties["textTransform"]) ?? "none",
                    lineHeight: Number(layer.properties["typography.lineHeight"] ?? 1.2),
                    color: String(layer.properties["typography.color"] ?? "#000"),
                    textAlign: (layer.properties["typography.textAlign"] as React.CSSProperties["textAlign"]) ?? "left",
                  }}
                />
              )}

              {!engineDrawn && el.type === "text" && (
                <>
                  <b
                    className="ll:block ll:font-semibold ll:text-primary"
                    style={{
                      fontSize: "var(--ll-text-display-size)",
                      lineHeight: "var(--ll-text-display-line-height)",
                      letterSpacing: "var(--ll-text-display-letter-spacing)",
                    }}
                  >
                    {el.title || "Design it once. Ship it lazily."}
                  </b>
                  <span
                    className="ll-pg-sub ll:block ll:text-secondary"
                    style={{
                      marginTop: "var(--ll-spacing-2)",
                      fontSize: "var(--ll-text-body-size)",
                      lineHeight: "var(--ll-text-body-line-height)",
                      maxWidth: "36ch",
                    }}
                  >
                    {el.subtitle ||
                      "Build pages visually and get production code out."}
                  </span>
                </>
              )}

              {!engineDrawn && el.type === "button" && (
                <span
                  style={{
                    fontSize: "var(--ll-text-body-size)",
                    fontWeight: "var(--ll-text-title-weight)",
                  }}
                >
                  {el.label || "Get started"}
                </span>
              )}

              {!engineDrawn && el.type === "image" && (
                <div className="ll:w-full ll:h-full ll:flex ll:items-center ll:justify-center ll:text-muted">
                  <span className="ll:text-micro ll:font-mono">
                    {Math.round(el.width)} x {Math.round(el.height)}
                  </span>
                </div>
              )}
            </div>
          );
        })}

      {/* 5b. The box a creation tool is drawing (same outline as a selection) */}
      {drawPreview && (
        <div
          data-testid="draw-preview"
          data-preview-shape={drawPreview.archetype ?? "rectangle"}
          className="ll-draw-preview ll:absolute ll:pointer-events-none"
          style={{
            left: drawPreview.x,
            top: drawPreview.y,
            width: drawPreview.width,
            height: drawPreview.height,
            transform: drawPreview.rotation ? `rotate(${drawPreview.rotation}deg)` : undefined,
          }}
        >
          <PreviewOutline archetype={drawPreview.archetype} width={drawPreview.width} height={drawPreview.height} />
        </div>
      )}

      {/* 6. Transform Overlay (Hover, Selection, 8 handles, Dimensions, Snapping) */}
      <TransformOverlay
        selectedIds={selectedIds}
        hoveredId={hoveredId}
        elements={elements}
        snapLines={snapLines}
        spacingMarks={spacingMarks}
        onStartMove={onStartMove}
        onStartResize={onStartResize}
        zoom={zoomScale}
      />

      {/* 6a. Motion Path Overlay (ROADMAP Phase 69: Motion paths on the canvas) */}
      <MotionPathOverlay
        selectedIds={selectedIds}
        elements={elements}
        layers={layers}
        zoom={zoomScale}
        mode={mode}
      />

      {/* 6b. Value HUD (ROADMAP Phase 70: Auto-key on the stage & value HUD) */}
      <ValueHud
        selectedIds={selectedIds}
        elements={elements}
        layers={layers}
        isGesturing={isGesturing}
        forceVisible={showValueHud}
      />

      {/* 7. Element Context Menu (.menu.ctx, MENUS.elem prototype parity) */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        position={contextMenu?.coords ?? null}
        variant="context"
        width={STAGE_CONSTANTS.contextMenuWidth}
        aria-label="Element context menu"
      >
        <LayerContextMenuContent
          selectionCount={
            contextMenu && selectedIds.includes(contextMenu.elementId)
              ? selectedIds.length
              : 1
          }
          onAction={(action) => {
            const targetId = contextMenu?.elementId ?? "";
            setContextMenu(null);
            onLayerAction?.(action, targetId);
          }}
          onToggleHidden={() => {
            if (contextMenu) {
              const targetId = contextMenu.elementId;
              const targets = selectedIds.includes(targetId) ? selectedIds : [targetId];
              targets.forEach((id) => onToggleHidden?.(id));
            }
            setContextMenu(null);
          }}
          onToggleLocked={() => {
            if (contextMenu) {
              const targetId = contextMenu.elementId;
              const targets = selectedIds.includes(targetId) ? selectedIds : [targetId];
              targets.forEach((id) => onToggleLocked?.(id));
            }
            setContextMenu(null);
          }}
        />
      </Menu>
    </div>
  );
};
