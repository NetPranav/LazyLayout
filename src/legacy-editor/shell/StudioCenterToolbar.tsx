"use client";

/**
 * ============================================================================
 * STUDIO CENTER TOOLBAR (ADAPTIVE CONTEXTUAL TOOLBAR)
 * ============================================================================
 * Screen / Scope: Screen 01: Master IDE Studio Top Bar (`StudioHeader`)
 * Behavior:
 *   - Nothing selected: Undo / Redo controls + Desktop / Tablet / Mobile device switcher.
 *   - A layer selected: Alignment, Distribution, Tidy, and Arrange actions.
 * Apple-level restraint:
 *   - Rectangular shapes with modest radii from tokens.
 *   - Unified stroke width (1.75).
 *   - Solid neutral surfaces, hairline borders, soft elevation.
 * ============================================================================
 */

import React from "react";
import {
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  LayoutGrid,
  BringToFront,
  SendToBack,
  FolderPlus,
} from "lucide-react";
import { invokeCommand } from "@/core/commands";
import { useSelectionStore } from "@/core/store/useSelectionStore";

export interface StudioCenterToolbarProps {
  deviceMode?: "desktop" | "tablet" | "mobile";
  onSelectDeviceMode?: (mode: "desktop" | "tablet" | "mobile") => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const StudioCenterToolbar: React.FC<StudioCenterToolbarProps> = ({
  deviceMode = "desktop",
  onSelectDeviceMode,
  canUndo = true,
  canRedo = true,
}) => {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const hasSelection = selectedIds.length > 0;

  if (hasSelection) {
    // A layer selected: Align, Distribute, Tidy, and Arrange toolbar
    return (
      <div className="studio-header__context-bar studio-header__align-bar" role="toolbar" aria-label="Layer Arrange and Alignment Actions">
        {/* Horizontal Alignment Group */}
        <div className="studio-header__tool-group studio-header__tool-group--align-h">
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Align Left (Alt+A)"
            aria-label="Align Left"
            onClick={() => invokeCommand("align.left")}
          >
            <AlignStartVertical size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Align Horizontal Centers (Alt+H)"
            aria-label="Align Horizontal Centers"
            onClick={() => invokeCommand("align.hcenter")}
          >
            <AlignCenterVertical size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Align Right (Alt+D)"
            aria-label="Align Right"
            onClick={() => invokeCommand("align.right")}
          >
            <AlignEndVertical size={14} strokeWidth={1.75} />
          </button>
        </div>

        <span className="studio-header__tool-divider studio-header__tool-divider--v" aria-hidden="true" />

        {/* Vertical Alignment Group */}
        <div className="studio-header__tool-group studio-header__tool-group--align-v">
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Align Top (Alt+W)"
            aria-label="Align Top"
            onClick={() => invokeCommand("align.top")}
          >
            <AlignStartHorizontal size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Align Vertical Centers (Alt+V)"
            aria-label="Align Vertical Centers"
            onClick={() => invokeCommand("align.vcenter")}
          >
            <AlignCenterHorizontal size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Align Bottom (Alt+S)"
            aria-label="Align Bottom"
            onClick={() => invokeCommand("align.bottom")}
          >
            <AlignEndHorizontal size={14} strokeWidth={1.75} />
          </button>
        </div>

        <span className="studio-header__tool-divider studio-header__tool-divider--distribute" aria-hidden="true" />

        {/* Spacing & Distribution Group */}
        <div className="studio-header__tool-group studio-header__tool-group--distribute">
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Distribute Horizontal Spacing (Ctrl+Alt+H)"
            aria-label="Distribute Horizontal Spacing"
            onClick={() => invokeCommand("distribute.horizontal")}
          >
            <AlignHorizontalSpaceAround size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Distribute Vertical Spacing (Ctrl+Alt+V)"
            aria-label="Distribute Vertical Spacing"
            onClick={() => invokeCommand("distribute.vertical")}
          >
            <AlignVerticalSpaceAround size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Tidy Up (Ctrl+Alt+T)"
            aria-label="Tidy Up"
            onClick={() => invokeCommand("layer.tidy")}
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
          </button>
        </div>

        <span className="studio-header__tool-divider studio-header__tool-divider--arrange" aria-hidden="true" />

        {/* Z-Order Arrange & Grouping */}
        <div className="studio-header__tool-group studio-header__tool-group--arrange">
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Bring Forward (Ctrl+])"
            aria-label="Bring Forward"
            onClick={() => invokeCommand("layer.bringForward")}
          >
            <BringToFront size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="studio-header__tool-btn"
            title="Send Backward (Ctrl+[)"
            aria-label="Send Backward"
            onClick={() => invokeCommand("layer.sendBackward")}
          >
            <SendToBack size={14} strokeWidth={1.75} />
          </button>

          {selectedIds.length > 1 && (
            <button
              type="button"
              className="studio-header__tool-btn"
              title="Group Selection (Ctrl+G)"
              aria-label="Group Selection"
              onClick={() => invokeCommand("edit.group")}
            >
              <FolderPlus size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>

        <span className="studio-header__selection-badge">
          {selectedIds.length === 1 ? "1 layer" : `${selectedIds.length} layers`}
        </span>
      </div>
    );
  }

  // Nothing selected: Undo / Redo + Device Switcher
  return (
    <div className="studio-header__context-bar" role="toolbar" aria-label="History and Device Target Controls">
      {/* Undo / Redo */}
      <button
        type="button"
        className="studio-header__tool-btn"
        disabled={!canUndo}
        onClick={() => invokeCommand("edit.undo")}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 size={14} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="studio-header__tool-btn"
        disabled={!canRedo}
        onClick={() => invokeCommand("edit.redo")}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 size={14} strokeWidth={1.75} />
      </button>

      <span className="studio-header__tool-divider" aria-hidden="true" />

      {/* Device Switcher Segmented Control */}
      <div className="studio-header__segmented" role="radiogroup" aria-label="Device Preview Target">
        <button
          type="button"
          role="radio"
          aria-checked={deviceMode === "desktop"}
          className={`studio-header__segmented-btn ${deviceMode === "desktop" ? "studio-header__segmented-btn--active" : ""}`}
          onClick={() => onSelectDeviceMode?.("desktop")}
          title="Desktop Canvas (1440px)"
          aria-label="Desktop Preview"
        >
          <Monitor size={13} strokeWidth={1.75} />
          <span className="studio-header__segmented-label">Desktop</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={deviceMode === "tablet"}
          className={`studio-header__segmented-btn ${deviceMode === "tablet" ? "studio-header__segmented-btn--active" : ""}`}
          onClick={() => onSelectDeviceMode?.("tablet")}
          title="Tablet Canvas (768px)"
          aria-label="Tablet Preview"
        >
          <Tablet size={13} strokeWidth={1.75} />
          <span className="studio-header__segmented-label">Tablet</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={deviceMode === "mobile"}
          className={`studio-header__segmented-btn ${deviceMode === "mobile" ? "studio-header__segmented-btn--active" : ""}`}
          onClick={() => onSelectDeviceMode?.("mobile")}
          title="Mobile Canvas (375px)"
          aria-label="Mobile Preview"
        >
          <Smartphone size={13} strokeWidth={1.75} />
          <span className="studio-header__segmented-label">Mobile</span>
        </button>
      </div>
    </div>
  );
};
