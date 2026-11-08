"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { Spring } from "../motion/spring";
import { defaultHost, simAdd, type Sim } from "../motion/loop";
import { MOT, MENU_FALLBACKS } from "../motion/presets";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { springAnim, cancelAll } from "../motion/ease";
import {
  surf,
  blurIn,
  hlMove,
  type Surf,
} from "../motion/surface";
import { Icon } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: readonly SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  variant?: "default" | "floating";
  className?: string;
  width?: number | string;
  "aria-label"?: string;
  searchable?: boolean;
  mixed?: boolean;
  id?: string;
}

const RH = 28;
const SH = 36;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function ghostText(el: HTMLElement, txt: string | null, rect: DOMRect): HTMLDivElement {
  const g = document.createElement("div");
  const c = getComputedStyle(el);
  g.textContent = txt !== null ? txt : el.textContent;
  g.setAttribute("aria-hidden", "true");
  g.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;height:${rect.height}px;margin:0;pointer-events:none;z-index:90;white-space:nowrap;font:${c.font};color:${c.color};line-height:${rect.height}px;transform-origin:0 50%`;
  document.body.appendChild(g);
  return g;
}

function ghostOut(g: HTMLDivElement, dy: number): void {
  const a = g.animate(
    [
      { opacity: 1, filter: "blur(0px)", translate: "0 0" },
      { opacity: 0, filter: "blur(4px)", translate: `0 ${dy}px` },
    ],
    { duration: 200, easing: "ease-out", fill: "forwards" }
  );
  a.onfinish = a.oncancel = () => g.remove();
}

interface SelectMotion {
  scSpring: Spring;
  bvSpring: Spring;
  ckSpring: Spring;
  shiftSpring: Spring;
  scrollSim: Sim;
  bulgeSim: Sim;
  checkSim: Sim;
  shiftSim: Sim;
  scAct: boolean;
}

function applyBulgeEl(
  l: HTMLElement,
  ddi: HTMLElement,
  bvSpring: Spring,
  isLong: boolean,
  maxScroll: number
): void {
  if (!isLong || prefersReducedMotion()) return;

  const h = l.clientHeight;
  const st = l.scrollTop;
  const c = st + h / 2;
  const S = 1 * (1 + 0.9 * clamp(bvSpring.x, 0, 1));
  const r3 = RH * 3;

  const rowEls = Array.from(ddi.querySelectorAll<HTMLElement>(".ll-dd-o"));
  rowEls.forEach((r) => {
    const y = r.offsetTop + RH / 2 - c;
    const ay = Math.abs(y);
    const inner = r.firstElementChild as HTMLElement | null;
    if (!inner) return;
    if (ay > h / 2 + RH) return;

    const ramp = y < 0 ? Math.min(1, st / r3) : Math.min(1, (maxScroll - st) / r3);
    let e = clamp((ay / (h / 2) - 0.4) / 0.6, 0, 1);
    e = e * e * (3 - 2 * e);
    const k = e * ramp * S;
    const sc = 1 - 0.08 * Math.min(k, 1.4);
    const op = Math.max(0.3, 1 - 0.4 * k);
    const b = Math.min(3.2, clamp((24 - (h / 2 - ay)) / 24, 0, 1) * ramp * S * 1.8);

    inner.style.scale = sc.toFixed(3);
    inner.style.opacity = op.toFixed(2);
    inner.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : "";
  });
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  disabled = false,
  size = "md",
  variant = "default",
  className = "",
  width,
  "aria-label": ariaLabel,
  searchable,
  mixed = false,
  id,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const ddlRef = useRef<HTMLDivElement>(null);
  const ddiRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const surfRef = useRef<Surf | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isRendered, setIsRendered] = useState(false);

  const motionRef = useRef<SelectMotion | null>(null);
  const getMotion = useCallback((): SelectMotion => {
    if (!motionRef.current) {
      const scSpring = new Spring(0, [0.3, 0.9]);
      const bvSpring = new Spring(0, [0.35, 0.85]);
      const ckSpring = new Spring(0, [0.3, 0.62]);
      const shiftSpring = new Spring(0, [0.42, 0.55]);

      motionRef.current = {
        scSpring,
        bvSpring,
        ckSpring,
        shiftSpring,
        scAct: false,
        scrollSim: {
          sp: [scSpring],
          apply: () => {
            if (ddlRef.current) {
              ddlRef.current.scrollTop = scSpring.x;
            }
          },
          rest: () => {
            if (motionRef.current) {
              motionRef.current.scAct = false;
            }
          },
        },
        bulgeSim: {
          sp: [bvSpring],
          apply: () => {
            const l = ddlRef.current;
            const ddi = ddiRef.current;
            if (l && ddi) {
              applyBulgeEl(l, ddi, bvSpring, isLongRef.current, maxScrollRef.current);
            }
          },
        },
        checkSim: {
          sp: [ckSpring],
          apply: () => {
            const ck = menuRef.current?.querySelector<HTMLElement>(".ll-dd-ck");
            if (ck) {
              ck.style.translate = `0 ${ckSpring.x.toFixed(2)}px`;
            }
          },
        },
        shiftSim: {
          sp: [shiftSpring],
          apply: () => {
            if (surfRef.current?.lay) {
              surfRef.current.lay.style.translate = `0px ${(shiftSpring.x - surfRef.current.Y.x).toFixed(2)}px`;
            }
          },
        },
      };
    }
    return motionRef.current;
  }, []);

  const tgtScrollRef = useRef(0);
  const maxScrollRef = useRef(0);
  const isLongRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeAheadRef = useRef("");
  const typeAheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBusyRef = useRef(false);

  const isSearchEnabled = searchable ?? options.length > 12;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Filtered items
  const filteredOptions = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  // Bulge calculation: rows near edges scale to 0.92, fade, and slight blur
  const applyBulge = useCallback(() => {
    const l = ddlRef.current;
    const ddi = ddiRef.current;
    if (!l || !ddi) return;
    const m = getMotion();
    applyBulgeEl(l, ddi, m.bvSpring, isLongRef.current, maxScrollRef.current);
  }, [getMotion]);

  const scrollToY = useCallback((y: number) => {
    const m = getMotion();
    tgtScrollRef.current = clamp(y, 0, maxScrollRef.current);
    m.scSpring.to = tgtScrollRef.current;
    m.scAct = true;
    simAdd(m.scrollSim);
  }, [getMotion]);

  // Attach Surf instance to menu element
  useEffect(() => {
    if (!isRendered || !menuRef.current) return;
    const menuEl = menuRef.current;
    const s = surf(menuEl);
    surfRef.current = s;
    const m = getMotion();

    // Connect shift spring to surf paint
    const origPaint = s.paint.bind(s);
    s.paint = () => {
      origPaint();
      s.lay.style.translate = `0px ${(m.shiftSpring.x - s.Y.x).toFixed(2)}px`;
    };

    return () => {
      s.reset();
    };
  }, [isRendered, getMotion]);

  const closeDropdown = useCallback((focusTrigger = true) => {
    setIsOpen(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (typeAheadTimerRef.current) clearTimeout(typeAheadTimerRef.current);

    if (surfRef.current) {
      surfRef.current.leave();
    }

    const exitDuration = prefersReducedMotion() ? MENU_FALLBACKS.reducedMotionDuration : MOT.exitDelay + MOT.exitMs;
    setTimeout(() => {
      setIsRendered(false);
      setQuery("");
      isBusyRef.current = false;
      if (focusTrigger && triggerRef.current?.isConnected) {
        triggerRef.current.focus({ preventScroll: true });
      }
    }, exitDuration);
  }, []);

  const openDropdown = useCallback((kb = false) => {
    if (disabled || isOpen) return;
    setIsRendered(true);
    setIsOpen(true);
    isBusyRef.current = false;

    // Use motion loop frame callback to let portal DOM mount
    const unreg = defaultHost.register(() => {
      unreg();
      const menuEl = menuRef.current;
      const s = surfRef.current;
      const fld = fieldRef.current;
      const ddi = ddiRef.current;
      const ddl = ddlRef.current;
      if (!menuEl || !s || !fld || !ddi || !ddl) return;

      const m = getMotion();
      s.reset();
      m.shiftSpring.jump(0);

      const box = fld.getBoundingClientRect();
      const sH = isSearchEnabled ? SH : 0;
      const contentH = ddi.offsetHeight;
      const maxH = Math.min(
        MENU_FALLBACKS.selectListMaxHeight,
        window.innerHeight - MENU_FALLBACKS.selectListViewportGap - sH - MENU_FALLBACKS.selectListBorderAllowance
      );
      const ddlH = Math.min(contentH, maxH);

      ddl.style.height = `${ddlH}px`;
      isLongRef.current = contentH > ddlH + 1;
      maxScrollRef.current = Math.max(0, contentH - ddlH);

      const rows = Array.from(ddi.querySelectorAll<HTMLElement>(".ll-dd-o"));
      const curRow = selectedIndex >= 0 ? rows[selectedIndex] : rows[0];

      const st = (isLongRef.current && curRow)
        ? clamp(curRow.offsetTop + RH / 2 - ddlH / 2, 0, maxScrollRef.current)
        : 0;

      ddl.scrollTop = st;
      m.scSpring.jump(st);
      tgtScrollRef.current = st;
      lastScrollTopRef.current = st;
      lastScrollTimeRef.current = performance.now();
      m.scAct = false;
      m.bvSpring.jump(0);

      const H = sH + ddlH + 2;
      const ro = curRow ? 1 + sH + curRow.offsetTop - st : 1 + sH;
      const top = clamp(
        box.top + (box.height - RH) / 2 - ro,
        MENU_FALLBACKS.viewportPadding,
        window.innerHeight - MENU_FALLBACKS.viewportPadding - H
      );
      const left = clamp(
        box.left,
        MENU_FALLBACKS.viewportPadding,
        window.innerWidth - MENU_FALLBACKS.viewportPadding - (menuEl.offsetWidth || box.width)
      );

      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;
      menuEl.style.minWidth = `${box.width}px`;

      const y0 = box.top - top;
      const fldRadius = parseFloat(getComputedStyle(fld).borderRadius) || MENU_FALLBACKS.edgeGap;

      s.open({
        from: { w: box.width, h: box.height, r: fldRadius },
        y0,
      });

      cancelAll(ddl);

      const ckEl = menuEl.querySelector<HTMLElement>(".ll-dd-ck");
      if (curRow && ckEl) {
        m.ckSpring.jump(curRow.offsetTop + (RH - 14) / 2);
        ckEl.style.translate = `0 ${m.ckSpring.x}px`;
        ckEl.style.opacity = selectedIndex >= 0 ? "1" : "0";
      }

      if (curRow) {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        hlMove(ddi, curRow, true);
      }

      if (!prefersReducedMotion() && curRow) {
        const p = getActivePreset();
        const cr = curRow.offsetTop;
        rows.forEach((r) => {
          const ot = r.offsetTop;
          if (ot + RH < st - RH || ot > st + ddlH + RH) return;
          const d = 40 + Math.min(Math.abs(ot - cr) / RH | 0, 10) * p.stagger;
          const ty = clamp((cr - ot) * 0.3, -18, 18);
          springAnim(
            r,
            [{ scale: String(p.rowScale), translate: `0 ${ty}px` }, { scale: "1", translate: "0 0" }],
            p.rows[0],
            p.rows[1],
            { delay: d, fill: "backwards" }
          );
          blurIn(r, d);
        });
      }

      applyBulge();

      if (kb) {
        menuEl.classList.add("ll-kb");
      } else {
        menuEl.classList.remove("ll-kb");
      }

      if (isSearchEnabled && searchInputRef.current) {
        searchInputRef.current.focus({ preventScroll: true });
      } else {
        ddl.focus({ preventScroll: true });
      }
    });
  }, [
    disabled,
    isOpen,
    isSearchEnabled,
    selectedIndex,
    applyBulge,
    getMotion,
  ]);

  // Pick a value with flying label animation and pop landing
  const pickRow = useCallback(
    (idx: number) => {
      const opt = options[idx];
      if (!opt || opt.disabled || isBusyRef.current) return;

      const fld = fieldRef.current;
      const le = labelRef.current;
      const ddi = ddiRef.current;
      if (!fld || !ddi) {
        onChange?.(opt.value);
        closeDropdown(true);
        return;
      }

      if (idx === selectedIndex) {
        closeDropdown(true);
        return;
      }

      isBusyRef.current = true;
      const rows = Array.from(ddi.querySelectorAll<HTMLElement>(".ll-dd-o"));
      const row = rows[idx];

      const box = fld.getBoundingClientRect();
      const le0 = le && le.isConnected;

      if (le0 && !prefersReducedMotion()) {
        const g = ghostText(le, null, le.getBoundingClientRect());
        ghostOut(g, -6);
      }

      onChange?.(opt.value);

      const ckEl = menuRef.current?.querySelector<HTMLElement>(".ll-dd-ck");
      const ghEl = menuRef.current?.querySelector<HTMLElement>(".ll-dd-gh");
      if (ckEl) ckEl.style.opacity = "1";
      if (ghEl) ghEl.style.opacity = "0";

      const m = getMotion();
      if (row) {
        m.ckSpring.to = row.offsetTop + (RH - 14) / 2;
        hlMove(ddi, row);
      }

      if (prefersReducedMotion()) {
        m.ckSpring.jump(m.ckSpring.to);
        if (ckEl) ckEl.style.translate = `0 ${m.ckSpring.x}px`;
        if (le0 && le) springAnim(le, [{ opacity: 0 }, { opacity: 1 }], 0.2, 1);
        closeDropdown(true);
        return;
      }

      simAdd(m.checkSim);
      if (le0 && le) le.style.opacity = "0";

      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      landTimerRef.current = setTimeout(() => {
        if (!row) {
          closeDropdown(true);
          return;
        }
        const rr = row.getBoundingClientRect();
        const lbEl = row.querySelector<HTMLElement>(".ll-dd-lb");
        const lb = lbEl?.getBoundingClientRect();
        const p = getActivePreset();

        m.shiftSpring.tune(p.shape);
        m.shiftSpring.to = box.top + box.height / 2 - (rr.top + rr.height / 2);
        simAdd(m.shiftSim);

        closeDropdown(true);

        if (!le0 || !le || !le.isConnected || !lbEl || !lb) return;
        const tr = le.getBoundingClientRect();
        const s0 =
          parseFloat(getComputedStyle(lbEl).fontSize) /
          (parseFloat(getComputedStyle(le).fontSize) || MENU_FALLBACKS.defaultFontSize);
        const fly = ghostText(le, opt.label, tr);

        let done = false;
        const land = () => {
          if (done) return;
          done = true;
          fly.remove();
          le.style.opacity = "";
          le.style.transformOrigin = "0 50%";
          springAnim(le, [{ scale: ".88" }, { scale: "1" }], p.pop[0], p.pop[1]);
        };

        const an = springAnim(
          fly,
          [
            {
              translate: `${lb.left - tr.left}px ${lb.top + lb.height / 2 - tr.top - tr.height / 2}px`,
              scale: String(s0),
            },
            { translate: "0 0", scale: "1" },
          ],
          p.flip[0],
          p.flip[1],
          { fill: "both" }
        );

        if (an) an.onfinish = land;
        setTimeout(land, an ? 1200 : 0);
      }, MENU_FALLBACKS.selectionDelay);
    },
    [closeDropdown, getMotion, onChange, options, selectedIndex]
  );

  // Closed field ArrowUp / ArrowDown roll like an odometer
  const rollValue = useCallback(
    (dir: number) => {
      if (disabled || !options.length) return;
      const n = options.length;
      const cur = selectedIndex;
      const next = clamp(cur + dir, 0, n - 1);
      if (next === cur) return;

      const le = labelRef.current;
      const p = getActivePreset();

      if (!prefersReducedMotion() && le) {
        const g = ghostText(le, null, le.getBoundingClientRect());
        ghostOut(g, -dir * 9);
      }

      onChange?.(options[next].value);

      if (prefersReducedMotion()) {
        if (le) springAnim(le, [{ opacity: 0 }, { opacity: 1 }], 0.2, 1);
        return;
      }

      if (le) {
        le.style.transformOrigin = "0 50%";
        springAnim(le, [{ translate: `0 ${dir * 9}px` }, { translate: "0 0" }], p.pop[0], p.pop[1]);
        le.animate(
          [
            { opacity: 0, filter: "blur(3px)" },
            { opacity: 1, filter: "blur(0px)" },
          ],
          { duration: 180, easing: "cubic-bezier(.2,.8,.3,1)" }
        );
      }
    },
    [disabled, onChange, options, selectedIndex]
  );

  // Scroll handler for momentum and bulge
  const handleScroll = useCallback(() => {
    const l = ddlRef.current;
    if (!l) return;
    const m = getMotion();
    const st = l.scrollTop;
    const now = performance.now();
    const dt = Math.max(1, now - lastScrollTimeRef.current);

    if (!m.scAct) {
      m.scSpring.x = m.scSpring.to = tgtScrollRef.current = st;
      m.scSpring.v = 0;
    }

    m.bvSpring.to = Math.min(1, Math.abs(st - lastScrollTopRef.current) / dt / 1.2);
    lastScrollTopRef.current = st;
    lastScrollTimeRef.current = now;

    simAdd(m.bulgeSim);
    applyBulge();

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      m.bvSpring.to = 0;
      simAdd(m.bulgeSim);
    }, 90);
  }, [applyBulge, getMotion]);

  // Wheel handler with endBump past boundaries (native listener with { passive: false })
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const s = surfRef.current;
      if (!isLongRef.current || !d) return;

      e.preventDefault();
      e.stopPropagation();

      const bound = (d < 0 && tgtScrollRef.current <= 0) || (d > 0 && tgtScrollRef.current >= maxScrollRef.current);
      if (bound && Math.abs(d) >= 4 && s && Date.now() >= s.lock) {
        s.endBump(d > 0 ? 1 : -1);
        s.lock = Date.now() + getActivePreset().lock;
      }

      scrollToY(tgtScrollRef.current + d);
    },
    [scrollToY]
  );

  useEffect(() => {
    const el = ddlRef.current;
    if (!el || !isRendered) return;

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isRendered, handleWheel]);

  // Hover item in dropdown
  const handleItemHover = useCallback((idx: number) => {
    setActiveIndex(idx);
    const ddi = ddiRef.current;
    const menuEl = menuRef.current;
    if (!ddi || !menuEl) return;
    const rows = Array.from(ddi.querySelectorAll<HTMLElement>(".ll-dd-o"));
    const row = rows[idx];
    if (!row) return;

    menuEl.classList.remove("ll-kb");
    rows.forEach((r) => r.classList.remove("ll-on"));
    row.classList.add("ll-on");
    hlMove(ddi, row);

    const ghEl = menuEl.querySelector<HTMLElement>(".ll-dd-gh");
    if (ghEl) {
      if (idx === selectedIndex) {
        ghEl.style.opacity = "0";
      } else {
        ghEl.style.translate = `0 ${row.offsetTop + (RH - 14) / 2}px`;
        ghEl.style.opacity = "0.3";
      }
    }
  }, [selectedIndex]);

  // Key navigation when dropdown is open
  const handleOpenKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const k = e.key;
      const n = filteredOptions.length;
      const isInput = e.target === searchInputRef.current;

      if (k === "Escape" || k === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        closeDropdown(true);
        return;
      }

      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        menuRef.current?.classList.add("ll-kb");
        if (!n) return;
        const next =
          activeIndex < 0
            ? selectedIndex >= 0
              ? selectedIndex
              : k === "ArrowDown"
              ? 0
              : n - 1
            : clamp(activeIndex + (k === "ArrowDown" ? 1 : -1), 0, n - 1);
        handleItemHover(next);

        const row = ddiRef.current?.querySelectorAll<HTMLElement>(".ll-dd-o")[next];
        if (row && ddlRef.current) {
          const h = ddlRef.current.clientHeight;
          const top = row.offsetTop;
          if (top < tgtScrollRef.current + RH) scrollToY(top - RH);
          else if (top + RH > tgtScrollRef.current + h - RH) scrollToY(top + 2 * RH - h);
        }
        return;
      }

      if (!isInput && (k === "Home" || k === "End" || k === "PageDown" || k === "PageUp")) {
        e.preventDefault();
        e.stopPropagation();
        menuRef.current?.classList.add("ll-kb");
        if (!n) return;
        const next =
          k === "Home"
            ? 0
            : k === "End"
            ? n - 1
            : clamp(activeIndex + (k === "PageDown" ? 8 : -8), 0, n - 1);
        handleItemHover(next);
        return;
      }

      if (k === "Enter" || (k === " " && !isInput)) {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex >= 0 && filteredOptions[activeIndex]) {
          const originalIdx = options.findIndex((o) => o.value === filteredOptions[activeIndex].value);
          pickRow(originalIdx);
        }
        return;
      }

      if (!isInput && k === "/" && searchInputRef.current) {
        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current.focus();
        return;
      }

      if (!isInput && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.stopPropagation();
        if (typeAheadTimerRef.current) clearTimeout(typeAheadTimerRef.current);
        typeAheadRef.current += k.toLowerCase();
        typeAheadTimerRef.current = setTimeout(() => {
          typeAheadRef.current = "";
        }, 700);

        const matchIdx = filteredOptions.findIndex((o) =>
          o.label.toLowerCase().startsWith(typeAheadRef.current)
        );
        if (matchIdx >= 0) {
          handleItemHover(matchIdx);
          const row = ddiRef.current?.querySelectorAll<HTMLElement>(".ll-dd-o")[matchIdx];
          if (row && ddlRef.current) {
            scrollToY(row.offsetTop + RH / 2 - ddlRef.current.clientHeight / 2);
          }
        }
      }
    },
    [activeIndex, closeDropdown, filteredOptions, handleItemHover, options, pickRow, scrollToY, selectedIndex]
  );

  // Closed field keydown (ArrowDown/Up rolls like odometer; Alt+ArrowDown opens)
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      openDropdown(true);
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      rollValue(e.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      openDropdown(true);
    }
  };

  // Outside click when open
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (fieldRef.current?.contains(target)) return;
      closeDropdown(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, closeDropdown]);

  return (
    <div
      className={`ll:inline-flex ll:flex-col ll:gap-1 ll:w-full ${className}`}
      style={width ? { width: typeof width === "number" ? `${width}px` : width } : undefined}
    >
      <div
        ref={fieldRef}
        data-open={isOpen ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        data-mixed={mixed ? "true" : undefined}
        className="ll:relative ll:flex ll:items-center ll:w-full"
      >
        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={ariaLabel ?? label}
          disabled={disabled}
          onClick={() => (isOpen ? closeDropdown() : openDropdown(false))}
          onKeyDown={handleTriggerKeyDown}
          className={`ll-dfield ll-dd ll:relative ll:flex ll:items-center ll:justify-between ll:gap-2 ll:w-full ${
            size === "sm" ? "ll:h-7" : "ll:h-8"
          } ll:px-2 ll:rounded-sm ll:border ll:border-solid ${
            variant === "floating"
              ? isOpen
                ? "ll:border-primary ll:bg-surface-bar"
                : "ll:border-border ll:hover:border-muted ll:bg-surface-bar"
              : isOpen
              ? "ll:border-primary ll:bg-surface-bar"
              : "ll:border-transparent ll:hover:border-muted ll:bg-surface-bar"
          } ll:text-left ll:select-none ll:outline-none ll:appearance-none ll:focus-visible:border-primary`}
        >
          <span
            ref={labelRef}
            className="ll-ddt ll:flex-1 ll:truncate ll:font-mono ll:text-micro ll:font-normal ll:tracking-normal ll:text-primary"
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          <Icon
            icon={ChevronDown}
            size={12}
            className="ll-dchev ll:text-muted ll:shrink-0"
          />
        </button>
      </div>

      {isRendered &&
        createPortal(
          <div
            ref={menuRef}
            role="presentation"
            tabIndex={-1}
            onKeyDown={handleOpenKeyDown}
            className="ll-menu ll-dd ll:fixed ll:z-80 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:overflow-hidden ll:outline-none ll:font-sans"
          >
            <div ref={layRef} className="ll-lay">
              {isSearchEnabled && (
                <div className="ll-dd-s ll:flex ll:items-center ll:gap-2 ll:h-9 ll:px-3 ll:border-b ll:border-border ll:text-muted">
                  <Icon icon={Search} size={14} className="ll:shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="searchbox"
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="Search..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    className="ll:flex-1 ll:bg-transparent ll:border-0 ll:outline-none ll:text-small ll:text-primary ll:placeholder:text-muted"
                  />
                </div>
              )}

              <div
                ref={ddlRef}
                id={listboxId}
                role="listbox"
                tabIndex={-1}
                aria-label={ariaLabel ?? label ?? "Options"}
                onScroll={handleScroll}
                className="ll-ddl ll:overflow-y-auto ll:overscroll-contain"
              >
                <div ref={ddiRef} className="ll-ddi ll:relative ll:p-1">
                  <i aria-hidden="true" className="ll-hl" />
                  <i aria-hidden="true" className="ll-dd-gh">
                    <Icon icon={Check} size={14} />
                  </i>
                  <i aria-hidden="true" className="ll-dd-ck">
                    <Icon icon={Check} size={14} />
                  </i>

                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((opt, i) => {
                      const isSelected = opt.value === value;
                      const originalIdx = options.findIndex((o) => o.value === opt.value);
                      return (
                        <div
                          key={opt.value}
                          role="option"
                          id={`${listboxId}-opt-${originalIdx}`}
                          aria-selected={isSelected}
                          data-idx={originalIdx}
                          data-cur={isSelected ? "true" : undefined}
                          onClick={() => pickRow(originalIdx)}
                          onMouseEnter={() => handleItemHover(i)}
                          className="ll-dd-o ll:flex ll:items-center ll:h-7 ll:cursor-pointer ll:rounded-sm"
                        >
                          <span className="ll-dd-i ll:flex ll:items-center ll:gap-2 ll:w-full ll:h-full ll:pl-8 ll:pr-3 ll:text-small ll:whitespace-nowrap">
                            <span className="ll-dd-lb ll:truncate ll:text-primary">
                              {opt.label}
                            </span>
                            {opt.hint && (
                              <span className="ll-dd-h ll:ml-auto ll:font-mono ll:text-micro ll:text-muted">
                                {opt.hint}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="ll-dd-none ll:flex ll:items-center ll:justify-center ll:h-14 ll:text-small ll:text-muted">
                      No results
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
