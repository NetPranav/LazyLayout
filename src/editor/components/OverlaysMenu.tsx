"use client";

/**
 * ============================================================================
 * VIEWPORT OVERLAYS MENU (Phase 3D-019)
 * ============================================================================
 * Blender-style overlays dropdown popover positioned in the viewport chrome:
 *   - Grid
 *   - Axes
 *   - Origins
 *   - Face Orientation
 *   - Normals
 *   - Wireframe on shaded
 *   - Statistics
 *
 * Registers commands `3d.overlay.toggle_grid` and `3d.overlay.toggle_stats`.
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Icon } from "./Icon";
import { Toggle } from "./Toggle";
import { Tooltip } from "./Tooltip";
import { useViewportStore } from "../../core/render/scene3d/viewportStore";
import { viewportReducer, type ViewportOverlays } from "../../core/3d/viewport/settings";
import { defineCommand } from "../../core/commands/registry";

export interface OverlaysMenuProps {
  className?: string;
}

/**
 * Registers overlay toggling commands on the command bus.
 */
export function registerOverlayCommands(): () => void {
  const unregisters = [
    defineCommand({
      id: "3d.overlay.toggle_grid",
      title: "Toggle 3D Grid Overlay",
      category: "3D",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.overlay.toggle_grid"));
      },
    }),
    defineCommand({
      id: "3d.overlay.toggle_stats",
      title: "Toggle 3D Scene Statistics",
      category: "3D",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.overlay.toggle_stats"));
      },
    }),
  ];

  return () => {
    unregisters.forEach((u) => u());
  };
}

export const OverlaysMenu: React.FC<OverlaysMenuProps> = ({ className = "" }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const overlays = useViewportStore((s) => s.settings.overlays);
  const setSettings = useViewportStore((s) => s.setSettings);

  // Register commands
  useEffect(() => {
    return registerOverlayCommands();
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleToggle = (key: keyof ViewportOverlays) => {
    setSettings((prev) =>
      viewportReducer(prev, {
        type: "TOGGLE_OVERLAY",
        overlay: key,
      })
    );
  };

  const overlayItems: Array<{
    key: keyof ViewportOverlays;
    label: string;
    testId: string;
  }> = [
    { key: "grid", label: "Grid", testId: "overlay-toggle-grid" },
    { key: "axes", label: "Axes", testId: "overlay-toggle-axes" },
    { key: "origins", label: "Origins", testId: "overlay-toggle-origins" },
    { key: "faceOrientation", label: "Face Orientation", testId: "overlay-toggle-face-orientation" },
    { key: "normals", label: "Normals", testId: "overlay-toggle-normals" },
    { key: "wireOnShaded", label: "Wireframe on Shaded", testId: "overlay-toggle-wire-on-shaded" },
    { key: "stats", label: "Statistics", testId: "overlay-toggle-stats" },
  ];

  return (
    <div ref={containerRef} className={`ll:relative ll:select-none ${className}`}>
      {/* Trigger Button */}
      <Tooltip content="Viewport Overlays" side="bottom">
        <button
          type="button"
          data-testid="overlays-menu-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={`ll:h-8 ll:px-2 ll:flex ll:items-center ll:gap-1 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-sm ll:cursor-pointer ll:transition-colors ${
            open
              ? "ll:bg-control-active ll:text-primary"
              : "ll:text-secondary ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={SlidersHorizontal} size={14} />
          <span className="ll:text-micro ll:font-medium ll:font-sans">Overlays</span>
          <Icon
            icon={ChevronDown}
            size={12}
            className={`ll:text-muted ll:transition-transform ll:duration-100 ${
              open ? "ll:rotate-180" : ""
            }`}
          />
        </button>
      </Tooltip>

      {/* Popover */}
      {open && (
        <div
          data-testid="overlays-menu-popover"
          role="dialog"
          aria-label="Viewport Overlays"
          className="ll:absolute ll:right-0 ll:top-full ll:mt-1.5 ll:w-56 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-md ll:p-2 ll:flex ll:flex-col ll:gap-1.5 ll:z-50 ll:font-sans"
        >
          <div className="ll:px-1.5 ll:py-1 ll:border-b ll:border-border">
            <span className="ll:text-micro ll:font-semibold ll:text-primary">
              Viewport Overlays
            </span>
          </div>

          <div className="ll:flex ll:flex-col ll:gap-1 ll:pt-0.5">
            {overlayItems.map(({ key, label, testId }) => {
              const isChecked = overlays[key];

              return (
                <div
                  key={key}
                  data-testid={testId}
                  className="ll:flex ll:items-center ll:justify-between ll:px-1.5 ll:py-1 ll:rounded-sm ll:hover:bg-surface-hover ll:cursor-pointer"
                  onClick={() => handleToggle(key)}
                >
                  <span className="ll:text-micro ll:text-secondary">{label}</span>
                  <Toggle
                    checked={isChecked}
                    onChange={() => handleToggle(key)}
                    size="sm"
                    aria-label={label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
