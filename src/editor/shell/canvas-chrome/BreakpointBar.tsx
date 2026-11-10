"use client";

import React, { useState } from "react";
import { Monitor, Tablet, Smartphone, Plus, X, Layers, Check } from "lucide-react";
import { invokeCommand } from "@/core/commands";
import { breakpointsOf, isBase } from "@/core/breakpoints/breakpoints";
import { targetFrameId } from "@/core/breakpoints/breakpointOps";
import { useBreakpointStore } from "@/core/store/useBreakpointStore";
import { useBreakpointViewStore } from "@/core/store/useBreakpointViewStore";
import { useDocument } from "@/core/store/useDocumentStore";
import { Icon } from "@/editor/components/Icon";

export interface BreakpointBarProps {
  className?: string;
}

export const BreakpointBar: React.FC<BreakpointBarProps> = ({ className = "" }) => {
  const activeId = useBreakpointStore((s) => s.activeId);
  const doc = useDocument((d) => d);
  const list = breakpointsOf(doc);
  const base = isBase(list, activeId);
  const showAll = useBreakpointViewStore((s) => s.showAll);
  const [adding, setAdding] = useState(false);
  const [width, setWidth] = useState("1024");

  const frameId = targetFrameId();
  const targetLayer = frameId ? doc.layers[frameId] : undefined;
  const responsive = targetLayer ? targetLayer.properties["breakpoints.responsive"] === true : false;

  const getIcon = (w: number) => {
    if (w >= 1024) return Monitor;
    if (w >= 600) return Tablet;
    return Smartphone;
  };

  return (
    <div
      role="toolbar"
      aria-label="Responsive Breakpoints"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`ll:absolute ll:top-3 ll:left-1/2 -ll:translate-x-1/2 ll:z-30 ll:flex ll:items-center ll:gap-1.5 ll:px-2.5 ll:py-1 ll:rounded-full ll:bg-surface-panel/95 ll:backdrop-blur-md ll:border ll:border-line-subtle ll:shadow-elevation-1 ll:text-small ll:text-secondary ${className}`}
    >
      {/* Breakpoint buttons */}
      {list.map((b, i) => {
        const isActive = (base && i === 0) || b.id === activeId;
        const DeviceIcon = getIcon(b.width);
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={isActive}
            aria-label={`${b.name} ${b.width}px`}
            title={`${b.name}: ${b.width} px${i === 0 ? " (base)" : ""}`}
            className={`ll:flex ll:items-center ll:gap-1.5 ll:px-2.5 ll:py-1 ll:rounded-full ll:text-micro ll:font-medium ll:transition-colors ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ${
              isActive
                ? "ll:bg-control-active ll:text-primary ll:font-semibold ll:shadow-sm"
                : "ll:text-muted ll:hover:text-primary ll:hover:bg-control-hover"
            }`}
            onClick={() => void invokeCommand("breakpoint.set", { id: i === 0 ? null : b.id })}
          >
            <Icon icon={DeviceIcon} size={13} className={isActive ? "ll:text-primary" : "ll:text-muted"} />
            <span>{b.name}</span>
            <span className="ll:font-mono ll:text-muted/80">{b.width}</span>
          </button>
        );
      })}

      {/* Add custom breakpoint */}
      {adding ? (
        <span className="ll:flex ll:items-center ll:gap-1 ll:pl-1">
          <input
            aria-label="New breakpoint width"
            type="number"
            min={100}
            max={10000}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void invokeCommand("breakpoint.add", { name: `${width}px`, width: Number(width) });
                setAdding(false);
              } else if (e.key === "Escape") setAdding(false);
            }}
            className="ll:w-16 ll:h-6 ll:px-1.5 ll:rounded ll:bg-surface ll:border ll:border-line-subtle ll:text-micro ll:font-mono ll:text-primary ll:outline-none ll:focus:border-primary"
            autoFocus
          />
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setAdding(false)}
            className="ll:p-1 ll:rounded ll:text-muted ll:hover:text-primary"
          >
            <Icon icon={X} size={12} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label="Add breakpoint"
          title="Add a breakpoint"
          onClick={() => setAdding(true)}
          className="ll:p-1 ll:rounded-full ll:text-muted ll:hover:text-primary ll:hover:bg-control-hover ll:cursor-pointer ll:transition-colors"
        >
          <Icon icon={Plus} size={13} />
        </button>
      )}

      {/* Divider */}
      <span className="ll:w-px ll:h-4 ll:bg-border/60 ll:mx-0.5" aria-hidden="true" />

      {/* Show All Toggle */}
      <button
        type="button"
        aria-pressed={showAll}
        aria-label="Show all breakpoints"
        title="Show every breakpoint side by side"
        onClick={() => useBreakpointViewStore.getState().setShowAll(!showAll)}
        className={`ll:flex ll:items-center ll:gap-1 ll:px-2 ll:py-1 ll:rounded-full ll:text-micro ll:font-medium ll:transition-colors ll:cursor-pointer ${
          showAll
            ? "ll:bg-control-active ll:text-primary ll:font-semibold"
            : "ll:text-muted ll:hover:text-primary ll:hover:bg-control-hover"
        }`}
      >
        <Icon icon={Layers} size={12} />
        <span>All</span>
      </button>

      {/* Responsive frame toggle if target frame exists */}
      {frameId && (
        <>
          <span className="ll:w-px ll:h-4 ll:bg-border/60 ll:mx-0.5" aria-hidden="true" />
          <button
            type="button"
            aria-pressed={responsive}
            aria-label="Toggle responsive frame"
            title="When active, this frame follows the selected breakpoint width"
            onClick={() => void invokeCommand("breakpoint.setResponsive", { on: !responsive })}
            className={`ll:flex ll:items-center ll:gap-1.5 ll:px-2 ll:py-1 ll:rounded-full ll:text-micro ll:font-medium ll:transition-colors ll:cursor-pointer ${
              responsive
                ? "ll:bg-accent/15 ll:text-accent-foreground ll:font-semibold"
                : "ll:text-muted ll:hover:text-primary ll:hover:bg-control-hover"
            }`}
          >
            {responsive && <Icon icon={Check} size={11} />}
            <span>Responsive</span>
          </button>
        </>
      )}
    </div>
  );
};
