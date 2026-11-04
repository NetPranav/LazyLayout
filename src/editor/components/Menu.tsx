"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
  useId,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { ChevronRight, Check } from "lucide-react";
import { defaultHost } from "../motion/loop";
import { MOT, MENU_FALLBACKS } from "../motion/presets";
import { prefersReducedMotion } from "../motion/feel";
import {
  surf,
  pressEl,
  popRow,
  wiggle,
  hlMove,
  hlHide,
  swapIn,
  ghostOf,
  inSafeTriangle,
  type Surf,
} from "../motion/surface";
import { useMounted } from "./useMounted";
import { Icon } from "./Icon";

// Pointer tracking for safe triangle submenu hover protection
const mousePos = { x: 0, y: 0, prevX: 0, prevY: 0, t: 0 };

export interface MenuItemData {
  id: string;
  el: HTMLElement;
  label: string;
  isSubMenu?: boolean;
}

export interface SubMenuData {
  id: string;
  label: string;
  rowEl: HTMLElement;
  children: React.ReactNode;
}

interface MenuContextValue {
  closeMenu: () => void;
  registerItem: (item: MenuItemData) => void;
  unregisterItem: (id: string) => void;
  registerSubMenu: (sub: SubMenuData) => void;
  unregisterSubMenu: (id: string) => void;
  moveHighlight: (rowEl: HTMLElement, instant?: boolean) => void;
  hideHighlight: () => void;
  hoverRow: (rowEl: HTMLElement, subId?: string) => void;
  openSubmenuId: string | null;
  getMenuEl: () => HTMLElement | null;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function placeSub(parentEl: HTMLElement, rowEl: HTMLElement, w: number, h: number) {
  const pad =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--ll-spacing-2"
      )
    ) || MENU_FALLBACKS.viewportPadding;
  const edgeGap =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--ll-submenu-gap"
      )
    ) || MENU_FALLBACKS.edgeGap;

  const parentRect = parentEl.getBoundingClientRect();
  const r = rowEl.getBoundingClientRect();
  const parentLeft = parentRect.left;
  const parentWidth = parentRect.width;

  let x = parentLeft + parentWidth + edgeGap;
  const flip = x + w > window.innerWidth - pad;
  if (flip) {
    x = parentLeft - edgeGap - w;
  }
  const top = Math.max(pad, Math.min(r.top - edgeGap, window.innerHeight - h - pad));
  return {
    x: Math.max(pad, Math.min(x, window.innerWidth - w - pad)),
    top,
    flip,
    rowY: r.top - top,
  };
}

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  anchorRef?: React.RefObject<HTMLElement | null>;
  position?: { x: number; y: number } | null;
  width?: number | string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  variant?: "default" | "context" | "wide";
  id?: string;
}

export const Menu: React.FC<MenuProps> = ({
  open,
  onClose,
  anchorEl,
  anchorRef,
  position,
  width,
  className = "",
  children,
  "aria-label": ariaLabel = "Menu",
  variant = "default",
  id,
}) => {
  const autoId = useId();
  const mounted = useMounted();
  const menuRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);

  // Single shared flyout submenu surface for all submenus
  const subElRef = useRef<HTMLDivElement>(null);
  const subLayRef = useRef<HTMLDivElement>(null);
  const subSurfRef = useRef<Surf | null>(null);

  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [inSub, setInSub] = useState(false);
  const inSubRef = useRef(false);

  useEffect(() => {
    inSubRef.current = inSub;
  }, [inSub]);

  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    } else {
      setInSub(false);
      setActiveSubId(null);
    }
  }

  const itemsRef = useRef<MenuItemData[]>([]);
  const [subMenus, setSubMenus] = useState<Record<string, SubMenuData>>({});
  const activeSubRowRef = useRef<HTMLElement | null>(null);
  const subTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submenu registry
  const registerSubMenu = useCallback((sub: SubMenuData) => {
    setSubMenus((prev) => ({ ...prev, [sub.id]: sub }));
  }, []);

  const unregisterSubMenu = useCallback((subId: string) => {
    setSubMenus((prev) => {
      const next = { ...prev };
      delete next[subId];
      return next;
    });
  }, []);

  // Initialize Surf instances for menu and single flyout submenu
  useEffect(() => {
    if (!isRendered || !menuRef.current) return;
    const menuEl = menuRef.current;
    const s = surf(menuEl);
    surfRef.current = s;

    return () => {
      s.reset();
    };
  }, [isRendered]);

  useEffect(() => {
    if (!isRendered || !subElRef.current) return;
    const subEl = subElRef.current;
    const s = surf(subEl);
    subSurfRef.current = s;

    return () => {
      s.reset();
    };
  }, [isRendered]);

  const moveHighlight = useCallback((rowEl: HTMLElement, instant = false) => {
    if (!menuRef.current || !rowEl) return;
    hlMove(menuRef.current, rowEl, instant);
  }, []);

  const hideHighlight = useCallback(() => {
    if (menuRef.current) {
      hlHide(menuRef.current);
    }
  }, []);

  const closeSub = useCallback((restoreFocus = false) => {
    if (subTimerRef.current) {
      clearTimeout(subTimerRef.current);
      subTimerRef.current = null;
    }
    setInSub(false);
    inSubRef.current = false;
    const parentRow = activeSubRowRef.current;
    if (parentRow) {
      if (restoreFocus) {
        parentRow.focus();
        moveHighlight(parentRow);
      }
      activeSubRowRef.current = null;
    }
    setActiveSubId(null);
    if (subSurfRef.current) {
      subSurfRef.current.leave();
    }
  }, [moveHighlight]);

  const openSub = useCallback((rowEl: HTMLElement, subId: string) => {
    if (subTimerRef.current) {
      clearTimeout(subTimerRef.current);
      subTimerRef.current = null;
    }
    const sbm = subElRef.current;
    const ss = subSurfRef.current;
    const mm = menuRef.current;
    if (!sbm || !ss || !mm) return;

    const live = sbm.classList.contains("ll-open");
    if (activeSubRowRef.current === rowEl && live) return;

    // A new or swapped submenu starts without a highlight left over from the previous one
    hlHide(sbm);

    if (live || (sbm.hasAttribute("data-lv") && !prefersReducedMotion())) {
      // Retarget open submenu surface (swapSub)
      const oldRow = activeSubRowRef.current;
      const oldTop = parseFloat(sbm.style.top) || 0;
      const oldLeft = parseFloat(sbm.style.left) || 0;
      let dir = 1;
      if (oldRow) {
        dir = rowEl.getBoundingClientRect().top >= oldRow.getBoundingClientRect().top ? 1 : -1;
      }
      activeSubRowRef.current = rowEl;

      if (!prefersReducedMotion()) {
        ss.wake();
        if (live) {
          ghostOf(sbm, dir);
        } else {
          ss.timers.forEach(clearTimeout);
          ss.timers = [];
          if (typeof sbm.getAnimations === "function") {
            sbm.getAnimations().forEach((a) => a.cancel());
          }
          sbm.classList.add("ll-open");
          sbm.removeAttribute("data-lv");
          ss.G.to = 0;
          ss.Y.to = 0;
        }
      }

      // Commit the new list before the next frame measures it, so the surface morphs to the right size
      flushSync(() => setActiveSubId(subId));

      const unreg = defaultHost.register(() => {
        unreg();
        if (!sbm || !ss) return;
        const m = ss.measure();
        const g = placeSub(mm, rowEl, m.w, m.h);
        if (g.flip) {
          sbm.dataset.flip = "true";
        } else {
          delete sbm.dataset.flip;
        }
        sbm.style.left = `${g.x}px`;
        sbm.style.top = `${g.top}px`;

        if (prefersReducedMotion()) {
          ss.lay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MENU_FALLBACKS.reducedMotionDuration, easing: "ease-out" });
          return;
        }

        ss.fit(m);
        ss.lay.style.width = `${m.cw}px`;
        ss.lay.style.height = `${Math.max(m.ch, m.sh)}px`;
        ss.right = g.flip;
        ss.slide = g.flip ? -1 : 1;
        ss.exitY = g.rowY;
        ss.Y.x += oldTop - g.top;
        ss.G.x += oldLeft - g.x;
        ss.shapeTo(ss.size, m.r);
        ss.Y.to = 0;
        ss.G.to = 0;
        ss.paint();
        ss.settleOrRun();
        swapIn(ss.lay, dir);
      });
      return;
    }

    // Fresh open
    ss.reset();
    activeSubRowRef.current = rowEl;
    flushSync(() => setActiveSubId(subId));

    const unreg = defaultHost.register(() => {
      unreg();
      if (!sbm || !ss) return;
      const m = ss.measure();
      const g = placeSub(mm, rowEl, m.w, m.h);
      if (g.flip) {
        sbm.dataset.flip = "true";
      } else {
        delete sbm.dataset.flip;
      }
      sbm.style.left = `${g.x}px`;
      sbm.style.top = `${g.top}px`;
      ss.open({
        right: g.flip,
        slide: g.flip ? -1 : 1,
        y0: g.rowY,
        from: {
          w: MENU_FALLBACKS.seedPointer.w,
          h: rowEl.offsetHeight,
          r: parseFloat(getComputedStyle(sbm).borderRadius) || MENU_FALLBACKS.menuRadius,
        },
      });
    });
  }, []);

  // Hover row logic with safe triangle and delays: open 80ms, switch 60ms, close 200ms
  const hoverRow = useCallback(
    (rowEl: HTMLElement, subId?: string) => {
      const sbm = subElRef.current;
      const mm = menuRef.current;
      if (!mm) return;

      if (subTimerRef.current) {
        clearTimeout(subTimerRef.current);
        subTimerRef.current = null;
      }

      // A row inside the open flyout moves the flyout's own highlight. The parent row keeps its highlight
      // so the user can see which item the submenu belongs to.
      const inFlyout = !!sbm && sbm.contains(rowEl);
      const surfaceEl = inFlyout && sbm ? sbm : mm;

      if (!rowEl.classList.contains("ll-on")) {
        wiggle(rowEl);
      }
      surfaceEl.querySelectorAll(".ll-lay > .ll-on").forEach((x) => x.classList.remove("ll-on"));
      rowEl.classList.add("ll-on");
      mm.classList.remove("ll-kb");
      hlMove(surfaceEl, rowEl);
      if (inFlyout) return;

      const subLive = sbm?.classList.contains("ll-open");

      if (subId) {
        const delay = subLive ? 60 : 80;
        subTimerRef.current = setTimeout(() => {
          openSub(rowEl, subId);
        }, delay);
      } else {
        if (subLive) {
          subTimerRef.current = setTimeout(() => {
            closeSub();
          }, 200);
        }
      }
    },
    [openSub, closeSub]
  );

  // Open & Close Menu Surf Physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const menuEl = menuRef.current;
    if (!s || !menuEl) return;

    const targetAnchor = anchorRef?.current ?? anchorEl;

    if (open) {
      // Reopening while the previous close is still animating (right-click again on the canvas): drop that
      // close's fade animation and reset timer first, or they hide the new menu after it has opened.
      s.reset();
      subSurfRef.current?.reset();
      if (!menuEl.contains(document.activeElement)) {
        prevActiveElementRef.current = document.activeElement as HTMLElement | null;
      }
      const pad =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-spacing-2"
          )
        ) || MENU_FALLBACKS.viewportPadding;
      const gap =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-submenu-gap"
          )
        ) || MENU_FALLBACKS.edgeGap;

      const defaultCtxW =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-size-menu-ctx-w"
          )
        ) || MENU_FALLBACKS.menuWidthContext;
      const defaultWideW =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-size-menu-wide-w"
          )
        ) || MENU_FALLBACKS.menuWidthWide;
      const defaultMenuW =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-size-menu-w"
          )
        ) || MENU_FALLBACKS.menuWidthDefault;

      let left = pad;
      let top = pad;
      let seed: { w: number; h: number; r: number } = { ...MENU_FALLBACKS.seedDefault, r: MENU_FALLBACKS.menuRadius };
      let up = false;

      const m = s.measure();
      const menuW =
        m.w ||
        (variant === "wide"
          ? defaultWideW
          : variant === "context"
          ? defaultCtxW
          : defaultMenuW);
      const menuH = m.h || (layRef.current?.offsetHeight ?? MENU_FALLBACKS.defaultMenuHeight);

      if (position) {
        left = Math.max(pad, Math.min(position.x, window.innerWidth - menuW - pad));
        top = Math.max(pad, Math.min(position.y, window.innerHeight - menuH - pad));
        seed = { ...MENU_FALLBACKS.seedPointer, r: MENU_FALLBACKS.menuRadius };
      } else if (targetAnchor) {
        const r = targetAnchor.getBoundingClientRect();
        left = Math.max(pad, Math.min(r.left, window.innerWidth - menuW - pad));
        top = r.bottom + gap;
        if (top + menuH > window.innerHeight - pad) {
          top = Math.max(pad, r.top - menuH - gap);
          up = true;
        }
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r: parseFloat(getComputedStyle(targetAnchor).borderRadius) || MENU_FALLBACKS.menuRadius,
        };
      }

      menuEl.style.left = `${Math.max(pad, left)}px`;
      menuEl.style.top = `${Math.max(pad, top)}px`;

      const y0 = position
        ? 0
        : targetAnchor
        ? (up ? 1 : -1) * (targetAnchor.getBoundingClientRect().height + gap)
        : 0;

      s.open({
        from: seed,
        y0,
        up,
      });

      const unreg = defaultHost.register(() => {
        unreg();
        menuEl.focus();
      });
    } else {
      if (subTimerRef.current) {
        clearTimeout(subTimerRef.current);
        subTimerRef.current = null;
      }
      if (activeSubRowRef.current) {
        activeSubRowRef.current = null;
      }
      if (subSurfRef.current) {
        subSurfRef.current.leave();
      }
      hideHighlight();
      s.leave();
      const exitDuration = prefersReducedMotion()
        ? MENU_FALLBACKS.reducedMotionDuration
        : MOT.exitDelay + MOT.exitMs;
      const t = setTimeout(() => {
        setIsRendered(false);
        if (prevActiveElementRef.current && document.contains(prevActiveElementRef.current)) {
          prevActiveElementRef.current.focus();
        }
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, anchorEl, anchorRef, position, variant, hideHighlight, closeSub]);

  // Outside click & global mousemove/pointerdown handling
  useEffect(() => {
    if (!open || !isRendered) return;
    const targetAnchor = anchorRef?.current ?? anchorEl;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (subElRef.current?.contains(target)) return;
      if (targetAnchor?.contains(target)) return;
      onClose();
    };

    const handlePointerOver = (e: MouseEvent) => {
      const sbm = subElRef.current;
      const mm = menuRef.current;
      if (!mm || !sbm) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (sbm.contains(target)) {
        setInSub(true);
        if (subTimerRef.current) {
          clearTimeout(subTimerRef.current);
          subTimerRef.current = null;
        }
        return;
      }

      if (mm.contains(target)) {
        setInSub(false);
        const row = target.closest<HTMLElement>('[role="menuitem"]');
        if (!row || (row as HTMLButtonElement).disabled) return;
        if (sbm.classList.contains("ll-open") && row !== activeSubRowRef.current && inSafeTriangle(sbm, mousePos)) {
          if (subTimerRef.current) clearTimeout(subTimerRef.current);
          subTimerRef.current = setTimeout(() => {
            if (row.matches(":hover") && !sbm.matches(":hover")) {
              const subId = row.dataset.subId;
              hoverRow(row, subId);
            }
          }, 100);
          return;
        }
        const subId = row.dataset.subId;
        hoverRow(row, subId);
      }
    };

    const handleMouseLeaveMenu = () => {
      const sbm = subElRef.current;
      if (sbm?.classList.contains("ll-open")) return;
      hideHighlight();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mm = menuRef.current;
      const sbm = subElRef.current;
      if (!mm) return;
      const subLive = sbm?.classList.contains("ll-open");
      const currentScope: HTMLElement = subLive && inSubRef.current && sbm ? sbm : mm;
      const list = Array.from(
        currentScope.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')
      );
      if (!list.length) return;

      const curIdx = list.findIndex((x) => x.classList.contains("ll-on"));

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (subLive) {
          closeSub(true);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        currentScope.classList.add("ll-kb");
        const next =
          e.key === "ArrowDown"
            ? (curIdx + 1) % list.length
            : curIdx <= 0
            ? list.length - 1
            : curIdx - 1;
        const target = list[next];
        if (target) {
          list.forEach((x) => x.classList.remove("ll-on"));
          target.classList.add("ll-on");
          hlMove(currentScope, target);
          wiggle(target);
          target.focus();

          if (subLive && !inSubRef.current) {
            const subId = target.dataset.subId;
            if (subId) {
              openSub(target, subId);
            } else {
              closeSub();
            }
          }
        }
        return;
      }

      if (e.key === "ArrowLeft" && subLive) {
        e.preventDefault();
        e.stopPropagation();
        closeSub(true);
        return;
      }

      if ((e.key === "ArrowRight" || e.key === "Enter") && !inSubRef.current && curIdx >= 0) {
        const cur = list[curIdx];
        const subId = cur?.dataset.subId;
        if (subId && cur) {
          e.preventDefault();
          e.stopPropagation();
          openSub(cur, subId);
          setInSub(true);
          const unreg = defaultHost.register(() => {
            unreg();
            if (sbm) {
              const first = sbm.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)');
              if (first) {
                hlMove(sbm, first);
                first.focus();
              }
            }
          });
          return;
        }
      }

      if (e.key === "Enter" && curIdx >= 0) {
        const cur = list[curIdx];
        if (cur) {
          e.preventDefault();
          e.stopPropagation();
          cur.click();
        }
      }
    };

    const currentMenuEl = menuRef.current;
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("mouseover", handlePointerOver);
    currentMenuEl?.addEventListener("mouseleave", handleMouseLeaveMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("mouseover", handlePointerOver);
      currentMenuEl?.removeEventListener("mouseleave", handleMouseLeaveMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isRendered, onClose, anchorEl, anchorRef, closeSub, hideHighlight, hoverRow, moveHighlight, openSub]);

  // Track mouse coordinates while menu is open for safe-triangle calculation
  useEffect(() => {
    if (!open) return;
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - mousePos.t > MENU_FALLBACKS.safeTriangleThrottle) {
        mousePos.prevX = mousePos.x;
        mousePos.prevY = mousePos.y;
        mousePos.t = now;
      }
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [open]);

  const registerItem = useCallback((item: MenuItemData) => {
    const list = itemsRef.current;
    const existing = list.findIndex((x) => x.id === item.id);
    if (existing >= 0) {
      list[existing] = item;
    } else {
      list.push(item);
    }
  }, []);

  const unregisterItem = useCallback((itemId: string) => {
    itemsRef.current = itemsRef.current.filter((x) => x.id !== itemId);
  }, []);

  const getMenuEl = useCallback(() => menuRef.current, []);

  const contextValue: MenuContextValue = useMemo(
    () => ({
      closeMenu: onClose,
      registerItem,
      unregisterItem,
      registerSubMenu,
      unregisterSubMenu,
      moveHighlight,
      hideHighlight,
      hoverRow,
      openSubmenuId: activeSubId,
      getMenuEl,
    }),
    [
      onClose,
      registerItem,
      unregisterItem,
      registerSubMenu,
      unregisterSubMenu,
      moveHighlight,
      hideHighlight,
      hoverRow,
      activeSubId,
      getMenuEl,
    ]
  );

  if (!mounted || !isRendered) return null;

  // Variant widths come from classes: the surface engine clears inline sizes while it measures the natural size
  const widthStyle =
    width !== undefined ? (typeof width === "number" ? `${width}px` : width) : undefined;
  const variantWidth =
    variant === "wide" ? "ll:w-menu-wide" : variant === "context" ? "ll:w-menu-ctx" : "";

  const activeSubData = activeSubId ? subMenus[activeSubId] : null;
  const menuId = id || `ll-menu-${autoId.replace(/:/g, "")}`;
  const subSurfaceId = `ll-sub-${autoId.replace(/:/g, "")}`;

  return createPortal(
    <>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        tabIndex={-1}
        aria-label={ariaLabel}
        data-variant={variant}
        className={`ll-menu ll:fixed ll:z-50 ll:box-border ll:origin-top-left ll:bg-surface-raised ll:border ll:border-border ll:shadow-soft ll:outline-none ll:font-sans ${
          variant === "context" ? "ll-ctx ll:p-1 ll:rounded-lg" : "ll:py-1 ll:rounded-md"
        } ${variantWidth} ${className}`}
        style={widthStyle ? { width: widthStyle } : undefined}
      >
        <div
          ref={layRef}
          className="ll-lay ll:flex ll:flex-col ll:gap-0 ll:max-h-menu ll:overflow-y-auto ll:overscroll-contain"
        >
          <i aria-hidden="true" className="ll-hl" />
          <MenuContext.Provider value={contextValue}>{children}</MenuContext.Provider>
        </div>
      </div>

      {/* Single side flyout surface for submenus */}
      <div
        ref={subElRef}
        id={subSurfaceId}
        role="menu"
        tabIndex={-1}
        data-submenu="true"
        aria-label={activeSubData?.label || "Submenu"}
        className="ll-menu ll-ctx ll-submenu ll:fixed ll:z-60 ll:box-border ll:origin-top-left ll:w-menu-ctx ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:p-1 ll:outline-none ll:font-sans"
      >
        <div
          ref={subLayRef}
          className="ll-lay ll:flex ll:flex-col ll:gap-0 ll:max-h-menu ll:overflow-y-auto ll:overscroll-contain"
        >
          <i aria-hidden="true" className="ll-hl" />
          <MenuContext.Provider value={contextValue}>
            {activeSubData?.children}
          </MenuContext.Provider>
        </div>
      </div>
    </>,
    document.body
  );
};

export interface MenuItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  role?: string;
  id?: string;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  children,
  icon,
  shortcut,
  disabled = false,
  checked,
  onClick,
  className = "",
  role = "menuitem",
  id,
}) => {
  const generatedId = useId();
  const itemId = id || generatedId;
  const itemRef = useRef<HTMLButtonElement>(null);
  const ctx = useContext(MenuContext);

  useEffect(() => {
    if (!itemRef.current || !ctx) return;
    const el = itemRef.current;
    const label = el.textContent || "";
    ctx.registerItem({ id: itemId, el, label });
    return () => {
      ctx.unregisterItem(itemId);
    };
  }, [ctx, itemId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || prefersReducedMotion()) return;
    pressEl(e.currentTarget, true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || prefersReducedMotion()) return;
    pressEl(e.currentTarget, false);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    popRow(e.currentTarget);
    onClick?.(e);
    ctx?.closeMenu();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    ctx?.hoverRow(e.currentTarget);
  };

  const isRadio = role === "menuitemradio";
  const isCheckbox = role === "menuitemcheckbox" || (checked !== undefined && !isRadio);

  return (
    <button
      ref={itemRef}
      id={itemId}
      type="button"
      role={role}
      aria-checked={checked}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onClick={handleClick}
      className={`ll:relative ll:z-10 ll:flex ll:items-center ll:gap-2.5 ll:w-full ll:h-8 ll:bg-transparent ll:border-0 ll:m-0 ll:py-0 ll:px-3 ll:text-left ll:box-border ll:cursor-pointer ll:select-none ll:outline-none ll:font-sans ${
        disabled
          ? "ll:opacity-45 ll:cursor-not-allowed ll:text-muted"
          : "ll:text-secondary ll:hover:text-primary ll:data-[subopen]:text-primary"
      } ${className}`}
    >
      {(isCheckbox || isRadio) && !icon ? (
        <span className="ll-ico ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ll:text-muted">
          {checked && <Icon icon={Check} size={14} />}
        </span>
      ) : icon ? (
        <span className="ll-ico ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ll:text-muted">
          {icon}
        </span>
      ) : null}

      <span className="ll:flex-1 ll:truncate ll:text-body">{children}</span>

      {icon && checked && <Icon icon={Check} size={14} className="ll:text-muted ll:shrink-0" />}

      {shortcut && (
        <kbd className="ll:font-mono ll:text-micro ll:text-muted ll:ml-auto ll:tracking-normal">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};

export interface SubMenuProps {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SubMenu: React.FC<SubMenuProps> = ({
  id,
  label,
  icon,
  disabled = false,
  children,
  className = "",
}) => {
  const rowRef = useRef<HTMLButtonElement>(null);
  const ctx = useContext(MenuContext);

  const labelText = typeof label === "string" ? label : "";

  // Register submenu metadata and children with parent Menu
  useEffect(() => {
    if (!ctx || !rowRef.current) return;
    const el = rowRef.current;
    ctx.registerSubMenu({
      id,
      label: labelText,
      rowEl: el,
      children,
    });
    return () => {
      ctx.unregisterSubMenu(id);
    };
  }, [ctx, id, labelText, children]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || prefersReducedMotion()) return;
    pressEl(e.currentTarget, true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || prefersReducedMotion()) return;
    pressEl(e.currentTarget, false);
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || !ctx) return;
    ctx.hoverRow(e.currentTarget, id);
  };

  const isSubOpen = ctx?.openSubmenuId === id;

  return (
    <button
      ref={rowRef}
      data-sub-id={id}
      data-subopen={isSubOpen ? "true" : undefined}
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={isSubOpen}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      className={`ll:relative ll:z-10 ll:flex ll:items-center ll:gap-2.5 ll:w-full ll:h-8 ll:bg-transparent ll:border-0 ll:m-0 ll:py-0 ll:px-3 ll:text-left ll:box-border ll:cursor-pointer ll:select-none ll:outline-none ll:font-sans ${
        disabled
          ? "ll:opacity-45 ll:cursor-not-allowed ll:text-muted"
          : "ll:text-secondary ll:hover:text-primary ll:data-[subopen]:text-primary"
      } ${className}`}
    >
      {icon && (
        <span className="ll-ico ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ll:text-muted">
          {icon}
        </span>
      )}
      <span className="ll:flex-1 ll:truncate ll:text-body">{label}</span>
      <Icon icon={ChevronRight} size={14} className="ll-chv ll:text-muted ll:ml-auto" />
    </button>
  );
};

export const MenuSeparator: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div
      role="separator"
      className={`ll:h-px ll:bg-border ll:my-1 ll:shrink-0 ${className}`}
    />
  );
};

export const MenuLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => {
  return (
    <div
      role="presentation"
      className={`ll:px-3 ll:py-1.5 ll:text-micro ll:font-mono ll:uppercase ll:tracking-wider ll:text-muted ll:select-none ll:font-sans ${className}`}
    >
      {children}
    </div>
  );
};

/** Section heading inside a menu (prototype .mh), used for the Light and Dark theme groups. */
export const MenuHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    role="presentation"
    className="ll:px-3 ll:pt-2 ll:pb-1 ll:text-micro ll:font-medium ll:text-muted ll:select-none ll:cursor-default"
  >
    {children}
  </div>
);

/** 28x18 theme preview chip, scoped to the theme it previews. Pass it as a menu item icon. */
export const ThemeSwatch: React.FC<{ theme: string }> = ({ theme }) => (
  <span
    data-theme={theme}
    aria-hidden="true"
    className="ll-tpv ll:relative ll:flex ll:w-7 ll:h-4.5 ll:shrink-0 ll:overflow-hidden ll:rounded-xs ll:border ll:border-border"
  >
    <span className="ll:relative ll:w-3/5 ll:h-full ll:bg-surface-canvas ll:grid ll:place-items-center">
      <span className="ll:w-2.5 ll:h-1 ll:rounded-xs ll:bg-control-primary" />
    </span>
    <span className="ll:flex-1 ll:h-full ll:bg-surface-panel" />
  </span>
);
