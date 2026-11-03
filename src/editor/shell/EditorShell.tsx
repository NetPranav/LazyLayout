"use client";

import React, { useState, useCallback } from "react";
import { TopBar, PageSwitcher, type EditorMode } from "@/editor/components";
import { LeftPanel } from "@/editor/shell/left-panel";
import { CanvasChrome } from "@/editor/shell/canvas-chrome";
import { RightPanelFrame } from "@/editor/shell/right-panel";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import { invokeCommand } from "@/core/commands";

export interface EditorShellProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  saving?: boolean;
  className?: string;
}

export function EditorShell({
  left,
  center,
  right,
  saving: propSaving = false,
  className = "",
}: EditorShellProps) {
  const saving = propSaving;
  const projectName = useProjectMetaStore((s) => s.projectName);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  // Mode state (Design / Motion / Code)
  const [mode, setMode] = useState<EditorMode>("design");

  // Panel collapsed state ('lc' = left collapsed, 'rc' = right collapsed)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const togglePanel = useCallback((panel: "lc" | "rc", open?: boolean) => {
    if (panel === "lc") {
      setIsLeftCollapsed((prev) => (open !== undefined ? !open : !prev));
    } else if (panel === "rc") {
      setIsRightCollapsed((prev) => (open !== undefined ? !open : !prev));
    }
  }, []);

  const handleUndo = useCallback(() => {
    invokeCommand("edit.undo");
  }, []);

  const handleRedo = useCallback(() => {
    invokeCommand("edit.redo");
  }, []);

  const handleSearch = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("antigravity:open_command_palette"));
    }
  }, []);

  // Bottom drawer height in motion/code modes
  const bottomHeight =
    mode === "motion"
      ? "var(--ll-size-bottom-motion-h)"
      : mode === "code"
      ? "var(--ll-size-bottom-code-h)"
      : "0";

  const leftWidth = isLeftCollapsed ? "0" : "var(--ll-size-panel-left-w)";
  const rightWidth = isRightCollapsed ? "0" : "var(--ll-size-panel-right-w)";

  return (
    <div
      data-mode={mode}
      className={`editor-root ${isLeftCollapsed ? "ll-lc " : ""}${
        isRightCollapsed ? "ll-rc " : ""
      }ll:grid ll:relative ll:h-screen ll:w-screen ll:overflow-hidden ll:bg-surface-canvas ll:font-sans ll:text-primary ll:select-none ${className}`}
      style={{
        gridTemplateColumns: `${leftWidth} minmax(0, 1fr) ${rightWidth}`,
        gridTemplateRows: `var(--ll-size-topbar-h) minmax(0, 1fr) ${bottomHeight}`,
        gridTemplateAreas: `
          "top top top"
          "left canvas right"
          "left bottom right"
        `,
      }}
    >
      {/* 1. Top bar in "top" grid area */}
      <div style={{ gridArea: "top" }} className="ll:w-full ll:h-full">
        <TopBar
          projectName={projectName}
          saving={saving}
          mode={mode}
          onSelectMode={setMode}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSearch={handleSearch}
          isLeftCollapsed={isLeftCollapsed}
          isRightCollapsed={isRightCollapsed}
          onTogglePanel={togglePanel}
        />
      </div>

      {/* 2. Left panel slot in "left" grid area */}
      <div
        style={{ gridArea: "left" }}
        className={`ll-left ll-zone ll:h-full ll:overflow-hidden ll:relative ${
          isLeftCollapsed ? "ll:invisible ll:w-0" : "ll:visible"
        }`}
      >
        {left ?? <LeftPanel mode={mode} headerStart={<PageSwitcher />} />}
      </div>

      {/* 3. Center canvas slot in "canvas" grid area */}
      <div
        style={{ gridArea: "canvas" }}
        className="ll-canvas ll:w-full ll:h-full ll:relative ll:overflow-hidden"
      >
        {center ?? <CanvasChrome />}
      </div>

      {/* 4. Right panel slot in "right" grid area */}
      <div
        style={{ gridArea: "right" }}
        className={`ll-right ll-zone ll:h-full ll:overflow-hidden ll:relative ${
          isRightCollapsed ? "ll:invisible ll:w-0" : "ll:visible"
        }`}
      >
        {right ?? <RightPanelFrame mode={mode} />}
      </div>

      {/* 5. Bottom area in "bottom" grid area (motion / code modes) */}
      {bottomHeight !== "0" && (
        <div
          style={{ gridArea: "bottom" }}
          className="ll-bottom ll:border-t ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:relative"
        >
          {/* Bottom timeline/code placeholder */}
        </div>
      )}
    </div>
  );
}
