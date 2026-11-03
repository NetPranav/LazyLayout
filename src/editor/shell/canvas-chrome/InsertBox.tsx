"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { Search, FileText } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { surf, type Surf } from "@/editor/motion/surface";
import { MENU_FALLBACKS, MOT } from "@/editor/motion/presets";
import { prefersReducedMotion } from "@/editor/motion/feel";
import { CANVAS_CHROME_SIZES } from "./constants";
import { INSERT_CATALOG, type InsertItem } from "./insertData";

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

      s.open({
        from: seed,
        up: true,
      });
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

  const handleSelectCard = useCallback(
    (name: string) => {
      onInsertItem?.(name);
      onClose();
    },
    [onInsertItem, onClose]
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
        width: "calc(var(--ll-size-menu-wide-w) + var(--ll-size-menu-w))",
        height: "calc(var(--ll-size-menu-w) * 2)",
        bottom:
          "calc(var(--ll-size-topbar-h) + var(--ll-spacing-4) + var(--ll-spacing-2) - var(--ll-spacing-0-5))",
      }}
      className="ll-ins ll:absolute ll:left-1/2 ll:-translate-x-1/2 ll:z-30 ll:flex ll:flex-col ll:bg-surface-raised ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:overflow-hidden ll:outline-none"
    >
      <div className="ll-lay ll:flex ll:flex-col ll:flex-1 ll:min-h-0">
        {/* Search header (.ll-insq) */}
        <div className="ll-insq ll:flex ll:items-center ll:gap-2 ll:h-11 ll:px-4 ll:text-muted ll:border-b ll:border-border ll:shrink-0">
          <Icon icon={Search} size={CANVAS_CHROME_SIZES.iconMd} className="ll:text-muted" />
          <input
            id={searchInputId}
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search elements, blocks, assets"
            aria-label="Search elements, blocks, assets"
            autoComplete="off"
            className="ll:flex-1 ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:text-body ll:text-primary ll:placeholder:text-muted ll:font-sans"
          />
        </div>

        {/* Body (.ll-insb) */}
        <div className="ll-insb ll:flex ll:flex-1 ll:min-h-0">
          {/* Left category list (.ll-insl) - Accessible Tablist */}
          <div
            role="tablist"
            aria-label="Categories"
            aria-orientation="vertical"
            style={{
              width: "calc(var(--ll-size-menu-w) - var(--ll-spacing-16))",
            }}
            className="ll-insl ll:shrink-0 ll:flex ll:flex-col ll:gap-0.5 ll:p-2 ll:border-r ll:border-border ll:overflow-y-auto"
          >
            {Object.keys(INSERT_CATALOG).map((category) => {
              const isSelected = activeCategory === category && !searchQuery;
              if (category === "Recent") {
                return (
                  <React.Fragment key="recent-section">
                    <div
                      className="ll:h-px ll:bg-border ll:my-1.5"
                      aria-hidden="true"
                    />
                    <Button
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      role="tab"
                      aria-selected={isSelected}
                      data-cat={category}
                      onClick={() => {
                        setActiveCategory(category);
                        setSearchQuery("");
                      }}
                      className="ll:w-full ll:justify-start ll:h-8 ll:px-2 ll:text-small"
                    >
                      {category}
                    </Button>
                  </React.Fragment>
                );
              }
              return (
                <Button
                  key={category}
                  variant={isSelected ? "secondary" : "ghost"}
                  size="sm"
                  role="tab"
                  aria-selected={isSelected}
                  data-cat={category}
                  onClick={() => {
                    setActiveCategory(category);
                    setSearchQuery("");
                  }}
                  className="ll:w-full ll:justify-start ll:h-8 ll:px-2 ll:text-small"
                >
                  {category}
                </Button>
              );
            })}
          </div>

          {/* Right card grid (.ll-insr) */}
          <div
            role="tabpanel"
            aria-label={`${activeCategory} items`}
            className="ll-insr ll:flex-1 ll:min-w-0 ll:overflow-y-auto ll:p-4"
          >
            {filteredItems !== null ? (
              filteredItems.length > 0 ? (
                <div className="ll-insgrid ll:grid ll:grid-cols-3 ll:gap-3">
                  {filteredItems.map((item) => (
                    <CardItem
                      key={item.name}
                      item={item}
                      onSelect={handleSelectCard}
                    />
                  ))}
                </div>
              ) : (
                <div className="ll-insnone ll:py-8 ll:text-center ll:text-muted ll:text-small">
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
                    <h4 className="ll-insg ll:text-small ll:font-medium ll:text-primary ll:mb-2">
                      {group.groupName}
                    </h4>
                  )}
                  <div className="ll-insgrid ll:grid ll:grid-cols-3 ll:gap-3">
                    {group.items.map((item) => (
                      <CardItem
                        key={item.name}
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
  onSelect: (name: string) => void;
}

const CardItem: React.FC<CardItemProps> = ({ item, onSelect }) => {
  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(item.name)}
      className="ll-card ll:h-auto ll:p-1 ll:flex ll:flex-col ll:items-start ll:gap-1.5 ll:min-w-0 ll:text-left ll:cursor-pointer ll:group ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset"
    >
      <span
        style={{ aspectRatio: "4 / 3" }}
        className="ll-thumb ll:relative ll:block ll:w-full ll:bg-thumb-bg ll:border ll:border-border ll:group-hover:border-muted ll:rounded-sm ll:overflow-hidden ll:box-border"
      >
        {item.kind === "a" ? (
          <span className="ll-big ll:absolute ll:inset-0 ll:grid ll:place-items-center ll:p-2 ll:text-muted">
            <Icon icon={FileText} size={CANVAS_CHROME_SIZES.iconXl} />
          </span>
        ) : item.kind === "f" ? (
          <span
            className="ll-big ll:absolute ll:inset-0 ll:grid ll:place-items-center ll:p-2 ll:text-center ll:text-body ll:font-medium ll:text-primary"
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
      <span className="ll-cname ll:text-nano ll:text-secondary ll:group-hover:text-primary ll:truncate ll:w-full ll:font-sans">
        {item.name}
      </span>
    </Button>
  );
};