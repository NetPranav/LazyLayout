"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { Search, File } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { surf, type Surf } from "@/editor/motion/surface";
import { MENU_FALLBACKS, MOT } from "@/editor/motion/presets";
import { prefersReducedMotion } from "@/editor/motion/feel";
import { CANVAS_CHROME_SIZES } from "./constants";
import { INSERT_CATALOG, type InsertItem } from "./insertData";
import { insertCatalogItem, canInsertCatalogItem } from "./insertCommands";

export interface InsertBoxProps {
  open: boolean;
  onClose: () => void;
  onInsertItem?: (itemName: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const InsertBox: React.FC<InsertBoxProps> = ({
  open,
  onClose,
  onInsertItem,
  triggerRef,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("Sections");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRendered, setIsRendered] = useState<boolean>(open);
  const [prevOpen, setPrevOpen] = useState<boolean>(open);

  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<Surf | null>(null);
  const searchInputId = useId();

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIsRendered(true);
    }
  }

  // Initialize Surf instance on the container
  useEffect(() => {
    if (!isRendered || !boxRef.current) return;
    const s = surf(boxRef.current);
    surfRef.current = s;

    return () => {
      s.reset();
    };
  }, [isRendered]);

  // Open and close animations using Surf spring physics
  useEffect(() => {
    if (!isRendered) return;
    const s = surfRef.current;
    const boxEl = boxRef.current;
    if (!s || !boxEl) return;

    if (open) {
      const triggerEl = triggerRef?.current;
      let seed = { ...MENU_FALLBACKS.surfaceSeedDefault };
      if (triggerEl) {
        const r = triggerEl.getBoundingClientRect();
        seed = {
          w: Math.round(r.width),
          h: Math.round(r.height),
          r:
            parseFloat(getComputedStyle(triggerEl).borderRadius) ||
            MENU_FALLBACKS.popoverRadius,
        };
      }

      // Enforce P's fixed 520x400 size in all states
      s.size = { w: 520, h: 400 };
      s.open({
        from: seed,
        up: true,
      });
      searchRef.current?.focus({ preventScroll: true });
    } else {
      s.leave();
      const exitDuration = prefersReducedMotion()
        ? MENU_FALLBACKS.reducedMotionDuration
        : MOT.exitMs;
      const t = setTimeout(() => {
        setIsRendered(false);
      }, exitDuration);
      return () => clearTimeout(t);
    }
  }, [open, isRendered, triggerRef]);

  // Outside click & Escape handler
  useEffect(() => {
    if (!open || !isRendered) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        if (triggerRef?.current && triggerRef.current.contains(e.target as Node))
          return;
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isRendered, onClose, triggerRef]);

  const selectCategory = useCallback((category: string) => {
    setActiveCategory(category);
    setSearchQuery("");
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, []);

  const handleSelectCard = useCallback(
    (name: string) => {
      if (onInsertItem) onInsertItem(name);
      else insertCatalogItem(name);
      onClose();
      triggerRef?.current?.focus();
    },
    [onInsertItem, onClose, triggerRef]
  );

  // Search filtering logic across all categories
  const filteredItems = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const results: InsertItem[] = [];
    Object.keys(INSERT_CATALOG).forEach((cat) => {
      if (cat === "Recent") return;
      INSERT_CATALOG[cat].forEach((group) => {
        group.items.forEach((item) => {
          if (item.name.toLowerCase().includes(q)) {
            if (!results.some((r) => r.name === item.name)) {
              results.push(item);
            }
          }
        });
      });
    });
    return results;
  }, [searchQuery]);

  if (!isRendered) return null;

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Insert"
      tabIndex={-1}
      style={{
        width: "var(--ll-size-insert-w, 520px)",
        height: "var(--ll-size-insert-h, 400px)",
        bottom: "var(--ll-bottom-floating, 74px)",
      }}
      className="ll-ins ll:absolute ll:left-1/2 ll:-translate-x-1/2 ll:z-30 ll:flex ll:flex-col ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:overflow-hidden ll:outline-none"
    >
      <div className="ll-lay ll:flex ll:flex-col ll:flex-1 ll:min-h-0">
        {/* Search header (.ll-insq) */}
        <div className="ll-insq ll:flex ll:items-center ll:gap-2 ll:h-11 ll:px-4 ll:text-muted ll:border-b ll:border-border ll:shrink-0">
          <Icon icon={Search} size={CANVAS_CHROME_SIZES.iconMd} className="ll:text-muted" />
          <input
            id={searchInputId}
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (panelRef.current) panelRef.current.scrollTop = 0;
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                focusCard(boxRef.current, 0);
              } else if (e.key === "Enter") {
                const first = boxRef.current?.querySelector<HTMLButtonElement>("[data-card]");
                if (first) {
                  e.preventDefault();
                  first.click();
                }
              }
            }}
            placeholder="Search elements, blocks, assets"
            aria-label="Search elements, blocks, assets"
            autoComplete="off"
            className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:text-primary ll:placeholder:text-muted ll:font-sans"
          />
        </div>

        {/* Body (.ll-insb) */}
        <div className="ll-insb ll:flex ll:flex-1 ll:min-h-0">
          {/* Left category list (.ll-insl) */}
          <nav
            aria-label="Categories"
            style={{
              width: "calc(var(--ll-size-menu-w) - var(--ll-spacing-16))",
            }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              const btns = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>("button")
              );
              const i = btns.indexOf(document.activeElement as HTMLButtonElement);
              if (i < 0) return;
              e.preventDefault();
              btns[(i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length]?.focus();
            }}
            className="ll-insl ll:shrink-0 ll:flex ll:flex-col ll:gap-0.5 ll:p-2 ll:border-r ll:border-border ll:overflow-y-auto"
          >
            {Object.keys(INSERT_CATALOG).map((category) => {
              const isSelected = activeCategory === category;
              return (
                <React.Fragment key={category}>
                  {category === "Recent" && (
                    <div className="ll:h-px ll:bg-border ll:my-1.5" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    data-cat={category}
                    onClick={() => selectCategory(category)}
                    className="ll:flex ll:items-center ll:w-full ll:h-8 ll:px-2 ll:border-0 ll:rounded-sm ll:bg-transparent ll:text-left ll:whitespace-nowrap ll:cursor-pointer ll:text-secondary ll:hover:text-primary ll:aria-pressed:bg-surface-hover ll:aria-pressed:text-primary ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
                  >
                    {category}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Right card grid (.ll-insr) */}
          <div
            ref={panelRef}
            onKeyDown={(e) => {
              const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_COLS, ArrowUp: -GRID_COLS };
              const step = keys[e.key];
              if (step === undefined) return;
              const cards = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-card]"));
              const i = cards.indexOf(document.activeElement as HTMLButtonElement);
              if (i < 0) return;
              e.preventDefault();
              const next = i + step;
              if (next < 0) searchRef.current?.focus();
              else cards[Math.min(next, cards.length - 1)]?.focus();
            }}
            className="ll-insr ll:flex-1 ll:min-w-0 ll:overflow-y-auto ll:p-4"
          >
            {filteredItems !== null ? (
              filteredItems.length > 0 ? (
                <div className="ll-insgrid ll:grid ll:grid-cols-3 ll:gap-3">
                  {filteredItems.map((item) => (
                    <CardItem
                      key={item.name}
                      enabled={Boolean(onInsertItem) || canInsertCatalogItem(item.name)}
                      item={item}
                      onSelect={handleSelectCard}
                    />
                  ))}
                </div>
              ) : (
                <div className="ll-insnone ll:py-8 ll:text-center ll:text-muted">
                  Nothing found
                </div>
              )
            ) : (
              INSERT_CATALOG[activeCategory]?.map((group, gIdx) => (
                <div
                  key={group.groupName || gIdx}
                  className={gIdx > 0 ? "ll:mt-4" : ""}
                >
                  {group.groupName && (
                    <h4 className="ll-insg ll:m-0 ll:mb-2 ll:text-body ll:font-medium ll:text-primary">
                      {group.groupName}
                    </h4>
                  )}
                  <div className="ll-insgrid ll:grid ll:grid-cols-3 ll:gap-3">
                    {group.items.map((item) => (
                      <CardItem
                        key={item.name}
                        enabled={Boolean(onInsertItem) || canInsertCatalogItem(item.name)}
                        item={item}
                        onSelect={handleSelectCard}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface CardItemProps {
  item: InsertItem;
  enabled: boolean;
  onSelect: (name: string) => void;
}

const GRID_COLS = 3;

function focusCard(root: HTMLElement | null, index: number) {
  root?.querySelectorAll<HTMLButtonElement>("[data-card]")[index]?.focus();
}

const CardItem: React.FC<CardItemProps> = ({ item, enabled, onSelect }) => {
  return (
    <button
      type="button"
      data-card
      aria-disabled={enabled ? undefined : true}
      title={enabled ? undefined : "Not available yet: no engine command for this element"}
      onClick={() => {
        if (enabled) onSelect(item.name);
      }}
      className={`ll-card ll:group ll:flex ll:flex-col ll:items-stretch ll:gap-1.5 ll:min-w-0 ll:px-1.5 ll:border-0 ll:font-sans ll:bg-transparent ll:text-left ll:text-secondary ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ll:cursor-pointer`}
    >
      <span className="ll-thumb ll:relative ll:block ll:w-full ll:aspect-4/3 ll:bg-thumb-bg ll:border ll:border-border ll:group-hover:border-muted ll:rounded-sm ll:overflow-hidden ll:box-border">
        {item.kind === "a" ? (
          <span className="ll-big ll:absolute ll:inset-0 ll:grid ll:place-items-center ll:p-2 ll:text-muted">
            <Icon icon={File} size={CANVAS_CHROME_SIZES.iconXl} />
          </span>
        ) : item.kind === "f" ? (
          <span
            className="ll-big ll:absolute ll:inset-0 ll:grid ll:place-items-center ll:p-2 ll:text-center ll:text-primary"
            style={{ fontFamily: item.name }}
          >
            {item.name}
          </span>
        ) : item.wireframe ? (
          item.wireframe.split(" ").map((rect, idx) => {
            const [x, y, w, h] = rect.split(",").map(Number);
            return (
              <i
                key={idx}
                className="ll:absolute ll:bg-thumb-line ll:rounded-xs"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${w}%`,
                  height: `${h}%`,
                }}
              />
            );
          })
        ) : null}
      </span>
      <span className="ll-cname ll:text-secondary ll:group-hover:text-primary ll:truncate ll:w-full ll:font-sans">
        {item.name}
      </span>
    </button>
  );
};