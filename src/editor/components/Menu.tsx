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
import { createPortal } from "react-dom";
import { ChevronRight, Check } from "lucide-react";
import { Spring } from "../motion/spring";
import { simAdd, simRemove, defaultHost, type Sim } from "../motion/loop";
import { getActivePreset, prefersReducedMotion } from "../motion/feel";
import { surf, pressEl, type Surf } from "../motion/surface";
import { useMounted } from "./useMounted";
import { Icon } from "./Icon";

// Safe mouse position tracking for safe triangle submenu hover protection
const lastMousePos = { x: 0, y: 0, prevX: 0, prevY: 0, t: 0 };
if (typeof window !== "undefined") {
  window.addEventListener(
    "mousemove",
    (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMousePos.t > 45) {
        lastMousePos.prevX = lastMousePos.x;
        lastMousePos.prevY = lastMousePos.y;
        lastMousePos.t = now;
      }
      lastMousePos.x = e.clientX;
      lastMousePos.y = e.clientY;
    },
    { passive: true }
  );
}

function isPointerHeadingToward(subRect: DOMRect, flip: boolean): boolean {
  const top = subRect.top;
  const bot = subRect.bottom;
  const ex = flip ? subRect.right : subRect.left;
  const cx = lastMousePos.x;
  const cy = lastMousePos.y;
  const px = lastMousePos.prevX;
  const py = lastMousePos.prevY;

  function sign(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  }

  const d1 = sign(cx, cy, px, py, ex, top);
  const d2 = sign(cx, cy, ex, top, ex, bot);
  const d3 = sign(cx, cy, ex, bot, px, py);

  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

export interface MenuItemData {
  id: string;
  el: HTMLElement;
  label: string;
  isSubMenu?: boolean;
}

interface MenuContextValue {
  closeMenu: () => void;
  registerItem: (item: MenuItemData) => void;
  unregisterItem: (id: string) => void;
  moveHighlight: (rowEl: HTMLElement, instant?: boolean) => void;
  hideHighlight: () => void;
  setOpenSubmenuId: (id: string | null) => void;
  openSubmenuId: string | null;
  getMenuEl: () => HTMLElement | null;
  onSubmenuOpenChange?: (open: boolean) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

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
  const mounted = useMounted();
  const menuRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const prevActiveElementRef = useRef<HTMLElement | null>(null);

  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [isRendered, setIsRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }
  const itemsRef = useRef<MenuItemData[]>([]);
  const activeIdxRef = useRef<number>(-1);

  // Sliding highlight springs
  const hlSpringsRef = useRef<{ y: Spring; h: Spring; sim: Sim } | null>(null);

  // Initialize Surf and Highlight springs whenever rendered
  useEffect(() => {
    if (!isRendered || !menuRef.current) return;
    const menuEl = menuRef.current;

    // Attach Surf instance
    const s = surf(menuEl);
    surfRef.current = s;

    // Highlight springs
    const p = getActivePreset();
    const defaultRowH =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ll-size-row-h"
        )
      ) || 32;
    const y = new Spring(0, p.glideH);
    const h = new Spring(defaultRowH, p.glideW);
    const sim: Sim = {
      sp: [y, h],
      apply: () => {
        if (hlRef.current) {
          hlRef.current.style.height = `${Math.max(0, h.x).toFixed(2)}px`;
          hlRef.current.style.transform = `translate3d(0, ${y.x.toFixed(2)}px, 0)`;
        }
      },
    };
    hlSpringsRef.current = { y, h, sim };

    return () => {
      s.reset();
      if (hlSpringsRef.current) {
        simRemove(hlSpringsRef.current.sim);
      }
    };
  }, [isRendered]);

  const moveHighlight = useCallback((rowEl: HTMLElement, instant = false) => {
    const hl = hlRef.current;
    const hs = hlSpringsRef.current;
    if (!hl || !hs || !rowEl) return;

    const idx = itemsRef.current.findIndex((it) => it.el === rowEl);
    if (idx >= 0) {
      activeIdxRef.current = idx;
    }

    hl.style.left = `${rowEl.offsetLeft}px`;
    hl.style.width = `${rowEl.offsetWidth}px`;

    const p = getActivePreset();

    if (instant || prefersReducedMotion()) {
      hs.y.jump(rowEl.offsetTop);
      hs.h.jump(rowEl.offsetHeight);
      hl.style.height = `${rowEl.offsetHeight}px`;
      hl.style.transform = `translate3d(0, ${rowEl.offsetTop}px, 0)`;
      hl.classList.add("show");
      return;
    }

    hs.y.tune(p.glideH);
    hs.h.tune(p.glideW);
    hs.y.to = rowEl.offsetTop;
    hs.h.to = rowEl.offsetHeight;

    hl.classList.add("show");
    simAdd(hs.sim);
  }, []);

  const hideHighlight = useCallback(() => {
    const hl = hlRef.current;
    if (hl) {
      hl.classList.remove("show");
    }
    activeIdxRef.current = -1;
  }, []);

  // Open & Close with Surf physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const menuEl = menuRef.current;
    if (!s || !menuEl) return;

    const targetAnchor = anchorRef?.current ?? anchorEl;

    if (open) {
      prevActiveElementRef.current = document.activeElement as HTMLElement | null;

      // Position the menu
      let left = 8;
      let top = 8;
      let seed = { w: 32, h: 32, r: 6 };

      const m = s.measure();
      const menuW = m.w || (variant === "wide" ? 320 : variant === "context" ? 248 : 200);
      const menuH = m.h || 240;

      const pad =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-spacing-2"
          )
        ) || 8;

      if (position) {
        left = Math.max(pad, Math.min(position.x, window.innerWidth - menuW - pad));
        top = Math.max(pad, Math.min(position.y, window.innerHeight - menuH - pad));
        seed = { w: 16, h: 16, r: 6 };
      } else if (targetAnchor) {
        const r = targetAnchor.getBoundingClientRect();
        left = Math.max(pad, Math.min(r.left, window.innerWidth - menuW - pad));
        top = r.bottom + 4;
        if (top + menuH > window.innerHeight - pad) {
          top = Math.max(pad, r.top - menuH - 4);
        }
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r: parseFloat(getComputedStyle(targetAnchor).borderRadius) || 6,
        };
      }

      menuEl.style.left = `${Math.max(pad, left)}px`;
      menuEl.style.top = `${Math.max(pad, top)}px`;

      s.open({
        from: seed,
      });

      // Move focus into the menu container on next frame
      const unreg = defaultHost.register(() => {
        unreg();
        menuEl.focus();
      });
    } else {
      hideHighlight();
      s.leave();
      const exitDuration = prefersReducedMotion() ? 120 : 160;
      const t = setTimeout(() => {
        setIsRendered(false);
        if (prevActiveElementRef.current && document.contains(prevActiveElementRef.current)) {
          prevActiveElementRef.current.focus();
        }
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, anchorEl, anchorRef, position, variant, hideHighlight]);

  // Outside click & global keydown handling
  useEffect(() => {
    if (!open || !isRendered) return;

    const targetAnchor = anchorRef?.current ?? anchorEl;

    const handlePointerDownOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Also check if click is inside any active portaled submenu
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-submenu="true"]')) return;
        if (targetAnchor && targetAnchor.contains(e.target as Node)) return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const menuEl = menuRef.current;
      if (!menuEl) return;

      // When a submenu is open, let the submenu handle its own internal arrow/item keys
      if (openSubmenuId) {
        if (e.key === "ArrowLeft" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          const closedSubId = openSubmenuId;
          setOpenSubmenuId(null);
          // Return focus/highlight to the active submenu trigger item
          const triggerIdx = itemsRef.current.findIndex((it) => it.id === closedSubId);
          if (triggerIdx >= 0) {
            activeIdxRef.current = triggerIdx;
            const curItem = itemsRef.current[triggerIdx];
            moveHighlight(curItem.el);
            curItem.el.focus();
          }
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        targetAnchor?.focus();
        return;
      }

      const items = itemsRef.current;
      if (!items.length) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        menuEl.classList.add("kb");

        let next =
          e.key === "ArrowDown"
            ? activeIdxRef.current + 1
            : activeIdxRef.current <= 0
            ? items.length - 1
            : activeIdxRef.current - 1;

        if (next >= items.length) next = 0;
        activeIdxRef.current = next;
        const item = items[next];
        if (item) {
          moveHighlight(item.el);
          item.el.focus();
        }
        return;
      }

      if (e.key === "ArrowRight") {
        let cur = items[activeIdxRef.current];
        if (!cur) {
          const focusedIdx = items.findIndex((it) => it.el === document.activeElement);
          if (focusedIdx >= 0) {
            activeIdxRef.current = focusedIdx;
            cur = items[focusedIdx];
          }
        }
        if (cur && cur.isSubMenu) {
          e.preventDefault();
          setOpenSubmenuId(cur.id);
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        const cur = items[activeIdxRef.current];
        if (cur) {
          e.preventDefault();
          if (cur.isSubMenu) {
            setOpenSubmenuId(cur.id);
          } else {
            cur.el.click();
          }
        }
        return;
      }

      // Type-ahead: jump to next item starting with pressed letter
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const char = e.key.toLowerCase();
        const start = (activeIdxRef.current + 1) % items.length;
        const searchOrder = [
          ...items.slice(start),
          ...items.slice(0, start),
        ];
        const match = searchOrder.find((it) =>
          it.label.trim().toLowerCase().startsWith(char)
        );
        if (match) {
          e.preventDefault();
          menuEl.classList.add("kb");
          const idx = items.findIndex((it) => it.id === match.id);
          activeIdxRef.current = idx;
          moveHighlight(match.el);
          match.el.focus();
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isRendered, onClose, anchorEl, anchorRef, openSubmenuId, moveHighlight]);

  const registerItem = useCallback((item: MenuItemData) => {
    const list = itemsRef.current;
    const existing = list.findIndex((x) => x.id === item.id);
    if (existing >= 0) {
      list[existing] = item;
    } else {
      list.push(item);
    }
  }, []);

  const unregisterItem = useCallback((id: string) => {
    itemsRef.current = itemsRef.current.filter((x) => x.id !== id);
  }, []);

  // Imperative push state on parent menu to avoid React wiping classes
  const handleSubmenuOpenChange = useCallback((isOpen: boolean) => {
    const el = menuRef.current;
    if (!el) return;
    if (isOpen) {
      el.classList.add("pushed");
      el.setAttribute("data-pushed", "true");
    } else {
      el.classList.remove("pushed");
      el.removeAttribute("data-pushed");
    }
  }, []);

  const getMenuEl = useCallback(() => menuRef.current, []);

  const contextValue: MenuContextValue = useMemo(
    () => ({
      closeMenu: onClose,
      registerItem,
      unregisterItem,
      moveHighlight,
      hideHighlight,
      setOpenSubmenuId,
      openSubmenuId,
      getMenuEl,
      onSubmenuOpenChange: handleSubmenuOpenChange,
    }),
    [
      onClose,
      registerItem,
      unregisterItem,
      moveHighlight,
      hideHighlight,
      setOpenSubmenuId,
      openSubmenuId,
      getMenuEl,
      handleSubmenuOpenChange,
    ]
  );

  if (!mounted || !isRendered) return null;

  const widthStyle =
    width !== undefined
      ? typeof width === "number"
        ? `${width}px`
        : width
      : variant === "wide"
      ? "var(--ll-size-menu-wide-w)"
      : variant === "context"
      ? "var(--ll-size-menu-ctx-w)"
      : "var(--ll-size-menu-w)";

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      style={{ width: widthStyle }}
      className={`menu ll:fixed ll:z-50 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft ll:py-1 ll:outline-none ll:font-sans ${
        variant === "context" ? "ctx ll:rounded-lg" : ""
      } ${className}`}
      onMouseLeave={hideHighlight}
    >
      <div
        ref={layRef}
        className="ll-lay ll:flex ll:flex-col ll:gap-0 ll:max-h-menu ll:overflow-y-auto ll:overscroll-contain"
      >
        {/* Single sliding spring highlight across menu items */}
        <i
          ref={hlRef as React.RefObject<HTMLElement>}
          aria-hidden="true"
          className="ll-hl"
        />

        <MenuContext.Provider value={contextValue}>{children}</MenuContext.Provider>
      </div>
    </div>,
    document.body
  );
};

export interface MenuItemProps {
  id?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  role?: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  id: propId,
  icon,
  children,
  shortcut,
  checked,
  disabled = false,
  role = "menuitem",
  onClick,
  className = "",
}) => {
  const generatedId = useId();
  const id = propId ?? generatedId;
  const ctx = useContext(MenuContext);
  const rowRef = useRef<HTMLButtonElement>(null);

  const labelText = typeof children === "string" ? children : "";

  useEffect(() => {
    if (ctx && rowRef.current && !disabled) {
      ctx.registerItem({
        id,
        el: rowRef.current,
        label: labelText,
        isSubMenu: false,
      });
    }
    return () => {
      ctx?.unregisterItem(id);
    };
  }, [ctx, id, disabled, labelText]);

  const handlePointerEnter = () => {
    if (disabled || !ctx || !rowRef.current) return;
    ctx.moveHighlight(rowRef.current);
  };

  const handlePointerDown = () => {
    if (disabled || !rowRef.current) return;
    pressEl(rowRef.current, true);
  };

  const handlePointerUp = () => {
    if (disabled || !rowRef.current) return;
    pressEl(rowRef.current, false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    onClick?.(e);
    ctx?.closeMenu();
  };

  return (
    <button
      ref={rowRef}
      role={role}
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-checked={checked}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`ll:relative ll:z-10 ll:flex ll:items-center ll:gap-2.5 ll:w-full ll:h-8 ll:bg-transparent ll:border-0 ll:m-0 ll:py-0 ll:px-3 ll:text-left ll:box-border ll:cursor-pointer ll:select-none ll:transition-none ll:outline-none ll:font-sans ${
        disabled
          ? "ll:opacity-40 ll:cursor-not-allowed ll:text-muted"
          : "ll:text-primary"
      } ${className}`}
    >
      {checked !== undefined && (
        <span className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0">
          {checked && <Icon icon={Check} size={14} className="ll:text-primary" />}
        </span>
      )}

      {icon && (
        <span className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ll:text-secondary">
          {icon}
        </span>
      )}

      <span className="ll:flex-1 ll:truncate ll:text-body ll:font-normal">{children}</span>

      {shortcut && (
        <kbd className="ll:ml-auto ll:font-mono ll:text-micro ll:text-muted">
          {shortcut}
        </kbd>
      )}
    </button>
  );
};

export interface SubMenuProps {
  id?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

export const SubMenu: React.FC<SubMenuProps> = ({
  id: propId,
  label,
  icon,
  children,
  disabled = false,
}) => {
  const generatedId = useId();
  const id = propId ?? generatedId;
  const ctx = useContext(MenuContext);
  const isOpen = ctx?.openSubmenuId === id;
  const labelText = typeof label === "string" ? label : "";

  const rowRef = useRef<HTMLButtonElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const layRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLElement>(null);
  const surfRef = useRef<Surf | null>(null);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIsRendered(true);
    }
  }
  const subItemsRef = useRef<MenuItemData[]>([]);
  const subActiveIdxRef = useRef<number>(-1);
  const hlSpringsRef = useRef<{ y: Spring; h: Spring; sim: Sim } | null>(null);

  // Register submenu trigger item with parent
  useEffect(() => {
    if (ctx && rowRef.current && !disabled) {
      ctx.registerItem({
        id,
        el: rowRef.current,
        label: labelText,
        isSubMenu: true,
      });
    }
    return () => {
      ctx?.unregisterItem(id);
    };
  }, [ctx, id, disabled, labelText]);

  // Initialize Submenu Surf & Highlight
  useEffect(() => {
    if (!isRendered || !subMenuRef.current) return;
    const subEl = subMenuRef.current;

    const s = surf(subEl);
    surfRef.current = s;

    const p = getActivePreset();
    const defaultRowH =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ll-size-row-h"
        )
      ) || 32;
    const y = new Spring(0, p.glideH);
    const h = new Spring(defaultRowH, p.glideW);
    const sim: Sim = {
      sp: [y, h],
      apply: () => {
        if (hlRef.current) {
          hlRef.current.style.height = `${Math.max(0, h.x).toFixed(2)}px`;
          hlRef.current.style.transform = `translate3d(0, ${y.x.toFixed(2)}px, 0)`;
        }
      },
    };
    hlSpringsRef.current = { y, h, sim };

    return () => {
      s.reset();
      if (hlSpringsRef.current) {
        simRemove(hlSpringsRef.current.sim);
      }
    };
  }, [isRendered]);

  const moveHighlight = useCallback((rowEl: HTMLElement, instant = false) => {
    const hl = hlRef.current;
    const hs = hlSpringsRef.current;
    if (!hl || !hs || !rowEl) return;

    const idx = subItemsRef.current.findIndex((it) => it.el === rowEl);
    if (idx >= 0) {
      subActiveIdxRef.current = idx;
    }

    hl.style.left = `${rowEl.offsetLeft}px`;
    hl.style.width = `${rowEl.offsetWidth}px`;

    const p = getActivePreset();

    if (instant || prefersReducedMotion()) {
      hs.y.jump(rowEl.offsetTop);
      hs.h.jump(rowEl.offsetHeight);
      hl.style.height = `${rowEl.offsetHeight}px`;
      hl.style.transform = `translate3d(0, ${rowEl.offsetTop}px, 0)`;
      hl.classList.add("show");
      return;
    }

    hs.y.tune(p.glideH);
    hs.h.tune(p.glideW);
    hs.y.to = rowEl.offsetTop;
    hs.h.to = rowEl.offsetHeight;

    hl.classList.add("show");
    simAdd(hs.sim);
  }, []);

  const hideHighlight = useCallback(() => {
    const hl = hlRef.current;
    if (hl) {
      hl.classList.remove("show");
    }
    subActiveIdxRef.current = -1;
  }, []);

  // Open & Close Submenu Surf Surface
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const subEl = subMenuRef.current;
    const triggerRow = rowRef.current;
    if (!s || !subEl || !triggerRow) return;

    if (isOpen) {
      const pad =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ll-spacing-2"
          )
        ) || 8;
      const r = triggerRow.getBoundingClientRect();
      const m = s.measure();
      const w = m.w || 224;
      const h = m.h || 180;

      let x = r.right + 4;
      const flip = x + w > window.innerWidth - pad;
      if (flip) {
        x = r.left - 4 - w;
        subEl.classList.add("flip");
      } else {
        subEl.classList.remove("flip");
      }

      const top = Math.max(pad, Math.min(r.top - 4, window.innerHeight - h - pad));
      subEl.style.left = `${Math.max(pad, Math.min(x, window.innerWidth - w - pad))}px`;
      subEl.style.top = `${top}px`;
      subEl.style.transformOrigin = `${flip ? "right " : "left "}${Math.max(0, r.top - top)}px`;

      ctx?.onSubmenuOpenChange?.(true);

      const seed = {
        w: Math.round(r.height),
        h: Math.round(r.height),
        r: parseFloat(getComputedStyle(subEl).borderTopLeftRadius) || 6,
      };

      s.open({
        right: flip,
        slide: flip ? -1 : 1,
        from: seed,
      });

      setTimeout(() => {
        if (subEl) {
          const first = subEl.querySelector<HTMLElement>('button[role="menuitem"]:not(:disabled)');
          if (first) {
            moveHighlight(first);
            first.focus();
          }
        }
      }, 50);
    } else {
      ctx?.onSubmenuOpenChange?.(false);
      hideHighlight();
      s.leave();
      const exitDuration = prefersReducedMotion() ? 120 : 160;
      const t = setTimeout(() => {
        setIsRendered(false);
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [isOpen, isRendered, ctx, hideHighlight, moveHighlight]);

  // Keyboard navigation inside open submenu
  useEffect(() => {
    if (!isOpen || !isRendered) return;

    const handleSubKeyDown = (e: KeyboardEvent) => {
      const subItems = subItemsRef.current;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (!subItems.length) return;

        let next =
          e.key === "ArrowDown"
            ? subActiveIdxRef.current + 1
            : subActiveIdxRef.current <= 0
            ? subItems.length - 1
            : subActiveIdxRef.current - 1;

        if (next >= subItems.length) next = 0;
        subActiveIdxRef.current = next;
        const item = subItems[next];
        if (item) {
          moveHighlight(item.el);
          item.el.focus();
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        const subItems = subItemsRef.current;
        const item = subItems[subActiveIdxRef.current];
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          item.el.click();
        }
        return;
      }

      // Type-ahead inside submenu
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const subItems = subItemsRef.current;
        const char = e.key.toLowerCase();
        const start = (subActiveIdxRef.current + 1) % subItems.length;
        const searchOrder = [
          ...subItems.slice(start),
          ...subItems.slice(0, start),
        ];
        const match = searchOrder.find((it) =>
          it.label.trim().toLowerCase().startsWith(char)
        );
        if (match) {
          e.preventDefault();
          e.stopPropagation();
          const idx = subItems.findIndex((it) => it.id === match.id);
          subActiveIdxRef.current = idx;
          moveHighlight(match.el);
          match.el.focus();
        }
      }
    };

    document.addEventListener("keydown", handleSubKeyDown);
    return () => document.removeEventListener("keydown", handleSubKeyDown);
  }, [isOpen, isRendered, moveHighlight]);

  const handlePointerEnterTrigger = () => {
    if (disabled || !ctx || !rowRef.current) return;
    ctx.moveHighlight(rowRef.current);

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    openTimerRef.current = setTimeout(() => {
      ctx.setOpenSubmenuId(id);
    }, 100); // 100ms open delay per prototype
  };

  const handlePointerLeaveTrigger = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (isOpen && subMenuRef.current) {
      const subRect = subMenuRef.current.getBoundingClientRect();
      const isHeadingToward = isPointerHeadingToward(subRect, false);
      if (isHeadingToward) {
        // Safe triangle active: give user time to enter submenu
        closeTimerRef.current = setTimeout(() => {
          ctx?.setOpenSubmenuId(null);
        }, 200); // 200ms close delay
        return;
      }
    }

    closeTimerRef.current = setTimeout(() => {
      ctx?.setOpenSubmenuId(null);
    }, 100);
  };

  const handleSubMenuMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const registerSubItem = useCallback((item: MenuItemData) => {
    const list = subItemsRef.current;
    const existing = list.findIndex((x) => x.id === item.id);
    if (existing >= 0) {
      list[existing] = item;
    } else {
      list.push(item);
    }
  }, []);

  const unregisterSubItem = useCallback((itemId: string) => {
    subItemsRef.current = subItemsRef.current.filter((x) => x.id !== itemId);
  }, []);

  const getSubMenuEl = useCallback(() => subMenuRef.current, []);

  const subContextValue: MenuContextValue = useMemo(
    () => ({
      closeMenu: () => {
        ctx?.setOpenSubmenuId(null);
        ctx?.closeMenu();
      },
      registerItem: registerSubItem,
      unregisterItem: unregisterSubItem,
      moveHighlight,
      hideHighlight,
      setOpenSubmenuId: () => {},
      openSubmenuId: null,
      getMenuEl: getSubMenuEl,
    }),
    [
      ctx,
      registerSubItem,
      unregisterSubItem,
      moveHighlight,
      hideHighlight,
      getSubMenuEl,
    ]
  );

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        onPointerEnter={handlePointerEnterTrigger}
        onPointerLeave={handlePointerLeaveTrigger}
        className={`ll:relative ll:z-10 ll:flex ll:items-center ll:gap-2.5 ll:w-full ll:h-8 ll:bg-transparent ll:border-0 ll:m-0 ll:py-0 ll:px-3 ll:text-left ll:box-border ll:cursor-pointer ll:select-none ll:outline-none ll:font-sans ${
          disabled
            ? "ll:opacity-40 ll:cursor-not-allowed ll:text-muted"
            : "ll:text-primary"
        } ${isOpen ? "subopen" : ""}`}
      >
        {icon && (
          <span className="ll:w-4 ll:h-4 ll:grid ll:place-items-center ll:shrink-0 ll:text-secondary">
            {icon}
          </span>
        )}
        <span className="ll:flex-1 ll:truncate ll:text-body">{label}</span>
        <Icon icon={ChevronRight} size={14} className="chv ll:text-muted ll:ml-auto" />
      </button>

      {isRendered &&
        createPortal(
          <div
            ref={subMenuRef}
            role="menu"
            tabIndex={-1}
            data-submenu="true"
            aria-label={labelText || "Submenu"}
            onMouseEnter={handleSubMenuMouseEnter}
            onMouseLeave={hideHighlight}
            className="menu ctx ll:fixed ll:z-50 ll:w-56 ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:py-1 ll:outline-none ll:font-sans"
          >
            <div
              ref={layRef}
              className="ll-lay ll:flex ll:flex-col ll:gap-0 ll:max-h-menu ll:overflow-y-auto ll:overscroll-contain"
            >
              <i
                ref={hlRef as React.RefObject<HTMLElement>}
                aria-hidden="true"
                className="ll-hl"
              />
              <MenuContext.Provider value={subContextValue}>
                {children}
              </MenuContext.Provider>
            </div>
          </div>,
          document.body
        )}
    </>
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
