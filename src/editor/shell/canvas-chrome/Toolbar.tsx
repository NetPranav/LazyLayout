"use client";

import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import {
  Frame as FrameIcon,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Hexagon,
  Star,
  Type,
  Image as ImageIcon,
  Plus,
  Play,
  Scissors,
  Spline,
  Pencil,
  Download,
  Undo2,
  Redo2,
  Columns3,
  ChevronDown,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { ProtoIcon } from "@/editor/components/icons/ProtoIcon";
import { motionActions, useMotionModel } from "@/editor/motion-model";
import { timelineOpsAdapter } from "@/editor/panels/timeline/timelineOpsAdapter";
import { logCompileRun } from "@/editor/panels/code-view/codeExport";
import { revealExportSection } from "@/editor/panels/code-view/exportReveal";
import { consoleStore, useConsoleLogs } from "@/editor/panels/console";
import { LogoMark } from "@/editor/components/LogoMark";
import { IconButton } from "@/editor/components/IconButton";
import { Button } from "@/editor/components/Button";
import { Menu, MenuItem, MenuSeparator } from "@/editor/components/Menu";
import { getActivePreset } from "@/editor/motion/feel";
import { springAnim } from "@/editor/motion/ease";
import { prefersReducedMotion } from "@/editor/motion/reducedMotion";
import {
  CANVAS_CHROME_SIZES,
  EASING_OPTIONS,
  type EasingOption,
} from "./constants";
import type { CanvasTool, ShapeTool } from "./types";

export interface ToolbarProps {
  mode?: "design" | "motion" | "code";
  toolbarRef?: React.RefObject<HTMLDivElement | null>;
  zoomBarRef?: React.RefObject<HTMLDivElement | null>;
  activeTool?: CanvasTool | string;
  onSelectTool?: (tool: CanvasTool) => void;
  activeShape?: ShapeTool | string;
  onSelectShape?: (shape: ShapeTool) => void;

  isInsertOpen?: boolean;
  onToggleInsert?: () => void;
  insertButtonRef?: React.RefObject<HTMLButtonElement | null>;

  isAiBoxOpen?: boolean;
  onToggleAiBox?: () => void;
  aiButtonRef?: React.RefObject<HTMLButtonElement | null>;

  isFramePresetsOpen?: boolean;
  onToggleFramePresets?: () => void;
  frameButtonRef?: React.RefObject<HTMLButtonElement | null> | React.RefObject<HTMLElement | null>;

  isSpotlightOpen?: boolean;

  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoom100?: () => void;
  onZoomFit?: () => void;
  onZoomSelection?: () => void;

  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  panelsCollapsed?: boolean;
  onTogglePanels?: () => void;

  onPreview?: () => void;

  // Motion-mode toolbar controls
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onAddKeyframe?: () => void;
  activeEasing?: string;
  onSelectEasing?: (easing: EasingOption) => void;
  onSplitClip?: () => void;

  // Code-mode toolbar controls
  onRunCode?: () => void;
}

const KeyframeAddSvg: LucideIcon = Object.assign(
  React.forwardRef<SVGSVGElement, LucideProps>(function KeyframeAddSvg(
    { size = 20, strokeWidth = 1.5, className = "", ...props },
    ref
  ) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`ll:shrink-0 ${className}`}
        {...props}
      >
        <path d="M12 3l9 9-9 9-9-9Z" />
        <path d="M12 9v6M9 12h6" />
      </svg>
    );
  }),
  { displayName: "KeyframeAddSvg" }
);

const ToolbarPenNib: LucideIcon = Object.assign(
  React.forwardRef<SVGSVGElement, LucideProps>(function ToolbarPenNib({ size = 20, className = "" }, _ref) {
    return <ProtoIcon name="pen2" size={size} className={className} />;
  }),
  { displayName: "ToolbarPenNib" }
);

/** The anchor point tool's glyph: a point on a curve with its handle. Same 24 grid and stroke as the other tool glyphs. */
const ToolbarAnchor: LucideIcon = Object.assign(
  React.forwardRef<SVGSVGElement, LucideProps>(function ToolbarAnchor({ size = 20, strokeWidth = 1.5, className = "" }, ref) {
    return (
      <svg ref={ref} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`ll:shrink-0 ${className}`}>
        <path d="M3 19c4 0 5-6 9-6" />
        <rect x="10" y="11" width="4" height="4" rx="0.5" />
        <path d="M14 13h4" />
        <circle cx="20" cy="13" r="1.5" />
      </svg>
    );
  }),
  { displayName: "ToolbarAnchor" }
);

type PenFlyoutTool = "pen" | "pencil" | "anchor";

/** The pen flyout: the three ways into a vector path. */
const PEN_TOOLS: ReadonlyArray<{ id: PenFlyoutTool; label: string; icon: LucideIcon; shortcut: string }> = [
  { id: "pen", label: "Pen", icon: ToolbarPenNib, shortcut: "P" },
  { id: "pencil", label: "Pencil", icon: Pencil, shortcut: "Shift+P" },
  { id: "anchor", label: "Anchor", icon: ToolbarAnchor, shortcut: "Shift+C" },
];
const isPenFlyoutTool = (t: string): t is PenFlyoutTool => t === "pen" || t === "pencil" || t === "anchor";

const SHAPES: ReadonlyArray<{
  id: ShapeTool;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}> = [
  { id: "box", label: "Rectangle", icon: Square, shortcut: "R" },
  { id: "circle", label: "Ellipse", icon: Circle, shortcut: "O" },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight, shortcut: "Shift+L" },
  { id: "poly", label: "Polygon", icon: Hexagon, shortcut: "Y" },
  { id: "star", label: "Star", icon: Star, shortcut: "Shift+Y" },
];

/** Visual groups of the Shape menu: basic shapes, line and arrow, polygons. */
const SHAPE_GROUP: Record<string, number> = { box: 0, circle: 0, line: 1, arrow: 1, poly: 2, star: 2 };

export const Toolbar: React.FC<ToolbarProps> = ({
  mode = "design",
  toolbarRef: externalToolbarRef,
  zoomBarRef: externalZoomBarRef,
  activeTool = "select",
  onSelectTool,
  activeShape = "box",
  onSelectShape,
  isInsertOpen = false,
  onToggleInsert,
  insertButtonRef,
  isAiBoxOpen = false,
  onToggleAiBox,
  aiButtonRef,
  isFramePresetsOpen = false,
  onToggleFramePresets,
  frameButtonRef,
  isSpotlightOpen = false,
  zoom = 0.59,
  onZoomIn,
  onZoomOut,
  onZoom100,
  onZoomFit,
  onZoomSelection,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  panelsCollapsed = false,
  onTogglePanels,
  onPreview: _onPreview,
  isPlaying: _isPlaying,
  onTogglePlay: _onTogglePlay,
  onAddKeyframe: _onAddKeyframe,
  activeEasing: activeEasingProp,
  onSelectEasing,
  onSplitClip,
  onRunCode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalToolbarRef = useRef<HTMLDivElement>(null);
  const resolvedToolbarRef = externalToolbarRef ?? internalToolbarRef;

  const internalZoomBarRef = useRef<HTMLDivElement>(null);
  const resolvedZoomBarRef = externalZoomBarRef ?? internalZoomBarRef;

  const shapeButtonRef = useRef<HTMLButtonElement | null>(null);
  const penButtonRef = useRef<HTMLButtonElement | null>(null);
  const easingButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [isPenMenuOpen, setIsPenMenuOpen] = useState(false);
  const [lastPenTool, setLastPenTool] = useState<PenFlyoutTool>("pen");
  const [isEasingMenuOpen, setIsEasingMenuOpen] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const [isNarrowLifted, setIsNarrowLifted] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // Design: arrange tools need a selection. Motion: duplicating keys needs selected keys. Code: clearing needs log lines.
  const selectedKeyCount = useMotionModel((st) => Object.keys(st.selectedKeys).length);
  const consoleLineCount = useConsoleLogs().length;
  // Easing shows the selected keyframes' easing (the first one); picking one sets it on all of them (one undo step).
  const selectedKeyEase = useMotionModel((st) => {
    for (const l of st.comp.layers) for (const tr of l.tr) for (const k of tr.keys) if (st.selectedKeys[k.id]) return k.ease;
    return null;
  });
  const activeEasing = activeEasingProp ?? selectedKeyEase ?? "Ease out";
  const applyEasing = (opt: EasingOption) => {
    if (onSelectEasing) {
      onSelectEasing(opt);
      return;
    }
    const ids = Object.keys(useMotionModel.getState().selectedKeys);
    if (ids.length > 0) motionActions.setKeysEase(ids, opt);
  };
  // Narrow canvas detection (prototype lift() lines 10582-10589)
  const checkLift = useCallback(() => {
    const bar = externalToolbarRef?.current ?? internalToolbarRef.current;
    if (!bar) return;
    if (bar.classList.contains("sp-on") || bar.classList.contains("ll-sp-on") || isSpotlightOpen) {
      setIsNarrowLifted(false);
      return;
    }
    const host =
      bar.closest<HTMLElement>('[data-center="true"], main[role="main"], #center, .ll-center') ??
      (bar.offsetParent as HTMLElement | null);
    const zoomEl = externalZoomBarRef?.current ?? internalZoomBarRef.current ?? host?.querySelector<HTMLElement>(".ll-fzoom, .fzoom");
    const cw = host ? host.clientWidth : window.innerWidth;
    const zw = zoomEl && zoomEl.offsetParent !== null ? zoomEl.offsetWidth : 0;
    const bw = bar.offsetWidth;
    const shouldLift = (cw + bw) / 2 > cw - zw - 32;
    setIsNarrowLifted(shouldLift);
  }, [isSpotlightOpen, externalToolbarRef, externalZoomBarRef]);

  useEffect(() => {
    checkLift();
    const bar = externalToolbarRef?.current ?? internalToolbarRef.current;
    const host = bar?.closest<HTMLElement>('[data-center="true"], main[role="main"], #center, .ll-center');

    window.addEventListener("resize", checkLift);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && host) {
      ro = new ResizeObserver(() => checkLift());
      ro.observe(host);
    }
    return () => {
      window.removeEventListener("resize", checkLift);
      ro?.disconnect();
    };
  }, [checkLift, mode, externalToolbarRef]);

  // Mode switch morph animation matching P (lines 10613-10629)
  const prevModeRef = useRef<string>(mode);
  const lastWidthRef = useRef<number>(0);
  const snapKidsRef = useRef<HTMLElement[]>([]);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapLeaves = useCallback(() => {
    const bar = externalToolbarRef?.current ?? internalToolbarRef.current;
    if (!bar || bar.classList.contains("sp-on") || bar.classList.contains("ll-sp-on")) return;
    const currentToolContainer = bar.querySelector(
      ".dtools, .mtools, .ctools, .ll-dtools, .ll-mtools, .ll-ctools"
    );
    if (!currentToolContainer) return;
    const buttons = Array.from(currentToolContainer.children) as HTMLElement[];
    snapKidsRef.current = buttons.map((k) => {
      const clone = k.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      clone.removeAttribute("title");
      clone.removeAttribute("aria-label");
      Array.from(clone.querySelectorAll("*")).forEach((n) => {
        n.removeAttribute("id");
        n.removeAttribute("title");
        n.removeAttribute("aria-label");
      });
      return clone;
    });
    lastWidthRef.current = bar.offsetWidth;
  }, [externalToolbarRef]);

  useEffect(() => {
    snapLeaves();
    window.addEventListener("pointerdown", snapLeaves, true);
    window.addEventListener("keydown", snapLeaves, true);
    return () => {
      window.removeEventListener("pointerdown", snapLeaves, true);
      window.removeEventListener("keydown", snapLeaves, true);
    };
  }, [snapLeaves]);

  useLayoutEffect(() => {
    if (prevModeRef.current === mode) {
      lastWidthRef.current = resolvedToolbarRef.current?.offsetWidth ?? 0;
      return;
    }

    const bar = resolvedToolbarRef.current;
    if (!bar) return;

    // Close any open popovers immediately (P closePop())
    setIsShapeMenuOpen(false);
    setIsEasingMenuOpen(false);
    setIsZoomMenuOpen(false);
    document.querySelectorAll(".tbpop").forEach((p) => p.remove());

    if (prefersReducedMotion()) {
      prevModeRef.current = mode;
      checkLift();
      return;
    }

    const w0 = lastWidthRef.current || bar.offsetWidth;
    const oldSnap = snapKidsRef.current;

    // Clean up any existing ghost and width animation (P kill())
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    bar.querySelectorAll(".tbghost, .ll-tbghost").forEach((g) => g.remove());
    bar.style.width = "";
    bar.style.overflow = "";

    // Create ghost with old buttons fading out (P fadeOut)
    if (oldSnap.length > 0) {
      const gh = document.createElement("div");
      gh.className = "tbghost ll-tbghost";
      gh.setAttribute("aria-hidden", "true");
      oldSnap.forEach((c) => gh.appendChild(c));
      bar.appendChild(gh);

      Array.from(gh.children).forEach((c, i) => {
        (c as HTMLElement).animate(
          [
            { opacity: 1, scale: "1", filter: "blur(0px)" },
            { opacity: 0, scale: "0.7", filter: "blur(4px)" },
          ],
          { duration: 130, delay: i * 10, easing: "ease-out", fill: "forwards" }
        );
      });

      ghostTimerRef.current = setTimeout(() => {
        gh.remove();
      }, 130 + oldSnap.length * 10 + 40);
    }

    prevModeRef.current = mode;

    // Measure new natural width immediately in layout effect
    const w1 = bar.offsetWidth;
    const preset = getActivePreset();

    // Animate width (P springW)
    if (Math.abs(w0 - w1) >= 1) {
      bar.style.overflow = "hidden";
      const wAnim = springAnim(
        bar,
        [{ width: `${w0}px` }, { width: `${w1}px` }],
        preset.shape[0],
        preset.shape[1]
      );
      if (wAnim) {
        const done = () => {
          bar.style.overflow = "";
          bar.style.width = "";
        };
        wAnim.onfinish = done;
        wAnim.oncancel = done;
      }
    }

    // Pop in new buttons (P popIn)
    const newToolContainer = bar.querySelector(
      ".dtools, .mtools, .ctools, .ll-dtools, .ll-mtools, .ll-ctools"
    );
    if (newToolContainer) {
      const newButtons = Array.from(newToolContainer.children) as HTMLElement[];
      newButtons.forEach((k, i) => {
        springAnim(
          k,
          [
            { opacity: 0, scale: "0.6", filter: "blur(4px)" },
            { opacity: 1, scale: "1", filter: "blur(0px)" },
          ],
          preset.pop[0],
          preset.pop[1],
          { delay: 60 + i * 14, fill: "backwards" }
        );
      });
    }

    checkLift();
    setTimeout(snapLeaves, 500);
  }, [mode, checkLift, snapLeaves, resolvedToolbarRef]);

  // WAI-ARIA Toolbar roving arrow-key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const buttons = Array.from(
        containerRef.current.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])"
        )
      );
      const currentIndex = buttons.indexOf(
        document.activeElement as HTMLButtonElement
      );
      if (currentIndex === -1) return;

      let targetIndex = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        targetIndex = (currentIndex + 1) % buttons.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        targetIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        targetIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        targetIndex = buttons.length - 1;
      }

      if (targetIndex !== -1 && buttons[targetIndex]) {
        setFocusedIndex(targetIndex);
        buttons[targetIndex].focus();
      }
    },
    []
  );

  const handleRunCodeClick = () => {
    if (isRunningCode) return;
    setIsRunningCode(true);
    logCompileRun();
    onRunCode?.();
    setTimeout(() => {
      setIsRunningCode(false);
    }, 1200);
  };

  const shapeIcon = (SHAPES.find((sh) => sh.id === activeShape) ?? SHAPES[0]).icon;
  const penTool: PenFlyoutTool = isPenFlyoutTool(activeTool) ? activeTool : lastPenTool;
  const penIcon = (PEN_TOOLS.find((t) => t.id === penTool) ?? PEN_TOOLS[0]).icon;
  const zoomPercentage = `${Math.round(zoom * 100)}%`;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="ll:contents"
    >
      {/* Center Floating Toolbar - 16px above bottom edge, or lifted to 72px when narrow */}
      <div
        ref={resolvedToolbarRef}
        id="tools"
        role="toolbar"
        aria-label="Canvas tools"
        data-toolbar="main"
        className={`ll-fbar fbar ll-ftool ftool ll:[&_.ll-ib[aria-pressed=true]]:bg-(--ll-control-primary-bg)! ll:[&_.ll-ib[aria-pressed=true]]:text-(--ll-control-primary-fg)! ${
          isNarrowLifted ? "ll-tb-hi tb-hi" : ""
        }`}
      >
        {/* DESIGN MODE TOOLBAR: Select, Hand, Frame, Shape ▾ (Pen inside), Pen, Text, Insert, AI */}
        {mode === "design" && (
          <div className="dtools ll-dtools ll:flex ll:items-center ll:gap-0.5">
            {/* Select (V) */}
            <IconButton
              size="lg"
              data-tool="select"
              data-tb="vsel"
              aria-label="Select (V)"
              tooltip="Select (V)"
              pressed={activeTool === "select"}
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onFocus={() => setFocusedIndex(0)}
              onClick={() => onSelectTool?.("select")}
              icon={<ProtoIcon name="cursor2" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Hand (H) */}
            <IconButton
              size="lg"
              data-tool="hand"
              data-tb="vhand"
              aria-label="Hand (H)"
              tooltip="Hand (H)"
              pressed={activeTool === "hand"}
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onFocus={() => setFocusedIndex(1)}
              onClick={() => onSelectTool?.("hand")}
              icon={<ProtoIcon name="hand2" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Frame (F) - opens FramePresetsPanel */}
            <IconButton
              ref={frameButtonRef as React.Ref<HTMLButtonElement>}
              size="lg"
              data-tool="frame"
              aria-label="Frame (F)"
              tooltip="Frame (F)"
              aria-haspopup="dialog"
              aria-expanded={isFramePresetsOpen}
              pressed={activeTool === "frame" || isFramePresetsOpen}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={() => {
                onSelectTool?.("frame");
                onToggleFramePresets?.();
              }}
              icon={<Icon icon={FrameIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Shape (with Pen inside) - Item 2: no caret */}
            <IconButton
              ref={shapeButtonRef}
              size="lg"
              id="shapebtn"
              data-tool="shape"
              aria-label="Shape"
              tooltip="Shape"
              aria-haspopup="menu"
              aria-expanded={isShapeMenuOpen}
              pressed={activeTool === "shape" || isShapeMenuOpen}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => {
                onSelectTool?.("shape");
                setIsShapeMenuOpen((prev) => !prev);
              }}
              icon={<Icon icon={shapeIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Pen flyout: Pen (P), Pencil (Shift+P), Anchor (Shift+C) */}
            <IconButton
              ref={penButtonRef}
              size="lg"
              data-tool="pen"
              aria-label="Pen tools"
              tooltip="Pen (P)"
              aria-haspopup="menu"
              aria-expanded={isPenMenuOpen}
              pressed={isPenFlyoutTool(activeTool) || isPenMenuOpen}
              tabIndex={focusedIndex === 4 ? 0 : -1}
              onFocus={() => setFocusedIndex(4)}
              onClick={() => {
                onSelectTool?.(penTool);
                setIsPenMenuOpen((prev) => !prev);
              }}
              icon={<Icon icon={penIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Text (T) */}
            <IconButton
              size="lg"
              data-tool="text"
              aria-label="Text (T)"
              tooltip="Text (T)"
              pressed={activeTool === "text"}
              tabIndex={focusedIndex === 5 ? 0 : -1}
              onFocus={() => setFocusedIndex(5)}
              onClick={() => onSelectTool?.("text")}
              icon={<Icon icon={Type} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Image */}
            <IconButton
              size="lg"
              data-tool="image"
              aria-label="Image"
              tooltip="Image"
              pressed={activeTool === "image"}
              tabIndex={focusedIndex === 6 ? 0 : -1}
              onFocus={() => setFocusedIndex(6)}
              onClick={() => onSelectTool?.("image")}
              icon={<Icon icon={ImageIcon} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep"
              aria-hidden="true"
            />

            {/* Insert (+) */}
            <IconButton
              ref={insertButtonRef}
              size="lg"
              id="plusbtn"
              data-testid="toolbar-insert"
              aria-label="Insert"
              tooltip="Insert (I)"
              aria-haspopup="dialog"
              aria-expanded={isInsertOpen}
              pressed={isInsertOpen}
              tabIndex={focusedIndex === 7 ? 0 : -1}
              onFocus={() => setFocusedIndex(7)}
              onClick={onToggleInsert}
              icon={<Icon icon={Plus} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Ask AI (/) */}
            <IconButton
              ref={aiButtonRef}
              size="lg"
              id="aibtn"
              aria-label="Ask AI (/)"
              tooltip="Ask AI (/)"
              aria-haspopup="dialog"
              aria-expanded={isAiBoxOpen}
              pressed={isAiBoxOpen}
              tabIndex={focusedIndex === 8 ? 0 : -1}
              onFocus={() => setFocusedIndex(8)}
              onClick={onToggleAiBox}
              icon={<span className="ll-logo"><LogoMark size={CANVAS_CHROME_SIZES.iconAi} /></span>}
            />
          </div>
        )}

        {/* MOTION MODE TOOLBAR: Select, Hand, [gsep], Add keyframe (disabled), Split, Easing ▾ */}
        {mode === "motion" && (
          <div className="mtools ll-mtools ll:flex ll:items-center ll:gap-0.5">
            {/* Select (V) */}
            <IconButton
              size="lg"
              data-tool="select"
              data-tb="vsel"
              aria-label="Select (V)"
              tooltip="Select (V)"
              pressed={activeTool === "select"}
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onFocus={() => setFocusedIndex(0)}
              onClick={() => onSelectTool?.("select")}
              icon={<ProtoIcon name="cursor2" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Hand (H) */}
            <IconButton
              size="lg"
              data-tool="hand"
              data-tb="vhand"
              aria-label="Hand (H)"
              tooltip="Hand (H)"
              pressed={activeTool === "hand"}
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onFocus={() => setFocusedIndex(1)}
              onClick={() => onSelectTool?.("hand")}
              icon={<ProtoIcon name="hand2" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep"
              aria-hidden="true"
            />

            {/* Add keyframe (K) -> timelineOpsAdapter.addKeyframeAtPlayhead (core setKeyframeAt) */}
            <IconButton
              size="lg"
              data-mact="kf"
              aria-label="Add keyframe (K)"
              tooltip="Add keyframe (K)"
              onClick={() => timelineOpsAdapter.addKeyframeAtPlayhead()}
              tabIndex={-1}
              icon={<Icon icon={KeyframeAddSvg} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Split clip (C) */}
            <IconButton
              size="lg"
              data-tb="split"
              data-mtool="split"
              aria-label="Split clip (C)"
              tooltip="Split clip (C)"
              pressed={activeTool === "split"}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={() => {
                if (onSplitClip) onSplitClip();
                else timelineOpsAdapter.splitClipAtPlayhead();
              }}
              icon={<Icon icon={Scissors} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Easing - Item 2: no caret */}
            <IconButton
              ref={easingButtonRef}
              id="easingbtn"
              size="lg"
              data-tb="ease"
              aria-label="Easing"
              tooltip="Easing"
              aria-haspopup="menu"
              aria-expanded={isEasingMenuOpen}
              pressed={isEasingMenuOpen}
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={() => setIsEasingMenuOpen((prev) => !prev)}
              icon={<Icon icon={Spline} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep"
              aria-hidden="true"
            />

            {/* Add marker at the playhead (M) -> motionActions.addMarker */}
            <IconButton
              size="lg"
              data-mact="marker"
              aria-label="Add marker (M)"
              tooltip="Add marker (M)"
              tabIndex={focusedIndex === 20 ? 0 : -1}
              onFocus={() => setFocusedIndex(20)}
              onClick={() => motionActions.addMarker(useMotionModel.getState().playhead)}
              icon={<ProtoIcon name="flag" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Work area starts here (I) -> motionActions.setWorkArea */}
            <IconButton
              size="lg"
              data-mact="wa-in"
              aria-label="Work area in at playhead (I)"
              tooltip="Work area in at playhead (I)"
              tabIndex={focusedIndex === 21 ? 0 : -1}
              onFocus={() => setFocusedIndex(21)}
              onClick={() => {
                const st = useMotionModel.getState();
                motionActions.setWorkArea(Math.min(st.playhead, st.wa.b - 1), st.wa.b);
              }}
              icon={<ProtoIcon name="wain" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Work area ends here (O) -> motionActions.setWorkArea */}
            <IconButton
              size="lg"
              data-mact="wa-out"
              aria-label="Work area out at playhead (O)"
              tooltip="Work area out at playhead (O)"
              tabIndex={focusedIndex === 22 ? 0 : -1}
              onFocus={() => setFocusedIndex(22)}
              onClick={() => {
                const st = useMotionModel.getState();
                motionActions.setWorkArea(st.wa.a, Math.max(st.playhead, st.wa.a + 1));
              }}
              icon={<ProtoIcon name="waout" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Duplicate the selected keyframes (Ctrl+D) -> motionActions.duplicateKeys */}
            <IconButton
              size="lg"
              data-mact="dupkeys"
              aria-label="Duplicate keyframes (Ctrl+D)"
              tooltip="Duplicate keyframes (Ctrl+D)"
              disabled={selectedKeyCount === 0}
              tabIndex={focusedIndex === 23 ? 0 : -1}
              onFocus={() => setFocusedIndex(23)}
              onClick={() => motionActions.duplicateKeys()}
              icon={<ProtoIcon name="dup" size={CANVAS_CHROME_SIZES.iconLg} />}
            />
          </div>
        )}

        {/* CODE MODE TOOLBAR: Inspect, Hand, [gsep], Run, Export ▾ */}
        {mode === "code" && (
          <div className="ctools ll-ctools ll:flex ll:items-center ll:gap-0.5">
            {/* Inspect (V) */}
            <IconButton
              size="lg"
              data-tool="select"
              data-tb="vsel"
              aria-label="Inspect (V)"
              tooltip="Inspect (V)"
              pressed={activeTool === "select"}
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onFocus={() => setFocusedIndex(0)}
              onClick={() => onSelectTool?.("select")}
              icon={<ProtoIcon name="cursor2" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Hand (H) */}
            <IconButton
              size="lg"
              data-tool="hand"
              data-tb="vhand"
              aria-label="Hand (H)"
              tooltip="Hand (H)"
              pressed={activeTool === "hand"}
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onFocus={() => setFocusedIndex(1)}
              onClick={() => onSelectTool?.("hand")}
              icon={<ProtoIcon name="hand2" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep"
              aria-hidden="true"
            />

            {/* Run */}
            <IconButton
              size="lg"
              data-tb="run"
              aria-label="Run"
              tooltip="Run"
              aria-busy={isRunningCode}
              tabIndex={focusedIndex === 2 ? 0 : -1}
              onFocus={() => setFocusedIndex(2)}
              onClick={handleRunCodeClick}
              icon={<Icon icon={Play} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Export - Item 2: no caret */}
            <IconButton
              id="exportbtn"
              size="lg"
              data-tb="exp"
              aria-label="Export"
              tooltip="Export"
              tabIndex={focusedIndex === 3 ? 0 : -1}
              onFocus={() => setFocusedIndex(3)}
              onClick={revealExportSection}
              icon={<Icon icon={Download} size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Separator */}
            <span
              className="ll-gsep gsep"
              aria-hidden="true"
            />

            {/* Fit to screen (Shift+1) -> the canvas zoom-to-fit */}
            <IconButton
              size="lg"
              data-tb="fit"
              aria-label="Fit to screen (Shift+1)"
              tooltip="Fit to screen (Shift+1)"
              tabIndex={focusedIndex === 20 ? 0 : -1}
              onFocus={() => setFocusedIndex(20)}
              onClick={onZoomFit}
              icon={<ProtoIcon name="fit" size={CANVAS_CHROME_SIZES.iconLg} />}
            />

            {/* Clear console -> consoleStore.clear */}
            <IconButton
              size="lg"
              data-tb="clearlog"
              aria-label="Clear console"
              tooltip="Clear console"
              disabled={consoleLineCount === 0}
              tabIndex={focusedIndex === 21 ? 0 : -1}
              onFocus={() => setFocusedIndex(21)}
              onClick={() => consoleStore.clear()}
              icon={<ProtoIcon name="trash" size={CANVAS_CHROME_SIZES.iconLg} />}
            />
          </div>
        )}
      </div>

      {/* Right Floating Zoom & History Controls - slides aside when Spotlight is open via spring */}
      <div
        ref={resolvedZoomBarRef}
        role="toolbar"
        aria-label="Zoom and Viewport actions"
        data-toolbar="zoom"
        className="ll-fbar fbar ll-fzoom fzoom"
      >
        {/* Toggle Panels */}
        <IconButton
          size="tall"
          id="panelbtn"
          aria-label="Show or hide panels (Ctrl+\)"
          tooltip="Show or hide panels (Ctrl+\)"
          pressed={panelsCollapsed}
          tabIndex={focusedIndex === 9 ? 0 : -1}
          onFocus={() => setFocusedIndex(9)}
          onClick={onTogglePanels}
          icon={<Icon icon={Columns3} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Undo */}
        <IconButton
          size="md"
          id="undobtn"
          aria-label="Undo (Ctrl+Z)"
          tooltip="Undo (Ctrl+Z)"
          disabled={!canUndo}
          tabIndex={focusedIndex === 10 ? 0 : -1}
          onFocus={() => setFocusedIndex(10)}
          onClick={onUndo}
          icon={<Icon icon={Undo2} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Redo */}
        <IconButton
          size="md"
          id="redobtn"
          aria-label="Redo (Ctrl+Shift+Z)"
          tooltip="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          tabIndex={focusedIndex === 11 ? 0 : -1}
          onFocus={() => setFocusedIndex(11)}
          onClick={onRedo}
          icon={<Icon icon={Redo2} size={CANVAS_CHROME_SIZES.iconLg} />}
        />

        {/* Separator */}
        <span
          className="ll-gsep gsep"
          aria-hidden="true"
        />

        {/* Zoom Trigger Button */}
        <Button
          ref={zoomButtonRef}
          id="zoombtn"
          variant="ghost"
          size="sm"
          title="Zoom"
          aria-haspopup="menu"
          aria-expanded={isZoomMenuOpen}
          tabIndex={focusedIndex === 12 ? 0 : -1}
          onFocus={() => setFocusedIndex(12)}
          onClick={() => setIsZoomMenuOpen((prev) => !prev)}
          rightIcon={<Icon icon={ChevronDown} size={CANVAS_CHROME_SIZES.iconSm} className="ll:text-muted" />}
          className="ll-zb ll:h-10 ll:px-2 ll:font-mono ll:text-body ll:font-medium ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
        >
          <span className="ll-mono ll:font-mono" id="pct">{zoomPercentage}</span>
        </Button>
      </div>

      {/* Shape Picker Menu (Design mode) */}
      <Menu
        open={isShapeMenuOpen}
        onClose={() => setIsShapeMenuOpen(false)}
        anchorRef={shapeButtonRef}
        aria-label="Shape options"
        width={CANVAS_CHROME_SIZES.shapeMenuWidth}
      >
        {SHAPES.map((sh, i) => {
          const isCurrent = activeShape === sh.id;
          const groupStart = i > 0 && SHAPE_GROUP[sh.id] !== SHAPE_GROUP[SHAPES[i - 1].id];
          return (
            <React.Fragment key={sh.id}>
              {groupStart && <MenuSeparator className="ll:mx-2" />}
              <MenuItem
                icon={
                  <span className={isCurrent ? "ll:text-primary" : "ll:text-secondary"}>
                    <Icon icon={sh.icon} size={CANVAS_CHROME_SIZES.iconMd} />
                  </span>
                }
                shortcut={sh.shortcut}
                checked={activeShape === sh.id}
                className={
                  isCurrent
                    ? "ll:bg-[color-mix(in_srgb,var(--ll-text-primary)_12%,transparent)] ll:text-primary ll:font-medium"
                    : ""
                }
                onClick={() => {
                  onSelectShape?.(sh.id);
                  onSelectTool?.("shape");
                  setIsShapeMenuOpen(false);
                }}
              >
                {sh.label}
              </MenuItem>
            </React.Fragment>
          );
        })}
      </Menu>

      {/* Pen flyout (Design mode) */}
      <Menu
        open={isPenMenuOpen}
        onClose={() => setIsPenMenuOpen(false)}
        anchorRef={penButtonRef}
        aria-label="Pen options"
        width={CANVAS_CHROME_SIZES.shapeMenuWidth}
      >
        {PEN_TOOLS.map((t) => {
          const isCurrent = activeTool === t.id;
          return (
            <MenuItem
              key={t.id}
              icon={
                <span className={isCurrent ? "ll:text-primary" : "ll:text-secondary"}>
                  <Icon icon={t.icon} size={CANVAS_CHROME_SIZES.iconMd} />
                </span>
              }
              shortcut={t.shortcut}
              checked={isCurrent}
              className={isCurrent ? "ll:bg-[color-mix(in_srgb,var(--ll-text-primary)_12%,transparent)] ll:text-primary ll:font-medium" : ""}
              onClick={() => {
                setLastPenTool(t.id);
                onSelectTool?.(t.id);
                setIsPenMenuOpen(false);
              }}
            >
              {t.label}
            </MenuItem>
          );
        })}
      </Menu>

      {/* Easing Menu (Motion mode) */}
      <Menu
        open={isEasingMenuOpen}
        onClose={() => setIsEasingMenuOpen(false)}
        anchorRef={easingButtonRef}
        aria-label="Easing options"
        width={CANVAS_CHROME_SIZES.easingMenuWidth}
      >
        {EASING_OPTIONS.map((opt) => (
          <MenuItem
            key={opt}
            checked={activeEasing === opt}
            onClick={() => {
              applyEasing(opt);
              setIsEasingMenuOpen(false);
            }}
          >
            {opt}
          </MenuItem>
        ))}
      </Menu>

      {/* Zoom menu */}
      <Menu
        open={isZoomMenuOpen}
        onClose={() => setIsZoomMenuOpen(false)}
        anchorRef={zoomButtonRef}
        aria-label="Zoom actions"
        width={CANVAS_CHROME_SIZES.zoomMenuWidth}
      >
        <MenuItem
          shortcut="Ctrl++"
          onClick={() => {
            onZoomIn?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom in
        </MenuItem>
        <MenuItem
          shortcut="Ctrl+-"
          onClick={() => {
            onZoomOut?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom out
        </MenuItem>
        <MenuItem
          shortcut="Ctrl+0"
          onClick={() => {
            onZoom100?.();
            setIsZoomMenuOpen(false);
          }}
        >
          <span className="ll-mono">100%</span>
        </MenuItem>
        <MenuItem
          shortcut="Shift+1"
          onClick={() => {
            onZoomFit?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Fit to screen
        </MenuItem>
        <MenuItem
          shortcut="Shift+2"
          onClick={() => {
            onZoomSelection?.();
            setIsZoomMenuOpen(false);
          }}
        >
          Zoom to selection
        </MenuItem>
      </Menu>
    </div>
  );
};
