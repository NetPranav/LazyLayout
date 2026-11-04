"use client";

import React, { useState } from "react";
import { CanvasChrome } from "./CanvasChrome";
import type { CanvasTool, ShapeTool, GridStyle, MotionFeel, AiState } from "./types";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { CANVAS_CHROME_SIZES, CANVAS_CHROME_SAMPLE_USERS } from "./constants";
import type { CollabUser } from "@/editor/components/AvatarStack";

export interface CanvasChromeLabProps {
  initialShowRulers?: boolean;
  initialInsertOpen?: boolean;
  initialAiBoxOpen?: boolean;
  initialAiLoading?: boolean;
  initialAiState?: AiState;
  initialViewOptionsOpen?: boolean;
  initialTheme?: string;
  initialUsers?: readonly CollabUser[];
}

export function CanvasChromeLab({
  initialShowRulers = false,
  initialInsertOpen = false,
  initialAiBoxOpen = false,
  initialAiLoading = false,
  initialAiState = "idle",
  initialViewOptionsOpen = false,
  initialTheme = "paper",
  initialUsers = CANVAS_CHROME_SAMPLE_USERS,
}: CanvasChromeLabProps) {
  const [showRulers, setShowRulers] = useState(initialShowRulers);
  const [users, setUsers] = useState<readonly CollabUser[]>(initialUsers);
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [activeShape, setActiveShape] = useState<ShapeTool>("box");
  const [zoom, setZoom] = useState(0.59);
  const [isInsertOpen, setIsInsertOpen] = useState(initialInsertOpen);
  const [isAiBoxOpen, setIsAiBoxOpen] = useState(initialAiBoxOpen);
  const [aiLoading, setAiLoading] = useState(initialAiLoading);
  const [aiState, setAiState] = useState<AiState>(
    initialAiLoading ? "work" : initialAiState
  );
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState(
    initialViewOptionsOpen
  );
  const [gridStyle, setGridStyle] = useState<GridStyle>("dots");
  const [gridSize, setGridSize] = useState(24);
  const [theme, setTheme] = useState(initialTheme);
  const [motionFeel, setMotionFeel] = useState<MotionFeel>("bouncy");
  const [checkerboard, setCheckerboard] = useState(false);
  const [pixelGrid, setPixelGrid] = useState(false);

  return (
    <div
      className="ll-editor-root ll:overflow-hidden ll:relative ll:bg-surface-canvas ll:select-none"
      data-theme={theme}
      style={{
        width: "var(--ll-size-viewport-desktop)",
        height: "var(--ll-size-viewport-desktop-h)",
      }}
    >
      {/* Floating Lab Controls */}
      <div
        data-lab-controls="true"
        className="ll:absolute ll:top-2 ll:left-6 ll:z-50 ll:flex ll:items-center ll:gap-1 ll:p-1 ll:bg-surface-raised ll:border ll:border-border ll:rounded-md ll:shadow-soft"
      >
        <span className="ll:px-2 ll:font-mono ll:text-nano ll:uppercase ll:tracking-wider ll:text-muted">
          Lab
        </span>
        <Button
          variant="secondary"
          size="sm"
          data-state="default"
          onClick={() => {
            setIsInsertOpen(false);
            setIsAiBoxOpen(false);
            setAiLoading(false);
            setAiState("idle");
            setIsViewOptionsOpen(false);
            setShowRulers(false);
          }}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          Default
        </Button>
        <Button
          variant={showRulers ? "primary" : "secondary"}
          size="sm"
          data-state="rulers-on"
          onClick={() => setShowRulers(true)}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          Rulers ON
        </Button>
        <Button
          variant={!showRulers ? "primary" : "secondary"}
          size="sm"
          data-state="rulers-off"
          onClick={() => setShowRulers(false)}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          Rulers OFF
        </Button>
        <Button
          variant={isInsertOpen ? "primary" : "secondary"}
          size="sm"
          data-state="insert"
          onClick={() => {
            setIsAiBoxOpen(false);
            setIsViewOptionsOpen(false);
            setIsInsertOpen(true);
          }}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          Insert
        </Button>
        <Button
          variant={isAiBoxOpen && aiLoading ? "primary" : "secondary"}
          size="sm"
          data-state="ai-loading"
          onClick={() => {
            setIsInsertOpen(false);
            setIsViewOptionsOpen(false);
            setIsAiBoxOpen(true);
            setAiLoading(true);
            setAiState("work");
          }}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          AI Loading
        </Button>
        <Button
          variant={isViewOptionsOpen ? "primary" : "secondary"}
          size="sm"
          data-state="view"
          onClick={() => {
            setIsInsertOpen(false);
            setIsAiBoxOpen(false);
            setIsViewOptionsOpen(true);
          }}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          View Options
        </Button>
        <Button
          variant={users.length > 0 ? "primary" : "secondary"}
          size="sm"
          data-state="users-toggle"
          onClick={() => {
            setUsers((prev) => (prev.length > 0 ? [] : CANVAS_CHROME_SAMPLE_USERS));
          }}
          className="ll:h-6 ll:px-2 ll:text-nano"
        >
          {users.length > 0 ? `Users (${users.length})` : "Users (0)"}
        </Button>
      </div>

      <CanvasChrome
        users={users}
        showRulers={showRulers}
        onToggleRulers={setShowRulers}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeShape={activeShape}
        onSelectShape={setActiveShape}
        zoom={zoom}
        onZoomChange={setZoom}
        isInsertOpen={isInsertOpen}
        onToggleInsert={(open) => setIsInsertOpen((prev) => open ?? !prev)}
        isAiBoxOpen={isAiBoxOpen}
        onToggleAiBox={(open) => setIsAiBoxOpen((prev) => open ?? !prev)}
        aiState={aiState}
        aiLoading={aiLoading}
        onAiSubmit={() => {
          setAiLoading(true);
          setAiState("work");
        }}
        onAiStop={() => {
          setAiLoading(false);
          setAiState("idle");
        }}
        onAiUndo={() => {
          setAiLoading(false);
          setAiState("idle");
        }}
        onAiKeep={() => {
          setAiLoading(false);
          setAiState("idle");
        }}
        isViewOptionsOpen={isViewOptionsOpen}
        onToggleViewOptions={(open) =>
          setIsViewOptionsOpen((prev) => open ?? !prev)
        }
        gridStyle={gridStyle}
        onGridStyleChange={setGridStyle}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        theme={theme}
        onThemeChange={setTheme}
        motionFeel={motionFeel}
        onMotionFeelChange={setMotionFeel}
        checkerboard={checkerboard}
        onToggleCheckerboard={setCheckerboard}
        pixelGrid={pixelGrid}
        onTogglePixelGrid={setPixelGrid}
      >
        {/* Sample Artboard inside Stage slot */}
        <div
          data-artboard="true"
          style={{
            width: CANVAS_CHROME_SIZES.labArtboardWidth,
            height: CANVAS_CHROME_SIZES.labArtboardHeight,
            transform: "translate(-50%, -50%)",
          }}
          className="ll-artboard ll:absolute ll:left-1/2 ll:top-1/2 ll:origin-center ll:bg-board-bg ll:border ll:border-board-line ll:rounded-sm ll:shadow-soft ll:select-none"
        >
          {/* Artboard Top Label (Desktop · 1440) */}
          <div className="ll:absolute ll:-top-7 ll:left-0 ll:flex ll:items-center ll:gap-1.5 ll:px-1.5 ll:h-6 ll:rounded-sm ll:text-nano ll:font-sans ll:text-secondary ll:select-none">
            <span>
              Desktop · <span className="ll:font-mono">1440</span>
            </span>
            <Icon icon={ChevronDown} size={CANVAS_CHROME_SIZES.iconSm} className="ll:text-muted" />
          </div>

          {/* Artboard Title Bar (.ll-atit) */}
          <div className="ll-atit ll:absolute ll:left-0 ll:right-0 ll:top-0 ll:h-6 ll:bg-surface-panel ll:border-b ll:border-border ll:flex ll:items-center ll:px-2.5 ll:font-mono ll:text-nano ll:text-secondary">
            LazyLayout
          </div>

          {/* Headline element */}
          <div
            style={{
              width: CANVAS_CHROME_SIZES.labHeadlineWidth,
              left: CANVAS_CHROME_SIZES.labHeadlineLeft,
              top: CANVAS_CHROME_SIZES.labHeadlineTop,
            }}
            className="ll:absolute ll:cursor-default"
          >
            <b className="ll:block ll:text-display ll:leading-display ll:tracking-display ll:font-semibold ll:text-primary">
              Design it once. Ship it lazily.
            </b>
            <span className="ll:block ll:mt-2.5 ll:text-secondary ll:text-body">
              Build pages visually and get production code out.
            </span>
          </div>

          {/* Button element */}
          <div
            style={{
              left: CANVAS_CHROME_SIZES.labButtonLeft,
              bottom: CANVAS_CHROME_SIZES.labButtonBottom,
              height: CANVAS_CHROME_SIZES.labButtonHeight,
            }}
            className="ll:absolute ll:px-4 ll:grid ll:place-items-center ll:bg-control-primary-bg ll:text-control-primary-fg ll:rounded-sm ll:text-small ll:font-medium ll:cursor-pointer"
          >
            Get started
          </div>

          {/* Image Placeholder */}
          <div
            style={{
              right: CANVAS_CHROME_SIZES.labImageRight,
              top: CANVAS_CHROME_SIZES.labImageTop,
              width: CANVAS_CHROME_SIZES.labImageWidth,
              height: CANVAS_CHROME_SIZES.labImageHeight,
            }}
            className="ll:absolute ll:bg-placeholder ll:border ll:border-border ll:rounded-sm"
          />
        </div>
      </CanvasChrome>
    </div>
  );
}