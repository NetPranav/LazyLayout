"use client";

import React, { useState, useCallback } from "react";
import { TopBar, type DeviceMode } from "@/editor/components/TopBar";
import { useProjectMetaStore } from "@/core/store/useProjectMetaStore";
import { useHistoryStore } from "@/core/store/useHistoryStore";
import { invokeCommand } from "@/core/commands";

export function EditorShell() {
  const projectName = useProjectMetaStore((s) => s.projectName);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");

  const handleSelectDeviceMode = useCallback((mode: DeviceMode) => {
    setDeviceMode(mode);
    invokeCommand("frame.focusPreset", { preset: mode });
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

  return (
    <div className="editor-root ll:h-screen ll:w-screen ll:overflow-hidden ll:flex ll:flex-col ll:bg-surface-canvas ll:font-sans ll:text-primary ll:select-none">
      <TopBar
        projectName={projectName}
        deviceMode={deviceMode}
        onSelectDeviceMode={handleSelectDeviceMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSearch={handleSearch}
        /* Share and Settings do nothing yet (no onClick handler) */
      />
      <main
        className="ll:flex-1 ll:w-full ll:bg-surface-canvas ll:relative ll:overflow-hidden"
        aria-label="Editor Canvas"
      />
    </div>
  );
}
