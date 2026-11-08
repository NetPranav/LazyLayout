"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useId,
} from "react";
import { createPortal } from "react-dom";
import {
  Search,
  CommandGlyph as CommandIcon,
  File,
  ImageGlyph as ImageIcon,
  Sliders,
  Sparkles,
  Zap,
  Frame,
  Type,
  Square,
  Play,
  Palette,
  Grid,
  type LucideIcon,
} from "./glyphs";
import { Icon } from "@/editor/components/Icon";
import { getAllCommands, runCommand, isCommandAvailable } from "@/core/commands";
import { getDocument } from "@/core/store/documentState";
import { useProjectStore } from "@/core/store/useProjectStore";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { applyTheme, type Theme } from "@/editor/components/ThemeToggle";
import { applyFeel, getActivePreset } from "@/editor/motion/feel";
import { prefersReducedMotion } from "@/editor/motion/reducedMotion";
import { springAnim, cancelAll } from "@/editor/motion/ease";
import { useMounted } from "@/editor/components/useMounted";
import {
  CANVAS_CHROME_SIZES,
  SPOTLIGHT_PREFIX_MAP,
  SPOTLIGHT_NAMES,
} from "./constants";
import "./spotlight.css";

const SPOTLIGHT_RUN_DELAY_MS = 50;

export type SpotlightPrefixKey = keyof typeof SPOTLIGHT_PREFIX_MAP;
export type SpotlightCategory = (typeof SPOTLIGHT_PREFIX_MAP)[SpotlightPrefixKey] | "asset" | "set";

export interface SpotlightItem {
  key: string;
  type: SpotlightCategory;
  label: string;
  categoryName?: string;
  shortcut?: string;
  meta?: string;
  icon: LucideIcon;
  disabled?: boolean;
  disabledReason?: string;
  run?: () => void;
  score?: number;
  matchIndices?: number[];
}

export interface SpotlightSection {
  name: string;
  items: SpotlightItem[];
  big?: boolean;
}

export interface SpotlightProps {
  open: boolean;
  onClose: () => void;
  toolbarRef?: React.RefObject<HTMLDivElement | null>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  theme?: string;
  onThemeChange?: (theme: string) => void;
  motionFeel?: string;
  onMotionFeelChange?: (feel: string) => void;
  showRulers?: boolean;
  onToggleRulers?: () => void;
  pixelGrid?: boolean;
  onTogglePixelGrid?: () => void;
  snapObjects?: boolean;
  onToggleSnapObjects?: () => void;
  snapGuides?: boolean;
  onToggleSnapGuides?: () => void;
  checkerboard?: boolean;
  onToggleCheckerboard?: () => void;
  onSelectTool?: (tool: string) => void;
  onSelectMode?: (mode: string) => void;
  onZoomSelection?: () => void;
  onZoomFit?: () => void;
  onZoom100?: () => void;
}

/**
 * Fuzzy/substring match algorithm ported from prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` lines 10106-10111.
 */
function matchScore(str: string, query: string): { s: number; i: number[] } | null {
  const l = str.toLowerCase();
  const q = query.toLowerCase();
  const idx = l.indexOf(q);
  const matchIndices: number[] = [];

  if (idx > -1) {
    for (let j = 0; j < q.length; j++) {
      matchIndices.push(idx + j);
    }
    const score = (idx === 0 ? 100 : /[\s-]/.test(l.charAt(idx - 1)) ? 80 : 60) - l.length * 0.1;
    return { s: score, i: matchIndices };
  }

  let p = 0;
  for (let j = 0; j < l.length && p < q.length; j++) {
    if (l.charAt(j) === q.charAt(p)) {
      matchIndices.push(j);
      p++;
    }
  }

  if (p === q.length) {
    return { s: 20 - l.length * 0.1, i: matchIndices };
  }

  return null;
}

function renderHighlighted(label: string, matchIndices?: number[]): React.ReactNode {
  if (!matchIndices || matchIndices.length === 0) return label;
  const nodes: React.ReactNode[] = [];
  let currentBold: string[] = [];
  let currentPlain: string[] = [];

  const flushPlain = () => {
    if (currentPlain.length > 0) {
      nodes.push(currentPlain.join(""));
      currentPlain = [];
    }
  };

  const flushBold = () => {
    if (currentBold.length > 0) {
      nodes.push(<b key={`b-${nodes.length}`}>{currentBold.join("")}</b>);
      currentBold = [];
    }
  };

  for (let i = 0; i < label.length; i++) {
    if (matchIndices.includes(i)) {
      flushPlain();
      currentBold.push(label.charAt(i));
    } else {
      flushBold();
      currentPlain.push(label.charAt(i));
    }
  }
  flushBold();
  flushPlain();

  return <>{nodes}</>;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  open,
  onClose,
  toolbarRef: _toolbarRef,
  containerRef: _containerRef,
  theme = "paper",
  onThemeChange,
  motionFeel = "bouncy",
  onMotionFeelChange,
  showRulers,
  onToggleRulers,
  pixelGrid,
  onTogglePixelGrid,
  snapObjects,
  onToggleSnapObjects,
  snapGuides,
  onToggleSnapGuides,
  checkerboard,
  onToggleCheckerboard,
  onSelectTool,
  onSelectMode,
  onZoomSelection,
  onZoomFit,
  onZoom100,
}) => {
  const [query, setQuery] = useState("");
  const [prefixMode, setPrefixMode] = useState<SpotlightCategory | "">("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const isMounted = useMounted();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setPrefixMode("");
      setSelectedIndex(0);
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLElement>(null);
  const fldRef = useRef<HTMLDivElement>(null);
  const resRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const prevHlTopRef = useRef<number>(0);
  const prevHlHRef = useRef<number>(32);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputId = useId();

  const clearTimers = useCallback(() => {
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      animTimersRef.current = animTimersRef.current.filter((x) => x !== t);
      fn();
    }, ms);
    animTimersRef.current.push(t);
    return t;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Global keydown listeners for Ctrl+K, Cmd+K, and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (open) {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Gather real commands from src/core/commands
  const commandPool: SpotlightItem[] = useMemo(() => {
    const coreCmds = getAllCommands();
    const items: SpotlightItem[] = [];

    // Real commands from registry
    for (const cmd of coreCmds) {
      const isAvailable = isCommandAvailable(cmd);
      let shortcutStr = "";
      if (typeof cmd.keybinding === "string") {
        shortcutStr = cmd.keybinding;
      } else if (Array.isArray(cmd.keybinding) && cmd.keybinding.length > 0) {
        shortcutStr = cmd.keybinding[0];
      }

      items.push({
        key: `c:${cmd.id}`,
        type: "cmd",
        label: cmd.title,
        categoryName: cmd.category || "Commands",
        shortcut: shortcutStr,
        icon: CommandIcon,
        disabled: !isAvailable,
        disabledReason: !isAvailable ? "Not available in current context" : undefined,
        run: () => {
          runCommand(cmd.id);
        },
      });
    }

    // Common UI actions matching prototype P
    const pItems: Array<{
      name: string;
      shortcut?: string;
      icon: LucideIcon;
      run?: () => void;
      disabled?: boolean;
      disabledReason?: string;
    }> = [
      {
        name: "Zoom to fit",
        shortcut: "Shift+1",
        icon: Zap,
        run: onZoomFit,
        disabled: !onZoomFit,
        disabledReason: !onZoomFit ? "Zoom is not wired here" : undefined,
      },
      {
        name: "Zoom to 100%",
        shortcut: "Ctrl+0",
        icon: Zap,
        run: onZoom100,
        disabled: !onZoom100,
        disabledReason: !onZoom100 ? "Zoom is not wired here" : undefined,
      },
      {
        name: "Zoom to selection",
        shortcut: "Shift+2",
        icon: Zap,
        run: onZoomSelection,
        disabled: !onZoomSelection,
        disabledReason: !onZoomSelection ? "Zoom is not wired here" : undefined,
      },
      {
        name: "Split at playhead",
        shortcut: "S",
        icon: Zap,
        disabled: true,
        disabledReason: "No engine command for split",
        run: undefined,
      },
      {
        name: "Insert frame",
        shortcut: "F",
        icon: Frame,
        run: () => onSelectTool?.("frame"),
      },
      {
        name: "Toggle rulers",
        shortcut: "Shift+R",
        icon: Grid,
        run: () => onToggleRulers?.(),
      },
      {
        name: "Switch theme",
        icon: Palette,
        run: () => {
          const nextTheme = theme === "darkroom" ? "warm" : "darkroom";
          onThemeChange?.(nextTheme);
          applyTheme(nextTheme as Theme);
        },
      },
      {
        name: "Go to Motion",
        icon: Play,
        run: () => onSelectMode?.("motion"),
      },
      {
        name: "Go to Design",
        icon: Square,
        run: () => onSelectMode?.("design"),
      },
      {
        name: "Add keyframe",
        shortcut: "K",
        icon: Sparkles,
        disabled: true,
        disabledReason: "No engine command for add keyframe",
        run: undefined,
      },
    ];

    const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const pi of pItems) {
      const piNorm = normalizeTitle(pi.name);
      // Skip hand-written rows when a registry command has the same title (Item 8: no duplicate "Zoom to Selection")
      if (!items.some((it) => normalizeTitle(it.label) === piNorm)) {
        items.push({
          key: `c:p:${pi.name}`,
          type: "cmd",
          label: pi.name,
          categoryName: "Commands",
          shortcut: pi.shortcut,
          meta: pi.shortcut ? undefined : "Command",
          icon: pi.icon,
          disabled: pi.disabled,
          disabledReason: pi.disabledReason,
          run: pi.run,
        });
      }
    }

    return items;
  }, [
    theme,
    onThemeChange,
    onSelectMode,
    onSelectTool,
    onToggleRulers,
    onZoomSelection,
    onZoomFit,
    onZoom100,
  ]);

  // Layers from store
  const layerPool: SpotlightItem[] = useMemo(() => {
    if (!open) return [];
    try {
      const doc = getDocument();
      const layers = doc?.layers ? Object.values(doc.layers) : [];
      return layers.map((l) => ({
        key: `l:${l.id}`,
        type: "layer",
        label: l.name || l.id,
        categoryName: "Layers",
        meta: l.archetype || "Layer",
        icon: l.archetype === "text" ? Type : l.archetype === "container" ? Frame : Square,
        run: () => {
          useSelectionStore.getState().select(l.id, "element");
          onZoomSelection?.();
        },
      }));
    } catch {
      return [];
    }
  }, [onZoomSelection, open]);

  // Pages from store
  const pagePool: SpotlightItem[] = useMemo(() => {
    if (!open) return [];
    try {
      const pagesObj = useProjectStore.getState().pages;
      const pages = pagesObj ? Object.values(pagesObj) : [];
      return pages.map((p) => ({
        key: `p:${p.id}`,
        type: "page",
        label: p.name || p.id,
        categoryName: "Pages",
        meta: "Page",
        icon: File,
        run: () => {
          useProjectStore.getState().setActivePage(p.id);
        },
      }));
    } catch {
      return [];
    }
  }, [open]);

  // Settings pool
  const settingsPool: SpotlightItem[] = useMemo(() => {
    const items: SpotlightItem[] = [];

    // Theme options
    const themes: Theme[] = [
      "paper",
      "white",
      "warm",
      "lilac",
      "noir",
      "dark",
      "graphite",
      "darkroom",
    ];
    for (const th of themes) {
      items.push({
        key: `s:th:${th}`,
        type: "set",
        label: `${th.charAt(0).toUpperCase() + th.slice(1)} theme`,
        categoryName: "Settings",
        meta: theme === th ? "Active" : "Theme",
        icon: Palette,
        run: () => {
          onThemeChange?.(th);
          applyTheme(th);
        },
      });
    }

    // Motion feel options
    const feels = ["bouncy", "lively", "smooth"] as const;
    for (const f of feels) {
      items.push({
        key: `s:feel:${f}`,
        type: "set",
        label: `${f.charAt(0).toUpperCase() + f.slice(1)} motion`,
        categoryName: "Settings",
        meta: motionFeel === f ? "Active" : "Feel",
        icon: Sparkles,
        run: () => {
          onMotionFeelChange?.(f);
          applyFeel(f);
        },
      });
    }

    // View options toggles
    items.push({
      key: "s:rulers",
      type: "set",
      label: "Show Rulers",
      categoryName: "Settings",
      meta: showRulers ? "On" : "Off",
      icon: Grid,
      run: () => onToggleRulers?.(),
    });
    items.push({
      key: "s:pxgrid",
      type: "set",
      label: "Pixel Grid",
      categoryName: "Settings",
      meta: pixelGrid ? "On" : "Off",
      icon: Grid,
      run: () => onTogglePixelGrid?.(),
    });
    items.push({
      key: "s:snapobj",
      type: "set",
      label: "Snap to Objects",
      categoryName: "Settings",
      meta: snapObjects ? "On" : "Off",
      icon: Sliders,
      run: () => onToggleSnapObjects?.(),
    });
    items.push({
      key: "s:snapg",
      type: "set",
      label: "Snap Guides",
      categoryName: "Settings",
      meta: snapGuides ? "On" : "Off",
      icon: Sliders,
      run: () => onToggleSnapGuides?.(),
    });
    items.push({
      key: "s:chk",
      type: "set",
      label: "Checkerboard Background",
      categoryName: "Settings",
      meta: checkerboard ? "On" : "Off",
      icon: Grid,
      run: () => onToggleCheckerboard?.(),
    });

    return items;
  }, [
    theme,
    onThemeChange,
    motionFeel,
    onMotionFeelChange,
    showRulers,
    onToggleRulers,
    pixelGrid,
    onTogglePixelGrid,
    snapObjects,
    onToggleSnapObjects,
    snapGuides,
    onToggleSnapGuides,
    checkerboard,
    onToggleCheckerboard,
  ]);

  // Assets pool
  const assetPool: SpotlightItem[] = useMemo(() => {
    try {
      const doc = getDocument();
      const assets = doc?.assets ? Object.values(doc.assets) : [];
      return assets.map((a) => ({
        key: `a:${a.id}`,
        type: "asset",
        label: a.name || a.id,
        categoryName: "Assets",
        meta: "Asset",
        icon: ImageIcon,
        run: () => {},
      }));
    } catch {
      return [];
    }
  }, []);

  // Filter and build sections based on query and prefixMode
  const sections: SpotlightSection[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pools: Record<SpotlightCategory, SpotlightItem[]> = {
      cmd: commandPool,
      layer: layerPool,
      page: pagePool,
      asset: assetPool,
      set: settingsPool,
    };

    if (!q) {
      if (prefixMode && pools[prefixMode]) {
        return [
          {
            name: SPOTLIGHT_NAMES[prefixMode] || prefixMode,
            items: pools[prefixMode].slice(0, 20),
          },
        ];
      }

      // Empty state default: Recent and Suggested
      const allCmds = commandPool;
      const findCmd = (name: string) => allCmds.find((c) => c.label === name);
      const recent = recentItems.map(findCmd).filter((c): c is SpotlightItem => Boolean(c));
      const suggested = [
        "Insert frame",
        "Toggle rulers",
        "Switch theme",
        "Go to Motion",
      ]
        .map(findCmd)
        .filter((c): c is SpotlightItem => Boolean(c));

      const res: SpotlightSection[] = [];
      if (recent.length > 0) res.push({ name: "Recent", items: recent });
      if (suggested.length > 0) res.push({ name: "Suggested", items: suggested });
      return res;
    }

    const order: SpotlightCategory[] = ["cmd", "layer", "page", "asset", "set"];
    const matched: SpotlightItem[] = [];

    for (const cat of order) {
      if (prefixMode && prefixMode !== cat) continue;
      const pool = pools[cat] || [];
      for (const item of pool) {
        const m = matchScore(item.label, q);
        if (m) {
          matched.push({
            ...item,
            score: m.s + (cat === "cmd" ? 5 : 0),
            matchIndices: m.i,
          });
        }
      }
    }

    matched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const resultSections: SpotlightSection[] = [];
    let rest = matched;

    if (!prefixMode && matched.length > 0) {
      const top = matched[0];
      resultSections.push({
        name: "Top hit",
        items: [top],
        big: true,
      });
      rest = matched.slice(1);
    }

    for (const cat of order) {
      if (prefixMode && prefixMode !== cat) continue;
      const catItems = rest.filter((x) => x.type === cat).slice(0, prefixMode ? 20 : 4);
      if (catItems.length > 0) {
        resultSections.push({
          name: SPOTLIGHT_NAMES[cat] || cat,
          items: catItems,
        });
      }
    }

    return resultSections;
  }, [
    query,
    prefixMode,
    commandPool,
    layerPool,
    pagePool,
    assetPool,
    settingsPool,
    recentItems,
  ]);

  // Flattened items list for index-based keyboard navigation
  const flatItems: SpotlightItem[] = useMemo(() => {
    return sections.flatMap((sec) => sec.items);
  }, [sections]);

  // Clamped selected index derived from state
  const safeSelectedIndex = flatItems.length > 0 ? Math.min(selectedIndex, flatItems.length - 1) : 0;

  // Update sliding highlight position with spring and stretch from preset table
  useEffect(() => {
    if (!open || !listRef.current || !highlightRef.current) return;
    const itemEls = listRef.current.querySelectorAll<HTMLElement>(".ll-sp-r, .sp-r");
    const activeEl = itemEls[safeSelectedIndex];
    const hl = highlightRef.current;

    if (!activeEl) {
      hl.classList.remove("show");
      return;
    }

    const y = activeEl.offsetTop;
    const h = activeEl.offsetHeight;

    hl.style.height = `${h}px`;
    hl.style.transform = `translateY(${y}px)`;

    const preset = getActivePreset();
    if (!prefersReducedMotion() && hl.classList.contains("show")) {
      const dy = prevHlTopRef.current - y;
      const dist = Math.abs(dy);
      if (dist > 0.5 || prevHlHRef.current !== h) {
        springAnim(hl, [{ translate: `0 ${dy}px` }, { translate: "0 0" }], preset.hl[0], preset.hl[1]);
        springAnim(
          hl,
          [{ scale: `1 ${1 + Math.min(0.35, dist * preset.stretch * 0.12)}` }, { scale: "1 1" }],
          preset.hl[0],
          preset.hl[1]
        );
      }
    }

    hl.classList.add("show");
    prevHlTopRef.current = y;
    prevHlHRef.current = h;

    // Scroll container to keep active row in view
    if (scrollRef.current) {
      const sc = scrollRef.current;
      if (y < sc.scrollTop) {
        sc.scrollTop = y - 6;
      } else if (y + h > sc.scrollTop + sc.clientHeight) {
        sc.scrollTop = y + h - sc.clientHeight + 6;
      }
    }
  }, [open, safeSelectedIndex, flatItems]);

  // Edge blur simulation on list scroll (exact algorithm from prototype bulge())
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !listRef.current) return;
    if (prefersReducedMotion()) return;

    const sc = scrollRef.current;
    const h = sc.clientHeight;
    const st = sc.scrollTop;
    const max = sc.scrollHeight - h;
    const c = st + h / 2;
    const rows = listRef.current.querySelectorAll<HTMLElement>(".ll-sp-r, .sp-r");

    if (max <= 2) {
      rows.forEach((r) => {
        r.style.filter = "";
        r.style.opacity = "";
      });
      return;
    }

    rows.forEach((r) => {
      const rh = r.offsetHeight;
      const y = r.offsetTop + rh / 2 - c;
      const ay = Math.abs(y);
      if (ay > h / 2 + rh) return;

      const ramp = y < 0 ? Math.min(1, st / (rh * 3)) : Math.min(1, (max - st) / (rh * 3));
      const blurAmount = Math.min(
        3.2,
        Math.min(1, Math.max(0, (24 - (h / 2 - ay)) / 24)) * ramp * 1.8
      );

      r.style.filter = blurAmount > 0.05 ? `blur(${blurAmount.toFixed(2)}px)` : "";
    });
  }, []);

  // Morph open and close transitions on #tools
  const runOpen = useCallback(() => {
    const bar = typeof document !== "undefined" ? document.getElementById("tools") : null;
    if (!bar) return;

    clearTimers();
    cancelAll(bar);
    if (resRef.current) cancelAll(resRef.current);
    if (fldRef.current) cancelAll(fldRef.current);

    prevFocusRef.current = document.activeElement as HTMLElement | null;

    const host =
      (bar.closest<HTMLElement>('[data-center="true"], main[role="main"], #center, .ll-center') ??
      (bar.offsetParent as HTMLElement | null) ??
      document.body);

    const w0 = bar.offsetWidth;
    const hostWidth = host ? host.clientWidth : window.innerWidth;
    const W = Math.max(280, Math.min(560, hostWidth - 32));

    bar.classList.add("sp-on", "ll-sp-on");
    bar.style.width = `${W}px`;

    const preset = getActivePreset();
    const reduced = prefersReducedMotion();

    if (reduced) {
      bar.classList.add("sp-f", "ll-sp-f");
      if (resRef.current) {
        const isLifted = bar.classList.contains("tb-hi") || bar.classList.contains("ll-tb-hi");
        const baseBottom = isLifted ? 72 : 16;
        resRef.current.style.bottom = `${baseBottom + bar.offsetHeight + 8}px`;
        resRef.current.style.width = `${W}px`;
        resRef.current.hidden = false;
        resRef.current.style.height = "auto";
      }
      inputRef.current?.focus();
      return;
    }

    springAnim(bar, [{ width: `${w0}px` }, { width: `${W}px` }], preset.shape[0], preset.shape[1]);

    const kids = Array.from(bar.querySelectorAll<HTMLElement>("button, .gsep, .ll-gsep")).filter(
      (el) => !el.closest(".sp-fld, .ll-sp-fld")
    );
    const n = kids.length;
    kids.forEach((k, i) => {
      cancelAll(k);
      k.animate(
        [
          { opacity: 1, scale: "1", filter: "blur(0px)" },
          { opacity: 0, scale: "0.7", filter: "blur(4px)" },
        ],
        { duration: 140, delay: i * 12, fill: "forwards", easing: "ease-out" }
      );
    });

    const zoom = host.querySelector<HTMLElement>(".fzoom, .ll-fzoom");
    if (zoom) {
      const dx = zoom.offsetWidth + 40;
      cancelAll(zoom);
      zoom.style.pointerEvents = "none";
      springAnim(
        zoom,
        [{ translate: "0 0", opacity: 1 }, { translate: `${dx}px 0`, opacity: 0 }],
        preset.shape[0],
        preset.shape[1],
        { fill: "forwards" }
      );
    }

    later(() => {
      bar.classList.add("sp-f", "ll-sp-f");
      if (fldRef.current) {
        fldRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      }
      inputRef.current?.focus();
    }, reduced ? 60 : Math.min(260, 150 + n * 10));

    later(() => {
      if (!resRef.current) return;
      const res = resRef.current;
      const isLifted = bar.classList.contains("tb-hi") || bar.classList.contains("ll-tb-hi");
      const baseBottom = isLifted ? 72 : 16;
      res.style.bottom = `${baseBottom + bar.offsetHeight + 8}px`;
      res.style.width = `${W}px`;
      res.hidden = false;

      const sc = scrollRef.current;
      const maxH = Math.max(120, Math.min(360, host.clientHeight - (baseBottom + bar.offsetHeight + 8) - 16));
      if (sc) {
        sc.style.maxHeight = `${maxH}px`;
      }
      const H = sc ? sc.offsetHeight + 2 : 280;
      res.style.height = `${H}px`;

      springAnim(
        res,
        [{ opacity: 0, scale: "0.94", translate: "0 10px" }, { opacity: 1, scale: "1", translate: "0 0" }],
        preset.shape[0],
        preset.shape[1],
        { fill: "backwards" }
      );
      springAnim(res, [{ height: "0px" }, { height: `${H}px` }], preset.shape[0], preset.shape[1]);

      const rows = res.querySelectorAll<HTMLElement>(".ll-sp-r, .sp-r");
      rows.forEach((r, i) => {
        springAnim(
          r,
          [{ opacity: 0, scale: String(preset.rowScale), translate: "0 6px" }, { opacity: 1, scale: "1", translate: "0 0" }],
          preset.rows[0],
          preset.rows[1],
          { delay: Math.min(i, 10) * preset.stagger, fill: "backwards" }
        );
      });
    }, reduced ? 60 : 90);

    later(() => {
      inputRef.current?.classList.add("car");
    }, reduced ? 100 : 350);
  }, [clearTimers, later]);

  const runClose = useCallback(() => {
    const bar = typeof document !== "undefined" ? document.getElementById("tools") : null;
    if (!bar) return;

    clearTimers();
    inputRef.current?.classList.remove("car");

    const host =
      (bar.closest<HTMLElement>('[data-center="true"], main[role="main"], #center, .ll-center') ??
      (bar.offsetParent as HTMLElement | null) ??
      document.body);

    const preset = getActivePreset();
    const reduced = prefersReducedMotion();

    if (reduced) {
      if (resRef.current) resRef.current.hidden = true;
      bar.classList.remove("sp-on", "ll-sp-on", "sp-f", "ll-sp-f", "sp-clo", "ll-sp-clo");
      bar.style.width = "";
      if (prevFocusRef.current && document.contains(prevFocusRef.current)) {
        prevFocusRef.current.focus();
      }
      return;
    }

    if (resRef.current) {
      resRef.current.animate(
        [{ opacity: 1, scale: "1", translate: "0 0" }, { opacity: 0, scale: "0.97", translate: "0 6px" }],
        { duration: 150, easing: "ease-out", fill: "forwards" }
      );
    }

    bar.classList.add("sp-clo", "ll-sp-clo");
    bar.classList.remove("sp-f", "ll-sp-f");

    if (fldRef.current) {
      fldRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: "ease-out", fill: "forwards" });
    }

    const cur = bar.offsetWidth;
    bar.style.width = "";
    const wN = bar.offsetWidth;
    bar.style.width = `${wN}px`;

    springAnim(bar, [{ width: `${cur}px` }, { width: `${wN}px` }], 0.3, 1);

    const kids = Array.from(bar.querySelectorAll<HTMLElement>("button, .gsep, .ll-gsep")).filter(
      (el) => !el.closest(".sp-fld, .ll-sp-fld")
    );
    const nk = kids.length;
    kids.forEach((k, i) => {
      cancelAll(k);
      springAnim(
        k,
        [{ opacity: 0, scale: "0.7" }, { opacity: 1, scale: "1" }],
        preset.pop[0],
        preset.pop[1],
        { delay: 70 + i * preset.stagger, fill: "backwards" }
      );
      k.animate(
        [{ filter: "blur(4px)" }, { filter: "blur(0px)" }],
        { duration: 180, delay: 70 + i * preset.stagger, easing: "ease-out", fill: "backwards" }
      );
    });

    const zoom = host.querySelector<HTMLElement>(".fzoom, .ll-fzoom");
    if (zoom) {
      cancelAll(zoom);
      zoom.style.pointerEvents = "";
      const dx = zoom.offsetWidth + 40;
      springAnim(zoom, [{ translate: `${dx}px 0`, opacity: 0 }, { translate: "0 0", opacity: 1 }], preset.shape[0], preset.shape[1]);
    }

    later(() => {
      bar.classList.remove("sp-clo", "ll-sp-clo");
      if (fldRef.current) cancelAll(fldRef.current);
    }, 120);

    later(() => {
      if (resRef.current) {
        resRef.current.hidden = true;
        cancelAll(resRef.current);
      }
    }, 170);

    later(() => {
      bar.classList.remove("sp-on", "ll-sp-on");
      bar.style.width = "";
      cancelAll(bar);
      if (prevFocusRef.current && document.contains(prevFocusRef.current)) {
        prevFocusRef.current.focus();
      }
    }, Math.min(900, 420 + nk * preset.stagger));
  }, [clearTimers, later]);

  const prevOpenRef = useRef<boolean>(open);
  useEffect(() => {
    if (open !== prevOpenRef.current) {
      if (open) {
        runOpen();
      } else {
        runClose();
      }
      prevOpenRef.current = open;
    }
  }, [open, runOpen, runClose]);

  // Window resize handler while open
  useEffect(() => {
    if (!open) return;
    const handleResize = () => {
      const bar = typeof document !== "undefined" ? document.getElementById("tools") : null;
      if (!bar) return;
      const host =
        (bar.closest<HTMLElement>('[data-center="true"], main[role="main"], #center, .ll-center') ??
        (bar.offsetParent as HTMLElement | null) ??
        document.body);
      const W = Math.max(280, Math.min(560, host.clientWidth - 32));
      bar.style.width = `${W}px`;
      if (resRef.current) {
        resRef.current.style.width = `${W}px`;
        const isLifted = bar.classList.contains("tb-hi") || bar.classList.contains("ll-tb-hi");
        const baseBottom = isLifted ? 72 : 16;
        resRef.current.style.bottom = `${baseBottom + bar.offsetHeight + 8}px`;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  // Execute selected item
  const handleRun = useCallback(
    (item: SpotlightItem) => {
      if (item.disabled) return;

      if (item.type === "cmd") {
        setRecentItems((prev) => [item.label, ...prev.filter((x) => x !== item.label)].slice(0, 3));
      }

      onClose();
      setTimeout(() => {
        item.run?.();
      }, SPOTLIGHT_RUN_DELAY_MS);
    },
    [onClose]
  );

  // Keyboard navigation inside input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = flatItems.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count > 0) {
        setSelectedIndex((prev) => (prev + 1) % count);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count > 0) {
        setSelectedIndex((prev) => (prev - 1 + count) % count);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = flatItems[safeSelectedIndex];
      if (current) {
        handleRun(current);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (sections.length <= 1) return;

      let currentSectionIdx = 0;
      let accum = 0;
      for (let s = 0; s < sections.length; s++) {
        if (safeSelectedIndex >= accum && safeSelectedIndex < accum + sections[s].items.length) {
          currentSectionIdx = s;
          break;
        }
        accum += sections[s].items.length;
      }

      const nextSectionIdx = e.shiftKey
        ? (currentSectionIdx - 1 + sections.length) % sections.length
        : (currentSectionIdx + 1) % sections.length;

      let targetIndex = 0;
      for (let s = 0; s < nextSectionIdx; s++) {
        targetIndex += sections[s].items.length;
      }
      setSelectedIndex(targetIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query || prefixMode) {
        setQuery("");
        setPrefixMode("");
      } else {
        onClose();
      }
    } else if (e.key === "Backspace" && !query && prefixMode) {
      e.preventDefault();
      setPrefixMode("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!prefixMode && val.length > 0) {
      const firstChar = val.charAt(0) as SpotlightPrefixKey;
      if (SPOTLIGHT_PREFIX_MAP[firstChar]) {
        setPrefixMode(SPOTLIGHT_PREFIX_MAP[firstChar]);
        setQuery(val.slice(1));
        setSelectedIndex(0);
        return;
      }
    }
    setQuery(val);
    setSelectedIndex(0);
  };

  if (!isMounted) return null;

  const currentPlaceholder = prefixMode
    ? `Search ${SPOTLIGHT_NAMES[prefixMode]?.toLowerCase() || prefixMode}`
    : "Search or run a command";

  const toolbarEl = typeof document !== "undefined" ? document.getElementById("tools") : null;
  const hostEl =
    toolbarEl?.closest<HTMLElement>('[data-center="true"], main[role="main"], #center, .ll-center') ??
    (toolbarEl?.offsetParent as HTMLElement | null) ??
    (typeof document !== "undefined" ? document.body : null);

  const isLifted = toolbarEl?.classList.contains("tb-hi") || toolbarEl?.classList.contains("ll-tb-hi");
  const baseBottom = isLifted ? 72 : 16;
  const bottomOffset = toolbarEl ? baseBottom + toolbarEl.offsetHeight + 8 : 74;
  const spotlightWidth = typeof window !== "undefined"
    ? Math.max(CANVAS_CHROME_SIZES.spotlightWidthMin, Math.min(CANVAS_CHROME_SIZES.spotlightWidthMax, window.innerWidth - 32))
    : CANVAS_CHROME_SIZES.spotlightWidthMax;

  // The Search Field is portaled directly into the toolbar element (#tools), morphing it!
  const searchFieldContent = (
    <div ref={fldRef} className="sp-fld ll-sp-fld">
      <Icon icon={Search} size={CANVAS_CHROME_SIZES.iconMd} className="ll:text-muted" />

      {prefixMode && (
        <span className="sp-chip ll-sp-chip">
          {SPOTLIGHT_NAMES[prefixMode] || prefixMode}
        </span>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="splist"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-label="Search commands, layers, pages"
        placeholder={currentPlaceholder}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />

      <kbd>esc</kbd>
    </div>
  );

  // The Results panel is placed in the host canvas directly above #tools
  const resultsContent = (
    <>
      {/* Background click-away handler */}
      {open && (
        <div
          className="ll:fixed ll:inset-0 ll:z-20 ll:bg-transparent ll:cursor-default"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Results popover (.ll-sp-res) positioned above the toolbar */}
      <div
        ref={resRef}
        className="sp-res ll-sp-res"
        role="dialog"
        aria-label="Spotlight search results"
        hidden={!open}
        style={{
          bottom: `${bottomOffset}px`,
          width: `${spotlightWidth}px`,
        }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="sp-sc ll-sp-sc"
          style={{ maxHeight: `${CANVAS_CHROME_SIZES.spotlightMaxHeight}px` }}
        >
          <div
            ref={listRef}
            id="splist"
            role="listbox"
            aria-label="Results"
            className="sp-in ll-sp-in"
          >
            {/* Sliding highlight */}
            <i ref={highlightRef} className="sp-hl ll-sp-hl" aria-hidden="true" />

            {/* Sections & Rows */}
            {sections.length > 0 && flatItems.length > 0 ? (
              sections.map((section, sIdx) => {
                let sectionStartIdx = 0;
                for (let i = 0; i < sIdx; i++) {
                  sectionStartIdx += sections[i].items.length;
                }

                return (
                  <div key={section.name} role="presentation">
                    <div className="sp-h ll-sp-h" role="presentation">
                      {section.name}
                    </div>

                    {section.items.map((item, itemOffset) => {
                      const absoluteIdx = sectionStartIdx + itemOffset;
                      const isSelected = absoluteIdx === safeSelectedIndex;
                      const isBig = Boolean(section.big);

                      return (
                        <div
                          key={item.key}
                          id={`spo-${absoluteIdx}`}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={item.disabled}
                          onClick={() => handleRun(item)}
                          onPointerMove={() => {
                            if (safeSelectedIndex !== absoluteIdx) {
                              setSelectedIndex(absoluteIdx);
                            }
                          }}
                          className={`sp-r ll-sp-r ${isBig ? "big" : ""} ${
                            isSelected ? "on" : ""
                          } ${item.disabled ? "disabled" : ""}`}
                        >
                          <span className="sp-ic ll-sp-ic">
                            <Icon
                              icon={item.icon}
                              size={isBig ? CANVAS_CHROME_SIZES.iconLg : CANVAS_CHROME_SIZES.iconMd}
                            />
                          </span>

                          <span className="sp-l ll-sp-l">
                            {renderHighlighted(item.label, item.matchIndices)}
                          </span>

                          <span className="sp-m ll-sp-m">
                            {item.disabledReason ? (
                              <span className="sp-reason ll-sp-reason" title={item.disabledReason}>
                                Not available
                              </span>
                            ) : item.shortcut ? (
                              <kbd>{item.shortcut.split("+").join(" ")}</kbd>
                            ) : item.meta ? (
                              <span>{item.meta}</span>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="sp-none ll-sp-none" role="status">
                No results for “{query}”
                <span>Try &gt; for commands, @ for layers, # for pages</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {toolbarEl && createPortal(searchFieldContent, toolbarEl)}
      {hostEl ? createPortal(resultsContent, hostEl) : resultsContent}
    </>
  );
};
