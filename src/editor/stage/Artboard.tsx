"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { LayerContextMenuContent } from "@/editor/shell/left-panel/LayerContextMenu";
import { TransformOverlay } from "./TransformOverlay";
import { TextFormatBar } from "./TextFormatBar";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import { setTextEditing } from "@/core/commands";
import type { ArtboardProps, StagePreset } from "./types";
import {
  STAGE_CONSTANTS,
  STAGE_PRESETS,
  SIZES_MAP,
} from "./constants";
import "./stage.css";

export const Artboard: React.FC<ArtboardProps> = ({
  id = "artboard",
  title = "LazyLayout",
  preset: controlledPreset,
  onPresetChange,
  width: propWidth,
  height: propHeight,
  zoom = STAGE_CONSTANTS.defaultZoom,
  pan = { x: 0, y: 0 },
  elements,
  selectedIds,
  hoveredId,
  onSelect,
  onHover,
  snapGuides = false,
  empty = false,
  onAddFrame: _onAddFrame,
  onInsert: _onInsert,
  onAskAi: _onAskAi,
  onElementChange,
  onLayerAction,
  onToggleHidden,
  onToggleLocked,
  mode = "design",
  snapLines = [],
  spacingMarks = [],
  onStartMove,
  onStartResize,
}) => {
  const [internalPreset, setInternalPreset] = useState<StagePreset>("1440");
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    coords: { x: number; y: number };
    elementId: string;
  } | null>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);
  const artboardContainerRef = useRef<HTMLDivElement | null>(null);

  // In-place text editing state
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const activeEditableRef = useRef<HTMLDivElement | null>(null);

  const activePresetId = controlledPreset !== undefined ? controlledPreset : internalPreset;
  const currentPresetDef =
    STAGE_PRESETS.find((p) => p.id === activePresetId) || STAGE_PRESETS[0];

  const artboardWidth =
    propWidth !== undefined ? propWidth : currentPresetDef.artboardWidth;
  const artboardHeight =
    propHeight !== undefined ? propHeight : currentPresetDef.artboardHeight;

  // Scale computation: prototype uses `zoom / .59 * .9`
  const zoomScale =
    zoom > 0 ? (zoom / STAGE_CONSTANTS.defaultZoom) * 0.9 : 1;

  const handleSelectPreset = (newPreset: StagePreset) => {
    setInternalPreset(newPreset);
    onPresetChange?.(newPreset);
    setIsSizeMenuOpen(false);
  };

  // Blank page: a page with no layers renders nothing on the artboard (no placeholder)
  const isBlank = Object.keys(elements).length === 0 || empty;
  const hasElements = !isBlank;

  const startTextEdit = useCallback(
    (elId: string) => {
      setEditingElementId(elId);
      useCanvasViewStore.getState().startTextEdit(elId);
      setTextEditing(true);
    },
    []
  );

  const endTextEdit = useCallback(
    (save = true) => {
      if (!editingElementId) return;
      if (save && activeEditableRef.current) {
        const text = activeEditableRef.current.innerText ?? "";
        const el = elements[editingElementId];
        if (el) {
          if (el.type === "button") {
            onElementChange?.(editingElementId, { label: text });
          } else {
            onElementChange?.(editingElementId, { title: text });
          }
        }
      }
      setEditingElementId(null);
      useCanvasViewStore.getState().stopTextEdit();
      setTextEditing(false);
    },
    [editingElementId, elements, onElementChange]
  );

  // Handle global clicks to commit edit if clicked outside
  useEffect(() => {
    if (!editingElementId) return;

    const handleGlobalDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".ftxb,.ll-ftxb")) return;
      if (activeEditableRef.current && activeEditableRef.current.contains(target)) return;
      endTextEdit(true);
    };

    window.addEventListener("pointerdown", handleGlobalDown, true);
    return () => window.removeEventListener("pointerdown", handleGlobalDown, true);
  }, [editingElementId, endTextEdit]);

  // Focus editable container on start
  useEffect(() => {
    if (editingElementId && activeEditableRef.current) {
      activeEditableRef.current.focus();
      // Select all text in container
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(activeEditableRef.current);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingElementId]);

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (e.key === "Escape" || (mod && e.key === "Enter")) {
      e.preventDefault();
      e.stopPropagation();
      endTextEdit(true);
    } else if (mod && !e.shiftKey && key === "b") {
      e.preventDefault();
      e.stopPropagation();
      document.execCommand("bold");
    } else if (mod && !e.shiftKey && key === "i") {
      e.preventDefault();
      e.stopPropagation();
      document.execCommand("italic");
    } else if (mod && !e.shiftKey && key === "u") {
      e.preventDefault();
      e.stopPropagation();
      document.execCommand("underline");
    } else if (mod && e.shiftKey && key === "x") {
      e.preventDefault();
      e.stopPropagation();
      document.execCommand("strikeThrough");
    }
  };

  return (
    <div
      ref={artboardContainerRef}
      id={id}
      data-stage="artboard"
      data-testid="stage-artboard"
      className={`ll-artboard artboard ll:absolute ll:select-none ll:transition-shadow ${
        isBlank ? "ll-artboard-blank" : ""
      }`}
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
        backgroundColor: isBlank ? "transparent" : "var(--ll-board-bg)",
        border: isBlank
          ? "1px solid transparent"
          : `${STAGE_CONSTANTS.selectionBorderWidth}px solid var(--ll-board-line)`,
        boxShadow: isBlank ? "none" : "var(--ll-shadow-soft)",
      }}
      onClick={(e) => {
        // Clicking directly on artboard background deselects elements
        if (e.target === e.currentTarget) {
          endTextEdit(true);
          onSelect(null);
        }
      }}
    >
      {/* 1. Canvas Size Label / Dropdown Trigger (.lbl / #albl) - hidden on blank page */}
      {!isBlank && (
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
      )}

      {/* Preset Menu */}
      {!isBlank && (
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
      )}

      {/* 2. Artboard Title Row (.atit / #atit) - hidden on blank page */}
      {!isBlank && (
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
      )}

      {/* 3. Center Alignment Guides (.guide.v and .guide.h) - hidden on blank page */}
      {!isBlank && snapGuides && (
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

      {/* 4. Blank page renders NOTHING on artboard (no placeholder) */}

      {/* 5. Elements Layer */}
      {hasElements &&
        Object.values(elements).map((el) => {
          if (el.hidden) return null;
          const isSelected = selectedIds.includes(el.id) || (el.id === "headline" && selectedIds.includes("subtitle"));
          const isEditing = editingElementId === el.id;

          return (
            <div
              key={el.id}
              id={el.id === "headline" ? "el-text" : el.id === "button" ? "el-button" : el.id === "image" ? "el-image" : `el-${el.id}`}
              data-sel={el.id}
              data-element-id={el.id}
              data-testid="stage-element"
              data-selected={isSelected ? "true" : "false"}
              data-locked={el.locked ? "true" : "false"}
              className={`ll-element ll:absolute ${
                isEditing ? "ll:select-text" : "ll:select-none"
              } ${isSelected ? "ll-sel sel " : ""}${
                el.type === "button"
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
              }}
              onPointerDown={(e) => {
                if (!isEditing) onStartMove?.(el.id, e);
              }}
              onMouseEnter={() => onHover(el.id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditing) onSelect(el.id, e.shiftKey);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (el.type === "text" || el.type === "button") {
                  startTextEdit(el.id);
                }
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
              {el.type === "text" && (
                <>
                  <div
                    ref={isEditing ? activeEditableRef : null}
                    contentEditable={isEditing}
                    suppressContentEditableWarning={isEditing}
                    spellCheck={false}
                    role={isEditing ? "textbox" : undefined}
                    aria-multiline={isEditing ? "true" : undefined}
                    aria-label={isEditing ? "Edit text" : undefined}
                    className={isEditing ? "ll:outline-none ll:cursor-text" : ""}
                    onKeyDown={isEditing ? handleTextKeyDown : undefined}
                  >
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
                  </div>
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

              {el.type === "button" && (
                <span
                  ref={isEditing ? activeEditableRef : null}
                  contentEditable={isEditing}
                  suppressContentEditableWarning={isEditing}
                  spellCheck={false}
                  role={isEditing ? "textbox" : undefined}
                  aria-label={isEditing ? "Edit button text" : undefined}
                  className={isEditing ? "ll:outline-none ll:cursor-text" : ""}
                  onKeyDown={isEditing ? handleTextKeyDown : undefined}
                  style={{
                    fontSize: "var(--ll-text-body-size)",
                    fontWeight: "var(--ll-text-title-weight)",
                  }}
                >
                  {el.label || "Get started"}
                </span>
              )}

              {el.type === "image" && (
                <div className="ll:w-full ll:h-full ll:flex ll:items-center ll:justify-center ll:text-muted">
                  <span className="ll:text-micro ll:font-mono">
                    {Math.round(el.width)} x {Math.round(el.height)}
                  </span>
                </div>
              )}
            </div>
          );
        })}

      {/* 6. Transform Overlay (Hover, Selection, 8 handles, Dimensions, Snapping) */}
      {!isBlank && (
        <TransformOverlay
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          elements={elements}
          snapLines={snapLines}
          spacingMarks={spacingMarks}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
        />
      )}

      {/* 7. Inline Text Format Bar */}
      <TextFormatBar containerRef={artboardContainerRef} />

      {/* 8. Element Context Menu (.menu.ctx, MENUS.elem prototype parity) */}
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
