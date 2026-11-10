"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useId, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, Check, Plus } from "./ColorPickerIcons";
import { Icon } from "./Icon";
import { SegmentedControl } from "./SegmentedControl";
import { useMounted } from "./useMounted";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springEase } from "../motion/ease";
import { Spring } from "../motion/spring";
import { simAdd, simRemove, type Sim } from "../motion/loop";
import {
  MORPH_EXPANDED_CLIP,
  buildTriggerMorphClip,
  REDUCED_DURATION,
} from "./ColorPickerMotion";
import {
  registerOverlay,
  unregisterOverlay,
  getFamilyHandoff,
  animateRetarget,
} from "./retarget";
import {
  FONT_CATEGORIES,
  DEFAULT_PROJECT_FONTS,
  SYSTEM_FONTS,
  LIBRARY_FONTS,
  fontStack,
  matchHighlight,
  type FontCategory,
  type FontEntry,
} from "./FontPickerData";

export interface FontPickerProps {
  open?: boolean;
  value?: string;
  onChange?: (family: string) => void;
  onPreview?: (family: string | null) => void;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  className?: string;
  "aria-label"?: string;
  [key: string]: unknown;
}

const PICKER_WIDTH = 304;
const PICKER_GAP = 8;
const CASCADE_BASE = 50;
const CASCADE_LIMIT = 16;
const CLOSE_MS = 190;
const ROW_H = 32;

type SpringSpec = [number, number];

interface GroupDef {
  key: "proj" | "sys" | "lib";
  label: string;
  entries: FontEntry[];
}

/** Spring-eased animation. Reduced motion: a short opacity fade. */
function spr(
  el: HTMLElement | null,
  frames: Keyframe[],
  spec: SpringSpec,
  extra: KeyframeAnimationOptions = {}
): Animation | null {
  if (!el || !el.animate) return null;
  if (prefersReducedMotion()) {
    return el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: REDUCED_DURATION,
      easing: "ease-out",
      fill: "backwards",
    });
  }
  const e = springEase(spec[0], spec[1]);
  return el.animate(frames, { duration: e.duration, easing: e.easing, ...extra });
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function FontPicker({
  open = true,
  value = "Inter",
  onChange,
  onPreview,
  onClose,
  anchorRef,
  triggerRef,
  anchorEl,
  className = "",
  "aria-label": ariaLabel,
}: FontPickerProps) {
  const mounted = useMounted();
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevAnchorRef = useRef<HTMLElement | null>(null);
  const isImmediateCloseRef = useRef(false);
  const pickerId = useId();
  const pickerUniqueId = useId();

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);

  const [activeCategory, setActiveCategory] = useState<FontCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedFonts, setUploadedFonts] = useState<FontEntry[]>([]);
  const [act, setAct] = useState<string | null>(value);
  const [kb, setKb] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
      setSearchQuery("");
      setActiveCategory("All");
      setAct(value);
      setKb(false);
    }
  }

  // Latest callbacks, so effects never re-run (and never replay the open motion) when the parent re-renders
  const cbRef = useRef({ onChange, onPreview, onClose });
  useLayoutEffect(() => {
    cbRef.current = { onChange, onPreview, onClose };
  });

  const buildGroups = useCallback(
    (category: FontCategory, query: string, uploads: FontEntry[]): GroupDef[] => {
      const q = query.trim().toLowerCase();
      const filterEntry = (entry: FontEntry): boolean => {
        if (category !== "All" && entry.category !== category) return false;
        if (!q) return true;
        return matchHighlight(entry.name, q) !== null;
      };
      return [
        { key: "proj", label: "In this project", entries: [...uploads, ...DEFAULT_PROJECT_FONTS].filter(filterEntry) },
        { key: "sys", label: "System", entries: SYSTEM_FONTS.filter(filterEntry) },
        { key: "lib", label: "Library", entries: LIBRARY_FONTS.filter(filterEntry) },
      ];
    },
    []
  );

  const groups = useMemo(
    () => buildGroups(activeCategory, searchQuery, uploadedFonts),
    [buildGroups, activeCategory, searchQuery, uploadedFonts]
  );
  const flatVisible = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  const rowEl = useCallback((name: string): HTMLElement | null => {
    return listRef.current?.querySelector<HTMLElement>(`[data-fp-family="${CSS.escape(name)}"]`) ?? null;
  }, []);

  // ---------- active row (moving highlight) ----------
  const hlSim = useRef<{ y: Spring; h: Spring; sim: Sim } | null>(null);
  const prevActRef = useRef<string | null>(null);
  const instantRef = useRef(false);

  const hlDraw = useCallback(() => {
    const hl = hlRef.current;
    const sp = hlSim.current;
    if (!hl || !sp) return;
    const st = Math.min(Math.abs(sp.y.v) * getActivePreset().stretch, 14);
    hl.style.transform = `translateY(${(sp.y.x - st / 2).toFixed(2)}px)`;
    hl.style.height = `${(sp.h.x + st).toFixed(2)}px`;
  }, []);

  const ensureHl = useCallback(() => {
    if (!hlSim.current) {
      const p = getActivePreset();
      const y = new Spring(0, p.hl);
      const h = new Spring(ROW_H, p.hl);
      hlSim.current = { y, h, sim: { sp: [y, h], apply: hlDraw } };
    }
    return hlSim.current;
  }, [hlDraw]);

  useEffect(() => {
    return () => {
      if (hlSim.current) simRemove(hlSim.current.sim);
    };
  }, []);

  const placeHl = useCallback(
    (instantIn: boolean) => {
      const hl = hlRef.current;
      const row = act ? rowEl(act) : null;
      if (!hl || !row || !row.offsetParent) {
        hl?.classList.remove("show");
        return;
      }
      const sp = ensureHl();
      const p = getActivePreset();
      sp.y.tune(p.hl);
      sp.h.tune(p.hl);
      sp.y.to = row.offsetTop;
      sp.h.to = row.offsetHeight;
      let instant = instantIn;
      if (!hl.classList.contains("show")) {
        hl.classList.add("show");
        sp.y.x = sp.y.to;
        sp.h.x = sp.h.to;
        sp.y.v = 0;
        sp.h.v = 0;
        instant = true;
      }
      if (instant || prefersReducedMotion()) {
        sp.y.snap();
        sp.h.snap();
        hlDraw();
      } else {
        simAdd(sp.sim);
      }
    },
    [act, rowEl, ensureHl, hlDraw]
  );

  useLayoutEffect(() => {
    if (!isRendered) return;
    const sameAct = prevActRef.current === act;
    prevActRef.current = act;
    const instant = instantRef.current || sameAct;
    instantRef.current = false;
    placeHl(instant);
  }, [isRendered, act, flatVisible, placeHl]);

  // ---------- edge bulge (rows near the list edges blur while it scrolls) ----------
  const bulgeSim = useRef<Sim | null>(null);
  const bulgeVel = useRef(0);
  const bulgeLastTop = useRef(0);
  const bulgeLastTime = useRef(0);
  const bulgeIdle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bulgeKeys = useRef(new WeakMap<HTMLElement, string>());

  const bulge = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".fp-r"));
    const h = list.clientHeight;
    const st = list.scrollTop;
    const max = list.scrollHeight - h;
    const c = st + h / 2;
    if (prefersReducedMotion() || max <= 2) {
      rows.forEach((r) => {
        bulgeKeys.current.delete(r);
        r.style.filter = "";
      });
      return;
    }
    const S = 1 + 0.9 * Math.min(1, Math.max(0, bulgeVel.current));
    rows.forEach((r) => {
      if (r.hidden || !r.offsetParent) return;
      const rh = r.offsetHeight;
      const y = r.offsetTop + rh / 2 - c;
      const ay = Math.abs(y);
      if (ay > h / 2 + rh) return;
      const ramp = y < 0 ? Math.min(1, st / (rh * 3)) : Math.min(1, (max - st) / (rh * 3));
      const b = Math.min(3.2, Math.min(1, Math.max(0, (24 - (h / 2 - ay)) / 24)) * ramp * S * 1.8);
      const key = b.toFixed(1);
      if (bulgeKeys.current.get(r) === key) return;
      bulgeKeys.current.set(r, key);
      r.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : "";
    });
  }, []);

  // A sim whose one spring is already at rest: the shared loop calls `apply` once on the next frame, then drops it
  const bulgeSched = useCallback(() => {
    if (!bulgeSim.current) bulgeSim.current = { sp: [new Spring(0, getActivePreset().hl)], apply: bulge };
    simAdd(bulgeSim.current);
  }, [bulge]);

  useEffect(() => {
    return () => {
      if (bulgeSim.current) simRemove(bulgeSim.current);
      if (bulgeIdle.current) clearTimeout(bulgeIdle.current);
    };
  }, []);

  const handleListScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const now = performance.now();
    const dt = Math.max(1, now - bulgeLastTime.current);
    placeHl(true);
    bulgeVel.current = Math.abs(list.scrollTop - bulgeLastTop.current) / dt / 1.2;
    bulgeLastTop.current = list.scrollTop;
    bulgeLastTime.current = now;
    bulgeSched();
    if (bulgeIdle.current) clearTimeout(bulgeIdle.current);
    bulgeIdle.current = setTimeout(() => {
      bulgeVel.current = 0;
      bulgeSched();
    }, 90);
  };

  // ---------- FLIP when the filter changes ----------
  const flipRef = useRef(false);
  const prevTopsRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!isRendered || !list) {
      prevTopsRef.current = new Map();
      return;
    }
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-fp-row]"));
    const before = prevTopsRef.current;
    const prevScroll = bulgeLastTop.current;
    const animate = flipRef.current && before.size > 0 && !prefersReducedMotion();
    flipRef.current = false;
    if (animate) list.scrollTop = 0;
    const next = new Map<string, number>();
    const preset = getActivePreset();
    let n = 0;
    rows.forEach((r) => {
      const name = r.dataset.fpFamily ?? "";
      const top = r.offsetTop;
      next.set(name, top);
      if (!animate) return;
      if (before.has(name)) {
        const d = before.get(name)! - prevScroll - top;
        if (Math.abs(d) > 0.5) spr(r, [{ translate: `0 ${d}px` }, { translate: "0 0" }], preset.flip);
      } else if (n < 12) {
        spr(
          r,
          [{ opacity: 0, scale: String(preset.rowScale) }, { opacity: 1, scale: "1" }],
          preset.rows,
          { fill: "backwards", delay: n * 8 }
        );
        n++;
      }
    });
    prevTopsRef.current = next;
    bulgeSched();
  }, [isRendered, flatVisible, bulgeSched]);

  // ---------- list helpers ----------
  const keepIn = useCallback(
    (name: string) => {
      const list = listRef.current;
      const el = rowEl(name);
      if (!list || !el) return;
      const t = list.scrollTop;
      const h = list.clientHeight;
      const top = el.offsetTop;
      const b = top + el.offsetHeight;
      if (top - 30 < t) list.scrollTop = Math.max(0, top - 30);
      else if (b + 8 > t + h) list.scrollTop = b + 8 - h;
    },
    [rowEl]
  );

  const activate = useCallback(
    (name: string | null, opts: { kb?: boolean; instant?: boolean; quiet?: boolean } = {}) => {
      if (opts.instant) instantRef.current = true;
      setAct(name);
      setKb(!!opts.kb);
      if (name && opts.kb) keepIn(name);
      if (!opts.quiet && name) cbRef.current.onPreview?.(name);
    },
    [keepIn]
  );

  const chooseAct = useCallback(
    (visible: FontEntry[], query: string): string | null => {
      if (!visible.length) return null;
      if (query.trim()) return visible[0].name;
      return visible.find((f) => f.name === value)?.name ?? visible[0].name;
    },
    [value]
  );

  const refilter = (category: FontCategory, query: string, uploads: FontEntry[]) => {
    flipRef.current = true;
    const next = buildGroups(category, query, uploads).flatMap((g) => g.entries);
    if (!act || !next.some((f) => f.name === act)) {
      activate(chooseAct(next, query), { instant: true, quiet: true });
    }
  };

  const pick = useCallback(
    (name: string) => {
      cbRef.current.onChange?.(name);
      const el = rowEl(name);
      if (el) {
        const p = getActivePreset();
        spr(el.querySelector<HTMLElement>(".fp-ck"), [{ scale: "0.2", opacity: 0 }, { scale: "1", opacity: 1 }], p.pop);
        spr(el.querySelector<HTMLElement>(".fp-n"), [{ scale: "0.96" }, { scale: "1" }], p.pop);
      }
    },
    [rowEl]
  );

  // Position calculation
  const updatePosition = useCallback(() => {
    const el = pickerRef.current;
    if (!el) return;

    const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
    const rightZone = document.querySelector(".zone.right");
    const rightRect = rightZone
      ? rightZone.getBoundingClientRect()
      : anchor
      ? anchor.getBoundingClientRect()
      : null;

    let left = window.innerWidth - PICKER_WIDTH - PICKER_GAP;
    let top = PICKER_GAP;

    if (anchor && rightRect) {
      const s = anchor.getBoundingClientRect();
      left = rightRect.left - PICKER_WIDTH - PICKER_GAP;
      if (left < PICKER_GAP) {
        left = Math.max(
          PICKER_GAP,
          Math.min(s.left - PICKER_WIDTH - PICKER_GAP, window.innerWidth - PICKER_WIDTH - PICKER_GAP)
        );
      }
      top = s.top - 12;
    }

    const pickerH = el.offsetHeight || 380;
    const fittedTop = clamp(top, PICKER_GAP, Math.max(PICKER_GAP, window.innerHeight - PICKER_GAP - pickerH));

    el.style.left = `${left}px`;
    el.style.top = `${fittedTop}px`;
  }, [anchorRef, anchorEl, triggerRef]);

  // Open & Close animations with retargeting
  useEffect(() => {
    if (!isRendered) return;
    const el = pickerRef.current;
    if (!el) return;

    updatePosition();

    const reduced = prefersReducedMotion();
    const preset = getActivePreset();
    const anchor = (anchorRef?.current ?? triggerRef?.current ?? anchorEl) as HTMLElement | null;

    if (open) {
      const cur = rowEl(value);
      if (cur) keepIn(value);
      bulgeLastTop.current = listRef.current?.scrollTop ?? 0;
      placeHl(true);
      const toRect = el.getBoundingClientRect();
      const isAnchorSwitch =
        prevAnchorRef.current !== null &&
        prevAnchorRef.current !== anchor;
      const handoff = !isAnchorSwitch ? getFamilyHandoff("font-picker", pickerUniqueId) : null;

      if (reduced) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "backwards",
        });
      } else if (isAnchorSwitch && prevAnchorRef.current) {
        const oldRect = prevAnchorRef.current.getBoundingClientRect();
        animateRetarget(el, oldRect, toRect, listRef.current);
      } else if (handoff) {
        animateRetarget(el, handoff, toRect, listRef.current);
      } else if (anchor) {
        const s = anchor.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        el.style.transformOrigin = `${originX}px ${originY}px`;

        const morphFrom = buildTriggerMorphClip(s, r);
        const morphTo = MORPH_EXPANDED_CLIP;

        const se = springEase(preset.shape[0], preset.shape[1]);
        el.animate(
          [
            { clipPath: morphFrom, transform: "scale(0.8)" },
            { clipPath: morphTo, transform: "scale(1)" },
          ],
          {
            duration: se.duration,
            easing: se.easing,
          }
        );

        // Cascade: search, categories, the headers and rows in view, then the footer
        const list = listRef.current;
        const els: HTMLElement[] = [];
        const search = el.querySelector<HTMLElement>(".fp-s");
        const seg = el.querySelector<HTMLElement>(".fp-seg");
        if (search) els.push(search);
        if (seg) els.push(seg);
        if (list) {
          list.querySelectorAll<HTMLElement>(".fp-gh, .fp-r").forEach((e) => {
            if (e.offsetParent && e.offsetTop < list.clientHeight + list.scrollTop && els.length < CASCADE_LIMIT) {
              els.push(e);
            }
          });
        }
        const ft = el.querySelector<HTMLElement>(".fp-ft");
        if (ft) els.push(ft);
        els.forEach((e, i) => {
          spr(
            e,
            [
              { opacity: 0, scale: String(preset.rowScale), filter: "blur(4px)", translate: "0 6px" },
              { opacity: 1, scale: "1", filter: "blur(0px)", translate: "0 0" },
            ],
            preset.rows,
            { delay: CASCADE_BASE + i * preset.stagger, fill: "backwards" }
          );
        });
      }

      bulgeSched();
      prevAnchorRef.current = anchor;
      registerOverlay({
        id: pickerUniqueId,
        family: "font-picker",
        element: el,
        anchor,
        close: (immediate) => {
          if (immediate) isImmediateCloseRef.current = true;
          cbRef.current.onClose?.();
        },
        rect: toRect,
        timestamp: performance.now(),
      });
      searchInputRef.current?.focus({ preventScroll: true });
    } else {
      prevAnchorRef.current = null;
      unregisterOverlay(pickerUniqueId);
      if (isImmediateCloseRef.current) {
        isImmediateCloseRef.current = false;
        setIsRendered(false);
        return;
      }
      let anim: Animation;
      if (reduced || !anchor) {
        anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: REDUCED_DURATION,
          easing: "ease-out",
          fill: "forwards",
        });
      } else {
        const s = anchor.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const originX = s.left + s.width / 2 - r.left;
        const originY = s.top + s.height / 2 - r.top;
        el.style.transformOrigin = `${originX}px ${originY}px`;

        const morphTarget = buildTriggerMorphClip(s, r);
        anim = el.animate(
          [
            { clipPath: MORPH_EXPANDED_CLIP, transform: "scale(1)", opacity: 1 },
            { clipPath: morphTarget, transform: "scale(0.86)", opacity: 0 },
          ],
          {
            duration: CLOSE_MS,
            easing: "cubic-bezier(0.4, 0, 0.8, 0.6)",
            fill: "forwards",
          }
        );
      }
      anim.onfinish = () => {
        setIsRendered(false);
      };
    }
    // Opening and closing are driven by `open` and `isRendered` only; the rest are stable refs or helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRendered]);

  useEffect(() => {
    return () => {
      unregisterOverlay(pickerUniqueId);
    };
  }, [pickerUniqueId]);

  // Outside pointerdown, Escape, typing, Arrow keys and Enter
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const el = pickerRef.current;
      const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
      const target = e.target as Node | null;

      if (el && target && !el.contains(target)) {
        if (anchor && anchor.contains(target)) return;
        cbRef.current.onPreview?.(null);
        cbRef.current.onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const el = pickerRef.current;
      const inside = !!el && el.contains(e.target as Node);
      if (e.key === "Escape") {
        e.stopPropagation();
        cbRef.current.onPreview?.(null);
        cbRef.current.onClose?.();
        const anchor = anchorRef?.current ?? triggerRef?.current ?? anchorEl;
        anchor?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (flatVisible.length === 0) return;
        e.preventDefault();
        const currentIdx = flatVisible.findIndex((f) => f.name === act);
        let nextIdx: number;
        if (currentIdx < 0) nextIdx = e.key === "ArrowDown" ? 0 : flatVisible.length - 1;
        else nextIdx = (currentIdx + (e.key === "ArrowDown" ? 1 : -1) + flatVisible.length) % flatVisible.length;
        activate(flatVisible[nextIdx].name, { kb: true });
      } else if (e.key === "Enter") {
        if ((e.target === searchInputRef.current || e.target === listRef.current) && act) {
          e.preventDefault();
          pick(act);
        }
      } else if (
        inside &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.target !== searchInputRef.current &&
        !(e.target as HTMLElement).closest?.(".fp-ft")
      ) {
        searchInputRef.current?.focus();
      }
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, isRendered, act, flatVisible, anchorRef, anchorEl, triggerRef, updatePosition, activate, pick]);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanName =
      file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() ||
      "Custom Font";

    if (typeof window !== "undefined" && "FontFace" in window) {
      try {
        const url = URL.createObjectURL(file);
        const fontFace = new FontFace(cleanName, `url(${url})`);
        fontFace.load().then((loaded) => {
          document.fonts.add(loaded);
        }).catch(() => {});
      } catch {
        // ignore font face loading error
      }
    }

    const newEntry: FontEntry = {
      name: cleanName,
      group: "proj",
      category: "Sans",
      meta: "Uploaded",
    };

    const nextUploads = [newEntry, ...uploadedFonts.filter((f) => f.name !== cleanName)];
    flipRef.current = true;
    setUploadedFonts(nextUploads);
    setSearchQuery("");
    setActiveCategory("All");
    activate(cleanName, { kb: true, instant: false, quiet: true });
    cbRef.current.onChange?.(cleanName);
    e.target.value = "";
  };

  const handleGoogleFontsClick = () => {
    setSearchQuery("");
    setActiveCategory("All");
    flipRef.current = true;
    const lib = LIBRARY_FONTS[0]?.name ?? null;
    if (lib) activate(lib, { kb: true, quiet: true });
    setTimeout(() => {
      const list = listRef.current;
      const gh = list?.querySelector<HTMLElement>("[data-fp-group=lib] .fp-gh");
      if (!list || !gh) return;
      list.scrollTo({ top: gh.offsetTop - 4, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      const p = getActivePreset();
      spr(gh, [{ scale: "1.06", translate: "4px 0" }, { scale: "1", translate: "0 0" }], p.pop);
    }, 0);
  };

  if (!mounted || !isRendered) return null;

  const activeRowId = act ? `${pickerId}-o-${flatVisible.findIndex((f) => f.name === act)}` : undefined;

  return createPortal(
    <div
      ref={pickerRef}
      role="dialog"
      aria-label={ariaLabel || "Font picker"}
      tabIndex={-1}
      className={`fp ll-fp${kb ? " kb" : ""} ${className}`}
    >
      {/* Header (Search + Categories) */}
      <div className="fp-hd">
        <div className="fp-s">
          <Icon icon={Search} size={14} />
          <input
            ref={searchInputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${pickerId}-lb`}
            aria-autocomplete="list"
            aria-activedescendant={activeRowId}
            aria-label="Search fonts"
            placeholder="Search fonts"
            autoComplete="off"
            spellCheck="false"
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              setSearchQuery(q);
              refilter(activeCategory, q, uploadedFonts);
            }}
          />
        </div>

        <SegmentedControl<FontCategory>
          size="sm"
          options={FONT_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
          value={activeCategory}
          onChange={(cat) => {
            setActiveCategory(cat);
            refilter(cat, searchQuery, uploadedFonts);
          }}
          ariaLabel="Font category"
          className="fp-seg"
        />
      </div>

      <div className="fp-hr" />

      {/* Font List: the highlight is one element that springs between rows */}
      <div
        ref={listRef}
        id={`${pickerId}-lb`}
        role="listbox"
        aria-label="Font family"
        tabIndex={-1}
        onScroll={handleListScroll}
        onMouseLeave={() => cbRef.current.onPreview?.(null)}
        className="fp-list"
      >
        <i ref={hlRef} className="fp-hl" aria-hidden="true" />
        {groups.map((g) =>
          g.entries.length === 0 ? null : (
            <div key={g.key} data-fp-group={g.key} role="group" aria-label={g.label} className="fp-g">
              <div className="fp-gh">
                {g.label}
                <span className="fp-gl" />
              </div>
              {g.entries.map((entry) => renderFontRow(entry))}
            </div>
          )
        )}
        {flatVisible.length === 0 && <div className="fp-empty">No fonts match</div>}
      </div>

      <div className="fp-hr" />

      {/* Footer (Upload Font & Google Fonts buttons) */}
      <div className="fp-ft">
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <Icon icon={Plus} size={14} />
          Upload font…
        </button>
        <button type="button" onClick={handleGoogleFontsClick}>
          Google Fonts
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleFileUpload}
          hidden
          aria-label="Upload font file"
        />
      </div>
    </div>,
    document.body
  );

  function renderFontRow(entry: FontEntry) {
    const isSelected = entry.name === value;
    const slices = matchHighlight(entry.name, searchQuery) ?? [
      { text: entry.name, isMatch: false },
    ];
    const idx = flatVisible.findIndex((f) => f.name === entry.name);

    return (
      <div
        key={entry.name}
        id={`${pickerId}-o-${idx}`}
        data-fp-row
        data-fp-family={entry.name}
        role="option"
        aria-selected={isSelected}
        onClick={() => {
          activate(entry.name, { quiet: true });
          pick(entry.name);
        }}
        onMouseMove={(e) => {
          if ((!e.movementX && !e.movementY) || act === entry.name) return;
          activate(entry.name);
        }}
        className="fp-r"
      >
        <Icon icon={Check} size={14} className="fp-ck" />
        <span style={{ fontFamily: fontStack(entry.name) }} className="fp-n">
          {slices.map((slice, i) =>
            slice.isMatch ? <em key={i}>{slice.text}</em> : <span key={i}>{slice.text}</span>
          )}
        </span>
        <span className="fp-m">{entry.meta}</span>
      </div>
    );
  }
}
