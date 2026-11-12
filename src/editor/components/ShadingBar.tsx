"use client";

/**
 * ============================================================================
 * VIEWPORT SHADING BAR (Phase 3D-018)
 * ============================================================================
 * The 4 shading buttons (Wireframe, Solid, Material Preview, Rendered) plus
 * an X-ray toggle at the top right of the 3D viewport.
 * Bound to `useViewportStore((s) => s.settings)` and registers:
 *   - 3d.shading.wireframe
 *   - 3d.shading.solid
 *   - 3d.shading.material
 *   - 3d.shading.rendered
 *   - 3d.shading.toggle_xray
 * ============================================================================
 */

import React, { useEffect } from "react";
import { Box, Circle, Palette, Sparkles, ScanLine } from "lucide-react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import { useViewportStore } from "../../core/render/scene3d/viewportStore";
import { viewportReducer, type ShadingMode } from "../../core/3d/viewport/settings";
import { defineCommand } from "../../core/commands/registry";

export interface ShadingBarProps {
  className?: string;
}

/**
 * Registers shading and x-ray viewport commands on the central command bus.
 */
export function registerShadingCommands(): () => void {
  const unregisters = [
    defineCommand({
      id: "3d.shading.wireframe",
      title: "Wireframe Shading",
      category: "3D",
      keybinding: "Shift+Z",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.shading.wireframe"));
      },
    }),
    defineCommand({
      id: "3d.shading.solid",
      title: "Solid Shading",
      category: "3D",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.shading.solid"));
      },
    }),
    defineCommand({
      id: "3d.shading.material",
      title: "Material Preview",
      category: "3D",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.shading.material"));
      },
    }),
    defineCommand({
      id: "3d.shading.rendered",
      title: "Rendered View",
      category: "3D",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.shading.rendered"));
      },
    }),
    defineCommand({
      id: "3d.shading.toggle_xray",
      title: "Toggle X-Ray",
      category: "3D",
      keybinding: "Alt+Z",
      when: (ctx) => !ctx.textEditing && Boolean(ctx.editingScene3d),
      run: () => {
        useViewportStore.getState().setSettings((s) => viewportReducer(s, "3d.shading.toggle_xray"));
      },
    }),
  ];

  return () => {
    unregisters.forEach((u) => u());
  };
}

export const ShadingBar: React.FC<ShadingBarProps> = ({ className = "" }) => {
  const settings = useViewportStore((s) => s.settings);
  const setSettings = useViewportStore((s) => s.setSettings);

  // Register commands on mount
  useEffect(() => {
    return registerShadingCommands();
  }, []);

  const handleSetShading = (mode: ShadingMode) => {
    setSettings((prev) => viewportReducer(prev, { type: "SET_SHADING", shading: mode }));
  };

  const handleToggleXray = () => {
    setSettings((prev) => viewportReducer(prev, { type: "3d.shading.toggle_xray" }));
  };

  const shadingModes: Array<{
    mode: ShadingMode;
    label: string;
    icon: typeof Box;
    testId: string;
    shortcut?: string;
  }> = [
    {
      mode: "wireframe",
      label: "Wireframe",
      icon: Box,
      testId: "shading-wireframe",
      shortcut: "Shift+Z",
    },
    {
      mode: "solid",
      label: "Solid",
      icon: Circle,
      testId: "shading-solid",
    },
    {
      mode: "material",
      label: "Material Preview",
      icon: Palette,
      testId: "shading-material",
    },
    {
      mode: "rendered",
      label: "Rendered",
      icon: Sparkles,
      testId: "shading-rendered",
    },
  ];

  return (
    <div
      data-testid="shading-bar"
      className={`ll:flex ll:items-center ll:gap-0.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:p-0.5 ll:shadow-sm ll:select-none ${className}`}
    >
      {shadingModes.map(({ mode, label, icon, testId, shortcut }) => {
        const isActive = settings.shading === mode;
        const tooltipText = shortcut ? `${label} (${shortcut})` : label;

        return (
          <Tooltip key={mode} content={tooltipText} side="bottom">
            <button
              type="button"
              data-testid={testId}
              data-active={isActive ? "true" : "false"}
              aria-label={label}
              onClick={() => handleSetShading(mode)}
              className={`ll:h-7 ll:w-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:border-0 ll:cursor-pointer ll:transition-colors ${
                isActive
                  ? "ll:bg-control-active ll:text-primary"
                  : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
              }`}
            >
              <Icon icon={icon} size={15} />
            </button>
          </Tooltip>
        );
      })}

      {/* Divider */}
      <div className="ll:w-px ll:h-4 ll:bg-border ll:mx-0.5" />

      {/* X-Ray Toggle */}
      <Tooltip content="Toggle X-Ray (Alt+Z)" side="bottom">
        <button
          type="button"
          data-testid="shading-xray"
          data-active={settings.xray ? "true" : "false"}
          aria-label="Toggle X-Ray"
          onClick={handleToggleXray}
          className={`ll:h-7 ll:w-7 ll:flex ll:items-center ll:justify-center ll:rounded-sm ll:border-0 ll:cursor-pointer ll:transition-colors ${
            settings.xray
              ? "ll:bg-control-active ll:text-primary"
              : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
          }`}
        >
          <Icon icon={ScanLine} size={15} />
        </button>
      </Tooltip>
    </div>
  );
};
