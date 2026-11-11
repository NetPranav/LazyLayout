"use client";

import React, { useState, useRef, useLayoutEffect, useMemo, useEffect } from "react";
import { ChevronDown, Link2 } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Menu, MenuItem } from "@/editor/components/Menu";
import { EmptyState } from "@/editor/components/EmptyState";
import { LayerContextMenuContent } from "@/editor/shell/left-panel/LayerContextMenu";
import { TransformOverlay } from "./TransformOverlay";
import { TextFormatBar } from "./TextFormatBar";
import { setTextEditing } from "@/core/commands";
import { MotionPathOverlay } from "./MotionPathOverlay";
import { ValueHud } from "./ValueHud";
import { OnionSkinOverlay } from "./OnionSkinOverlay";
import { AnchorOverlay } from "./AnchorOverlay";
import { CornerPinOverlay } from "./CornerPinOverlay";
import { WarpMeshOverlay } from "./WarpMeshOverlay";
import { DraftPath } from "./DraftPath";
import { LayoutOverlay, FlowDropLine } from "./layout-overlay";
import { PathEditLayer } from "./pen/PathEditLayer";
import { PathContextBar } from "./pen/PathContextBar";
import { penJustFinished } from "./pen/penAdapter";
import { useVectorEditStore } from "@/core/store/useVectorEditStore";
import { RenderLayer } from "@/core/render";
import { useMirrorViews } from "./useMirrorViews";
import { exactDeviceOfFrame, frameSizeLabel, frameViewportHeight, mirrorSourceId, pageFrameOf } from "@/core/frames/devices";
import { useFramePreviewStore } from "@/core/store/useFramePreviewStore";
import { ProtoIcon } from "@/editor/components/icons/ProtoIcon";
import { setLayerProps } from "@/core/editing/editOps";
import type { Layer } from "@/core/document/schema";
import { resolveLayerAnchor, formatCssTransformOrigin } from "@/core/geometry/pins";
import { useCanvasViewStore } from "@/core/store/useCanvasViewStore";
import {
  computeComposedWorldMatrix,
  formatCssMatrix,
  getLayerParentRef,
  type AffineMatrix2D,
} from "@/core/geometry/parentTransforms";
import { evaluate } from "@/core/kernel/evaluate";
import { MAIN_COMPOSITION_ID } from "@/core/document/compositions";
import { useMotionModel } from "@/editor/motion-model";
import type { ArtboardProps, StagePreset } from "./types";
import {
  STAGE_CONSTANTS,
  STAGE_PRESETS,
  SIZES_MAP,
} from "./constants";
import "./stage.css";
import { presetForBreakpoint } from "./presetBreakpoints";
import { deviceOfFrame, DEVICE_SPECS, switchFrameView, type DeviceKind } from "./deviceViews";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useBreakpointStore, useEditBreakpointId } from "@/core/store/useBreakpointStore";
import { breakpointsOf } from "@/core/breakpoints/breakpoints";
import { getDocument } from "@/core/store/documentState";

/** The scale, skew, 3D turn and offset a layer is given in the inspector (`transform.*`), as the CSS the wrapper puts on it. */
function designTransform(
  properties: Record<string, unknown>,
  layer?: Layer,
  width?: number,
  height?: number,
  layers?: Record<string, Layer>
): { transform?: string; transformOrigin?: string } {
  // Phase 73: If layer has a parentRef, compose world transform matrix across parent chain
  if (layer && layers && getLayerParentRef(layer)) {
    const parentRef = getLayerParentRef(layer);
    if (parentRef && layers[parentRef]) {
      const composedM = computeComposedWorldMatrix(layers, layer.id);
      const fx = typeof properties["frame.x"] === "number" ? (properties["frame.x"] as number) : 0;
      const fy = typeof properties["frame.y"] === "number" ? (properties["frame.y"] as number) : 0;
      const relM: AffineMatrix2D = [
        composedM[0],
        composedM[1],
        composedM[2],
        composedM[3],
        composedM[4] - fx,
        composedM[5] - fy,
      ];
      return {
        transform: formatCssMatrix(relM),
        transformOrigin: "0 0",
      };
    }
  }

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

  let origin: string | undefined;
  if (width !== undefined && height !== undefined) {
    const anchor = resolveLayerAnchor(layer, width, height);
    origin = formatCssTransformOrigin(anchor);
  } else if (typeof properties["transform.origin"] === "string") {
    origin = properties["transform.origin"] as string;
  }
  return { transform: parts.length ? parts.join(" ") : undefined, transformOrigin: origin };
}
/**
 * The words of a text layer, edited where they sit. It is styled exactly like the drawn text (same wrapping, same overflow,
 * same capitals), so what you type, what is highlighted and what you see afterwards are the same lines. Leaving it (click
 * away, Escape, Ctrl+Enter) writes the words as one undo step.
 */
const InlineTextEditor: React.FC<{ layer: NonNullable<ArtboardProps["layers"]>[string]; onDone: (value: string) => void }> = ({ layer, onDone }) => {
  const ref = useRef<HTMLDivElement>(null);
  const key = layer.archetype === "button" ? "content.label" : "content.text";
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = String(layer.properties[key] ?? "");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Take the look of the drawn text itself (whatever the engine computed), and hide the drawn copy while this one is open.
    const drawn = document.querySelector<HTMLElement>(`[data-archetype][data-element-id="${layer.id}"]`);
    if (drawn) {
      const cs = getComputedStyle(drawn);
      for (const prop of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "color", "textAlign", "textTransform", "whiteSpace", "overflowWrap", "textDecorationLine", "wordSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
        if (cs[prop]) el.style[prop] = cs[prop]; // (Firefox leaves some shorthands empty: keep the explicit value then)
      }
      drawn.style.visibility = "hidden";
    }
    return () => {
      if (drawn) drawn.style.visibility = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the words are read once, when editing starts
  }, []);
  const p = layer.properties;
  const sizing = String(p["text.sizing"] ?? "fixed");
  const chosen = p["typography.whiteSpace"];
  const space = chosen === "nowrap" || chosen === "pre" || chosen === "normal" ? chosen : null;
  const wraps = sizing !== "autoWidth" && space !== "nowrap" && space !== "pre";
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Edit text"
      aria-multiline="true"
      data-testid="stage-text-editor"
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && !e.altKey) {
          const k = e.key.toLowerCase();
          if (k === "b") {
            e.preventDefault();
            e.stopPropagation();
            document.execCommand("bold");
            return;
          }
          if (k === "i") {
            e.preventDefault();
            e.stopPropagation();
            document.execCommand("italic");
            return;
          }
          if (k === "u") {
            e.preventDefault();
            e.stopPropagation();
            document.execCommand("underline");
            return;
          }
          if (k === "x" && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            document.execCommand("strikeThrough");
            return;
          }
        }
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) e.currentTarget.blur();
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onBlur={(e) => onDone(e.currentTarget.innerText.replace(/\n$/, ""))}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: sizing === "autoWidth" ? "max-content" : "100%",
        minHeight: "100%",
        margin: 0,
        outline: "1px solid var(--ll-border-active, #2F6BFF)",
        background: "rgba(255,255,255,0.35)",
        boxSizing: "border-box",
        whiteSpace: space ?? (sizing === "autoWidth" ? "pre" : "pre-wrap"),
        overflowWrap: wraps ? "anywhere" : "normal",
        fontFamily: String(p["typography.fontFamily"] ?? "inherit"),
        fontSize: Number(p["typography.fontSize"] ?? 16),
        fontWeight: Number(p["typography.fontWeight"] ?? 400),
        fontStyle: String(p["typography.fontStyle"] ?? "normal"),
        lineHeight: Number(p["typography.lineHeight"] ?? 1.2),
        letterSpacing: Number(p["typography.letterSpacing"] ?? 0),
        color: String(p["typography.color"] ?? "#000"),
        textAlign: (p["typography.textAlign"] as React.CSSProperties["textAlign"]) ?? "left",
        textTransform: (p["typography.textTransform"] as React.CSSProperties["textTransform"]) ?? "none",
        textDecorationLine: p["typography.textDecoration"] && p["typography.textDecoration"] !== "none" ? String(p["typography.textDecoration"]) : undefined,
      }}
    />
  );
};

/** The outline of what a creation tool is drawing: the shape it will make, not always a box. */
const PreviewOutline: React.FC<{ archetype?: string; width: number; height: number; zoom?: number }> = ({ archetype, width, height, zoom = 1 }) => {
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
    case "star": {
      // the same shape the tool will make: a six-sided polygon, a five-pointed star with its inner radius at half
      const star = archetype === "star";
      const n = star ? 10 : 6;
      const pts = Array.from({ length: n }, (_, i) => {
        const r = star ? (i % 2 === 0 ? 1 : 0.5) : 1;
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return `${w / 2 + (Math.cos(a) * r * w) / 2},${h / 2 + (Math.sin(a) * r * h) / 2}`;
      }).join(" ");
      shape = <polygon points={pts} {...common} />;
      break;
    }
    case "marquee":
      return <div data-testid="marquee" style={{ width: w, height: h, boxSizing: "border-box", border: `calc(1px / ${zoom > 0 ? zoom : 1}) solid var(--ll-text-primary)`, background: "color-mix(in srgb, var(--ll-text-primary) 6%, transparent)" }} />;
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

const ENGINE_CTX = { frameAtOrigin: true };

/** Scrolls a previewed frame as drawn by the engine. */
function scrollDrawnFrame(frameId: string, top: number): void {
  const node = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype][data-element-id="${frameId}"]`);
  if (node) node.scrollTop = top;
}

export const Artboard: React.FC<ArtboardProps> = ({
  id = "artboard",
  activeTool,
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
  pageRef,
  rootId,
  drawPreview = null,
  selectedIds,
  hoveredId,
  onSelect,
  onHover,
  snapGuides = false,
  empty = false,
  references,
  onAddFrame: _onAddFrame,
  onInsert: _onInsert,
  onAskAi: _onAskAi,
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
  const artboardContainerRef = useRef<HTMLDivElement | null>(null);
  // Double-clicking a text layer edits its words in place; leaving the box (or Esc / Ctrl+Enter) writes them as one undo step.
  const [editingText, setEditingText] = useState<string | null>(null);
  const canvasViewMode = useCanvasViewStore((s) => s.mode);
  const playhead = useMotionModel((s) => s.playhead);
  const fps = useMotionModel((s) => s.fps) || 60;
  const motionTimeSec = playhead / fps;

  // The page is drawn at rest; the animation engine (useCanvasEngine, Phase 57) writes the animated values onto it in
  // Motion and Preview and while playing, without re-rendering.

  const activeBreakpointId = useBreakpointStore((s) => s.activeId);
  const mirrorViews = useMirrorViews(rootId ?? null);
  // the frame the selection is being edited in, and the breakpoint its edits go to (none: the base)
  const editBp = useEditBreakpointId();
  const selectedMirror = useSelectionStore((s) => s.selectedMirrorId);
  const editingFrameId = selectedMirror ?? (layers && rootId ? pageFrameOf(layers, rootId, selectedIds[0]) : null);
  const editingName = editBp ? breakpointsOf(getDocument()).find((b) => b.id === editBp)?.name ?? null : null;
  const previewing = useFramePreviewStore((p) => p.previewing);
  const activeBpPreset = presetForBreakpoint(breakpointsOf(getDocument()), activeBreakpointId);
  const activePresetId = controlledPreset !== undefined ? controlledPreset : (activeBreakpointId !== null ? activeBpPreset : internalPreset);
  const currentPresetDef =
    STAGE_PRESETS.find((p) => p.id === activePresetId) || STAGE_PRESETS[0];

  const artboardWidth =
    propWidth !== undefined ? propWidth : currentPresetDef.artboardWidth;
  const artboardHeight =
    propHeight !== undefined ? propHeight : currentPresetDef.artboardHeight;

  // Scale computation: prototype uses `zoom / .59 * .9`
  const zoomScale = zoom > 0 ? zoom : 1;
  const editingPath = useVectorEditStore((s) => s.layerId !== null);
  const labelKeep = zoomScale < 1 ? 1 / zoomScale : 1;

  const handleSelectPreset = (newPreset: StagePreset) => {
    setInternalPreset(newPreset);
    onPresetChange?.(newPreset);
    setIsSizeMenuOpen(false);
  };

  const hasElements = Object.keys(elements).length > 0 && !empty;
  // The page sheet (white fill, border, shadow, size label, title strip) must be drawn only when
  // the page has at least one direct child that is NOT a frame (a loose shape/text/image placed straight on the page).
  // When every direct child of the page is a frame (archetype "container") and when the page is empty, draw NO page sheet.
  // The page itself is never drawn (the Home page is only a title in the page list): the viewport holds frames and what is on them.
  // Only the loading-page view draws a sheet, since its page is the frame being designed.
  const drawSheet = !empty && !!references;
  const bare = !drawSheet;

  const topFrames = useMemo(() => {
    if (!bare || !layers) return [];
    return Object.values(layers).filter(
      (l) => l.parentId === rootId && l.archetype === "container" && l.id !== rootId
    );
  }, [bare, layers, rootId]);

  // frames being previewed are drawn as the device's screen; only a frame of a device has one
  const screenFrames = useMemo(() => {
    let out: Record<string, number> | undefined;
    for (const id of Object.keys(previewing)) {
      const height = frameViewportHeight(layers?.[id]);
      if (height !== null) (out ??= {})[id] = height;
    }
    return out;
  }, [previewing, layers]);
  const engineCtx = useMemo(
    () => (mirrorViews || screenFrames ? { ...ENGINE_CTX, ...(mirrorViews ? { mirrorViews } : {}), ...(screenFrames ? { screenFrames } : {}) } : ENGINE_CTX),
    [mirrorViews, screenFrames],
  );
  /** How tall a frame is with everything in it: a linked view is as tall as what it shows at its breakpoint. */
  const fullHeightOf = (frame: Layer): number => {
    const own = Number(frame.properties["frame.height"] ?? 0);
    const source = mirrorSourceId(frame);
    return source ? Math.max(own, Number(mirrorViews?.[frame.id]?.[source]?.properties["frame.height"] ?? 0)) : own;
  };

  const [openSizeMenuFrameId, setOpenSizeMenuFrameId] = useState<string | null>(null);
  const [sizeMenuAnchorEl, setSizeMenuAnchorEl] = useState<HTMLElement | null>(null);

  // Active frame for positioning the frame dropdown / size label
  const activeFrame = useMemo(() => {
    if (!bare) return null;
    if (topFrames.length === 0) return null;
    const selectedFrame = topFrames.find((f) => selectedIds.includes(f.id));
    return selectedFrame ?? topFrames[0];
  }, [bare, topFrames, selectedIds]);

  const activeFrameEl = activeFrame ? elements[activeFrame.id] : null;
  const labelLeft = activeFrameEl
    ? activeFrameEl.x + STAGE_CONSTANTS.sizeLabelOffsetLeft
    : STAGE_CONSTANTS.sizeLabelOffsetLeft;
  const labelTop = activeFrameEl
    ? activeFrameEl.y + STAGE_CONSTANTS.sizeLabelOffsetTop
    : STAGE_CONSTANTS.sizeLabelOffsetTop;
  const hideLabel = !hasElements || empty;
  // Blank page: a page with no layers renders nothing on the artboard (no placeholder)
  const isBlank = !hasElements;

  // The format bar and the keyboard context follow the in-place text editor
  useEffect(() => {
    if (editingText === null) return;
    useCanvasViewStore.getState().startTextEdit(editingText);
    setTextEditing(true);
    return () => {
      useCanvasViewStore.getState().stopTextEdit();
      setTextEditing(false);
    };
  }, [editingText]);

  return (
    <div
      ref={artboardContainerRef}
      id={id}
      data-stage="artboard"
      data-testid="stage-artboard"
      data-bare={bare ? "true" : undefined}
      className={`ll-artboard artboard ll:absolute ll:select-none ll:transition-shadow ${isBlank ? "ll-artboard-blank" : ""}`}
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
        backgroundColor: bare ? "transparent" : (background ?? "var(--ll-board-bg)"),
        border: `${STAGE_CONSTANTS.selectionBorderWidth}px solid ${bare ? "transparent" : "var(--ll-board-line)"}`,
        boxShadow: bare ? "none" : "var(--ll-shadow-soft)",
      }}
      onPointerDownCapture={(e) => {
        // where the press began: only a press on the background itself may deselect
        e.currentTarget.dataset.pressOnBackground = e.target === e.currentTarget ? "1" : "0";
      }}
      onClick={(e) => {
        // Clicking directly on artboard background deselects elements. A click whose press began on a layer never
        // does, even when the layer moved from under the pointer during the press (a drag, or a layer animating
        // while recording), which makes the browser report the click on the background.
        const pressedBackground = e.currentTarget.dataset.pressOnBackground !== "0";
        delete e.currentTarget.dataset.pressOnBackground;
        if (e.target === e.currentTarget && pressedBackground && !penJustFinished()) {
          onSelect(null);
        }
      }}
    >
      {/* Empty State ("Start with") when canvas has no layers */}
      {isBlank && (
        <div className="ll:absolute ll:inset-0 ll:flex ll:items-center ll:justify-center ll:pointer-events-auto">
          <EmptyState
            onAddFrame={_onAddFrame}
            onInsert={_onInsert}
            onAskAi={_onAskAi}
          />
        </div>
      )}

      {/* 1. Canvas Size Label / Dropdown Trigger (.lbl / #albl) */}
      {topFrames.length === 0 && (
        <button
          id="albl"
          type="button"
          aria-haspopup="menu"
          aria-expanded={isSizeMenuOpen || openSizeMenuFrameId === "fallback"}
          title="Canvas size"
          className="ll-lbl lbl ll:absolute ll:flex ll:items-center ll:gap-1 ll:cursor-pointer ll:text-secondary ll:rounded-sm ll:outline-none ll:hover:bg-surface-panel ll:hover:text-primary ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
          style={{
            left: labelLeft,
            top: labelTop,
            height: STAGE_CONSTANTS.sizeLabelHeight,
            ...(hideLabel ? { visibility: "hidden" as const } : {}),
            paddingLeft: "var(--ll-spacing-1)",
            paddingRight: "var(--ll-spacing-1)",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSizeMenuAnchorEl(e.currentTarget);
            setOpenSizeMenuFrameId((prev) => (prev ? null : "fallback"));
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

      {topFrames.length > 0 &&
        topFrames.map((frame) => {
          const frameEl = elements[frame.id];
          if (!frameEl) return null;
          const isMirror = Boolean(frame.properties["frame.mirrorOf"]);
          const dev = deviceOfFrame(frame);
          const spec = DEVICE_SPECS[dev];
          const sizeLabel = frameSizeLabel(frame);
          const isPrimary = frame.id === (activeFrame?.id ?? topFrames[0]?.id);
          const fLeft = frameEl.x + STAGE_CONSTANTS.sizeLabelOffsetLeft;
          const fTop = frameEl.y + STAGE_CONSTANTS.sizeLabelOffsetTop;

          const screenHeight = frameViewportHeight(frame);
          const isPreviewing = screenFrames?.[frame.id] !== undefined;
          const fullHeight = fullHeightOf(frame);

          return (
            <React.Fragment key={`frame-label-${frame.id}`}>
            <button
              key={`frame-label-${frame.id}`}
              id={isPrimary ? "albl" : undefined}
              data-testid={isMirror ? "mirror-frame-label" : "frame-size-label"}
              data-frame-id={frame.id}
              type="button"
              aria-haspopup="menu"
              aria-expanded={openSizeMenuFrameId === frame.id}
              title={isMirror ? `${spec.label} linked view` : "Canvas size"}
              className="ll-lbl lbl ll:absolute ll:flex ll:items-center ll:gap-1 ll:cursor-pointer ll:text-secondary ll:rounded-sm ll:outline-none ll:hover:bg-surface-panel ll:hover:text-primary ll:focus-visible:ring-1 ll:focus-visible:ring-primary"
              style={{
                left: fLeft,
                top: fTop,
                height: STAGE_CONSTANTS.sizeLabelHeight,
                paddingLeft: "var(--ll-spacing-1)",
                paddingRight: "var(--ll-spacing-1)",
                // stays readable however far the canvas is zoomed out
                transform: `scale(${labelKeep})`,
                transformOrigin: "left bottom",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(frame.id);
                setSizeMenuAnchorEl(e.currentTarget);
                setOpenSizeMenuFrameId((prev) => (prev === frame.id ? null : frame.id));
              }}
            >
              {isMirror && (
                <Icon
                  icon={Link2}
                  size={STAGE_CONSTANTS.sizeLabelIconSize}
                  className="ll:shrink-0 ll:text-muted"
                  aria-label="Linked mirror view"
                />
              )}
              <span
                id={isPrimary ? "albltx" : undefined}
                className="ll:flex ll:items-center ll:gap-1 ll:whitespace-nowrap ll:text-small ll:font-normal"
              >
                {sizeLabel.label} ·{" "}
                <span className="mono ll:font-mono">{sizeLabel.width}</span>
              </span>
              {editingFrameId === frame.id && editingName && (
                // where edits go is never hidden: a frame edited at a breakpoint says so
                <span
                  data-testid="frame-editing-badge"
                  title={`Changes here are saved for ${editingName} only`}
                  className="ll:whitespace-nowrap ll:rounded-full ll:px-1.5 ll:text-micro ll:font-medium ll:bg-control-active ll:text-primary"
                >
                  Editing {editingName}
                </span>
              )}
              <Icon
                icon={ChevronDown}
                size={STAGE_CONSTANTS.sizeLabelIconSize}
                className="ll:shrink-0 ll:text-muted"
              />
            </button>
            {screenHeight !== null && (
              // Preview: right here, the frame becomes the device's screen and scrolls; off, it is full height
              <div
                className="ll:absolute"
                style={{
                  left: frameEl.x + frameEl.width,
                  // on a frame too narrow on screen for both, it sits a row above the size label
                  top: frameEl.y - 2 - (frameEl.width * zoomScale < 220 ? 22 * labelKeep : 0),
                  transform: `translate(-100%, -100%) scale(${labelKeep})`,
                  transformOrigin: "right bottom",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {/* quiet: only seen on hover, selection, focus, or while previewing (opacity only, so it stays clickable) */}
                <button
                  type="button"
                  data-testid="frame-preview-toggle"
                  data-frame-id={frame.id}
                  aria-pressed={isPreviewing}
                  aria-label={`Preview ${frame.name} as a ${sizeLabel.label} screen`}
                  title={isPreviewing ? "Exit device preview" : "Preview as device screen"}
                  className={`ll:flex ll:items-center ll:justify-center ll:size-6 ll:rounded-sm ll:border-0 ll:cursor-pointer ll:outline-none ll:transition-opacity ll:duration-[120ms] ll:motion-reduce:transition-none ll:hover:opacity-100 ll:focus-visible:opacity-100 ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
                    isPreviewing
                      ? "ll:bg-control-primary ll:text-control-primary-fg"
                      : "ll:bg-transparent ll:text-secondary ll:hover:bg-surface-panel ll:hover:text-primary"
                  } ${isPreviewing || hoveredId === frame.id || selectedIds.includes(frame.id) || editingFrameId === frame.id ? "ll:opacity-100" : "ll:opacity-0"}`}
                  onClick={() => {
                    const on = !isPreviewing;
                    // the frame is looked at, not edited, while previewed: nothing inside it stays selected
                    if (on && !selectedIds.includes(frame.id) && (selectedMirror === frame.id || pageFrameOf(layers ?? {}, rootId ?? null, selectedIds[0]) === frame.id)) onSelect(frame.id);
                    if (!on) scrollDrawnFrame(frame.id, 0);
                    useFramePreviewStore.getState().setPreview(frame.id, on);
                  }}
                >
                  <ProtoIcon name="frameprev" size={16} />
                </button>
              </div>
            )}
            {screenHeight !== null && !isPreviewing && fullHeight > screenHeight && (
              // How much shows on the device's screen: below this line, the page scrolls
              <div
                data-testid="frame-fold-line"
                data-frame-id={frame.id}
                aria-hidden="true"
                className="ll:absolute ll:pointer-events-none"
                style={{ left: frameEl.x, top: frameEl.y + screenHeight, width: frameEl.width, borderTop: `${labelKeep}px dashed var(--ll-accent, #6366f1)`, zIndex: 20 }}
              >
                <span
                  className="ll:absolute ll:right-0 ll:whitespace-nowrap ll:rounded-sm ll:px-1 ll:text-micro ll:text-secondary ll:bg-surface-panel"
                  style={{ top: 2 * labelKeep, transform: `scale(${labelKeep})`, transformOrigin: "right top" }}
                >
                  Fold · {screenHeight}
                </span>
              </div>
            )}
            </React.Fragment>
          );
        })}

      {/* Preset Menu */}
      <Menu
        open={openSizeMenuFrameId !== null || isSizeMenuOpen}
        onClose={() => {
          setOpenSizeMenuFrameId(null);
          setSizeMenuAnchorEl(null);
          setIsSizeMenuOpen(false);
        }}
        anchorEl={sizeMenuAnchorEl}
        width={STAGE_CONSTANTS.sizeDropdownWidth}
        aria-label="Canvas size menu"
      >
        {STAGE_PRESETS.map((p) => {
          const targetDev: DeviceKind = p.id === "375" ? "mobile" : p.id === "768" ? "tablet" : "desktop";
          const activeDev = openSizeMenuFrameId && openSizeMenuFrameId !== "fallback"
            ? exactDeviceOfFrame(layers?.[openSizeMenuFrameId])
            : activePresetId === "375" ? "mobile" : activePresetId === "768" ? "tablet" : "desktop";
          return (
            <MenuItem
              key={p.id}
              onClick={() => {
                if (openSizeMenuFrameId && openSizeMenuFrameId !== "fallback") {
                  switchFrameView(openSizeMenuFrameId, targetDev);
                } else {
                  handleSelectPreset(p.id);
                }
                setOpenSizeMenuFrameId(null);
                setIsSizeMenuOpen(false);
              }}
              checked={targetDev === activeDev}
            >
              <div className="ll:flex ll:items-center ll:justify-between ll:w-full">
                <span>{p.label}</span>
                <span className="ll:font-mono ll:text-muted ll:text-micro">
                  {p.width}
                </span>
              </div>
            </MenuItem>
          );
        })}
      </Menu>

      {/* 2. Artboard Title Row (.atit / #atit) */}
      <div
        id="atit"
        className="ll-atit atit ll:absolute ll:left-0 ll:right-0 ll:top-0 ll:flex ll:items-center ll:px-2.5 ll:font-mono ll:text-secondary ll:bg-surface-panel ll:border-b ll:border-border ll:select-none"
        style={{
          height: STAGE_CONSTANTS.artboardTitleHeight,
          fontSize: "var(--ll-text-micro-size)",
          fontWeight: "var(--ll-text-micro-weight)",
          ...(bare ? { visibility: "hidden" as const } : {}),
        }}
      >
        {title}
      </div>

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

      {references}

      {/* The page: the real tree, drawn by the engine exactly as it is exported. Clicks go to the transparent boxes above it. */}
      {layers && rootId && (
        <div ref={pageRef} data-testid="stage-page" data-frame={playhead} style={{ position: "absolute", inset: 0, pointerEvents: "none", ...(hideLabel ? { visibility: "hidden" as const } : {}) }}>
          {bare && (
            // the page root draws no fill, border or shadow of its own: what is on it sits straight on the canvas
            <style>{`[data-testid="stage-page"] > [data-element-id="${rootId}"] { background: transparent !important; box-shadow: none !important; border: none !important; }`}</style>
          )}
          <RenderLayer layerId={rootId} layers={layers} ctx={engineCtx} root />
        </div>
      )}

      {/* 4a. Onion Skin Overlay (ROADMAP Phase 71: Onion skin - rendered behind live elements) */}
      <OnionSkinOverlay
        selectedIds={selectedIds}
        elements={elements}
        layers={layers}
      />

      {/* 5. Elements Layer */}
      {hasElements &&
        Object.values(elements).map((el) => {
          if (el.hidden) return null;
          const targetDocId = el.targetId ?? el.id;
          // a previewed frame is looked at, not edited: what is inside it can't be picked until Preview is off
          const inFrame = el.mirrorId ?? (layers && rootId ? pageFrameOf(layers, rootId, targetDocId) : null);
          if (inFrame && inFrame !== targetDocId && screenFrames?.[inFrame] !== undefined) return null;
          const layer = layers?.[targetDocId] ?? layers?.[el.id];
          const isHelper = layer?.properties["render.role"] === "helper";
          if (isHelper && canvasViewMode === "preview") return null;

          const engineDrawn = !!layer;
          const isSelected = selectedIds.includes(targetDocId) || (el.id === "headline" && selectedIds.includes("subtitle"));
          const doc = getDocument();
          let evaluatedProps: Record<string, unknown> = layer?.properties ?? {};
          try {
            if (layer) {
              evaluatedProps = evaluate(doc, MAIN_COMPOSITION_ID, targetDocId, motionTimeSec);
            }
          } catch {
            // fallback
          }
          const elementTransform = layer
            ? designTransform(evaluatedProps, layer, el.width, el.height, layers)
            : {};
          const animOpacity = typeof evaluatedProps["appearance.opacity"] === "number"
            ? (evaluatedProps["appearance.opacity"] as number)
            : undefined;

          return (
            <div
              key={el.id}
              id={el.id === "headline" ? "el-text" : el.id === "button" ? "el-button" : el.id === "image" ? "el-image" : `el-${el.id}`}
              data-sel={targetDocId}
              data-element-id={targetDocId}
              data-mirror-id={el.mirrorId}
              data-testid="stage-element"
              data-selected={isSelected ? "true" : "false"}
              data-locked={el.locked ? "true" : "false"}
              data-layer-role={isHelper ? "helper" : "content"}
              className={`ll-element ll:absolute ll:select-none ${
                isSelected ? "ll-sel sel " : ""
              }${
                isHelper
                  ? "ll:cursor-default ll:border-dashed ll:border-[1.5px] ll:border-accent/80 ll:bg-accent/5 "
                  : engineDrawn
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
                ...(elementTransform.transform ? elementTransform : el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}),
                ...(elementTransform.transformOrigin ? { transformOrigin: elementTransform.transformOrigin } : {}),
                ...(animOpacity !== undefined ? { opacity: animOpacity } : {}),
                ...(isHelper ? { border: "1.5px dashed var(--ll-accent, #6366f1)" } : {}),
                ...(el.locked ? { pointerEvents: "none" as const } : {}),
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
                // where the press was, for the click that follows
                e.currentTarget.dataset.press = `${e.clientX},${e.clientY},${e.shiftKey && !selectedIds.includes(targetDocId) ? 1 : 0}`;
                onStartMove?.(el.id, e);
              }}
              onMouseEnter={() => onHover(targetDocId)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                // the press already added it to the selection, and the click after a drag is not a choice
                const [px, py, added] = (e.currentTarget.dataset.press ?? "").split(",").map(Number);
                delete e.currentTarget.dataset.press;
                if (added === 1 || Math.hypot(e.clientX - px, e.clientY - py) > 3) return;
                onSelect(targetDocId, e.shiftKey, { mirrorId: el.mirrorId ?? null });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const view = { mirrorId: el.mirrorId ?? null };
                if (!selectedIds.includes(targetDocId) || (useSelectionStore.getState().selectedMirrorId ?? null) !== view.mirrorId) {
                  onSelect(targetDocId, false, view);
                }
                setContextMenu({
                  coords: { x: e.clientX, y: e.clientY },
                  elementId: targetDocId,
                });
              }}
            >
              {isHelper && (
                <span
                  data-testid="helper-layer-badge"
                  className="ll:absolute ll:top-0 ll:left-0 ll:text-micro ll:px-1 ll:bg-surface-elevated ll:text-accent ll:font-mono ll:rounded-br ll:pointer-events-none ll:select-none ll:border-r ll:border-b ll:border-accent/40"
                >
                  NULL: {layer?.name ?? el.id}
                </span>
              )}
              {/* a thin line is hard to hit: an invisible band around it (turned with it) is part of the layer for clicks */}
              {engineDrawn && layer && ["line", "arrow", "divider"].includes(layer.archetype) && (
                <span
                  aria-hidden="true"
                  data-testid="line-hit-area"
                  style={{
                    position: "absolute",
                    left: -8,
                    right: -8,
                    top: -12,
                    bottom: -12,
                  }}
                />
              )}
              {editingText === el.id && layer && (
                <InlineTextEditor
                  layer={layer}
                  onDone={(value) => {
                    setEditingText(null);
                    const key = layer.archetype === "button" ? "content.label" : "content.text";
                    if (value !== String(layer.properties[key] ?? "")) setLayerProps([targetDocId], { [key]: value }, "Edit text");
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
          <PreviewOutline archetype={drawPreview.archetype} width={drawPreview.width} height={drawPreview.height} zoom={zoomScale} />
        </div>
      )}

      {/* 5c. Vector Pen & Pencil live path overlay */}
      <DraftPath />
      <PathEditLayer containerRef={artboardContainerRef} elements={elements} activeTool={activeTool} zoom={zoomScale} />

      {/* 6. Transform Overlay (Hover, Selection, 8 handles, Dimensions, Snapping) */}
      {/* The scroll of previewed frames: the page is drawn under the canvas's click layer, so this scrolls it */}
      {topFrames.map((frame) => {
        const el = elements[frame.id];
        if (!el || screenFrames?.[frame.id] === undefined) return null;
        return (
          <div
            key={`frame-preview-${frame.id}`}
            data-testid="frame-preview-scroller"
            data-frame-id={frame.id}
            className="ll:absolute"
            style={{ left: el.x, top: el.y, width: el.width, height: el.height, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => scrollDrawnFrame(frame.id, e.currentTarget.scrollTop)}
          >
            <div style={{ height: fullHeightOf(frame) }} />
          </div>
        );
      })}

      {/* Auto layout and grid: padding bands, gap strips and tracks of the selected frame, under the selection handles */}
      {!isBlank && mode === "design" && !editingPath && (
        <>
          <LayoutOverlay selectedIds={selectedIds} elements={elements} layers={layers} zoom={zoomScale} isGesturing={isGesturing} />
          <FlowDropLine zoom={zoomScale} />
        </>
      )}

      {!isBlank && (
        <TransformOverlay
          selectedIds={editingPath ? [] : selectedIds}
          hoveredId={hoveredId}
          elements={elements}
          snapLines={snapLines}
          spacingMarks={spacingMarks}
          onStartMove={onStartMove}
          onStartResize={onStartResize}
          zoom={zoomScale}
        />
      )}

      {/* Corner pin: handles and a grid on the surface a pinned layer lies on */}
      <CornerPinOverlay selectedIds={selectedIds} elements={elements} layers={layers} zoom={zoomScale} />

      {/* Warp mesh: control points and grid on the warped surface */}
      <WarpMeshOverlay selectedIds={selectedIds} elements={elements} layers={layers} zoom={zoomScale} />

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
        zoom={zoomScale}
      />

      {/* 6c. Anchor Overlay (ROADMAP Phase 72: Anchor points & pins) */}
      <AnchorOverlay
        selectedIds={selectedIds}
        elements={elements}
        layers={layers}
        zoom={zoomScale}
      />

      {/* 7. Inline Text Format Bar */}
      <TextFormatBar containerRef={artboardContainerRef} />
      <PathContextBar />

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
