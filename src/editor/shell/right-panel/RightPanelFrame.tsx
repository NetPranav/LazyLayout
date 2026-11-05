"use client";

import React, { useRef, useId } from "react";
import { RightPanelHeader } from "./RightPanelHeader";
import { RightPanelSection } from "./RightPanelSection";
import { RightPanelAccordionRow } from "./RightPanelAccordionRow";
import { RightPanelAiChat } from "./RightPanelAiChat";
import { useSelectionInspector } from "@/editor/panels/details/hooks/useSelectionInspector";
import type {
  RightPanelFrameProps,
  DesignSectionConfig,
  AccordionRowConfig,
  StatusChip,
} from "./types";

const DEFAULT_DESIGN_SECTIONS: DesignSectionConfig[] = [
  { id: "position", title: "Position" },
  { id: "layout", title: "Layout" },
  { id: "appearance", title: "Appearance" },
  { id: "typography", title: "Typography" },
  { id: "fill", title: "Fill" },
  { id: "stroke", title: "Stroke" },
  { id: "effects", title: "Effects" },
  { id: "animation", title: "Animation" },
  { id: "data", title: "Data" },
  { id: "logic", title: "Logic" },
  { id: "accessibility", title: "Accessibility" },
];

const DEFAULT_MOTION_ROWS: AccordionRowConfig[] = [
  { id: "layer", label: "Layer", value: "Headline" },
  { id: "property", label: "Property", value: "Opacity" },
  { id: "time", label: "Time", value: "00:01.20" },
  { id: "value", label: "Value", value: "100%" },
  { id: "duration", label: "Duration", value: "0.6s" },
  { id: "delay", label: "Delay", value: "0s" },
  { id: "easing", label: "Easing", value: "Ease out", defaultOpen: true },
  { id: "loop", label: "Loop", value: "Off", isMuted: true },
  { id: "presets", label: "Presets", value: "none", isMuted: true },
];

const DEFAULT_CODE_ROWS: AccordionRowConfig[] = [
  { id: "component", label: "Component", value: "Hero" },
  { id: "export", label: "Export", value: "named" },
  { id: "target", label: "Target", value: "React" },
  { id: "props", label: "Props", value: "2", defaultOpen: true },
  { id: "styles", label: "Styles", value: "CSS modules" },
  { id: "dependencies", label: "Dependencies", value: "none", isMuted: true },
  { id: "output", label: "Output", value: "Hero.tsx" },
];

export const RightPanelFrame: React.FC<RightPanelFrameProps> = ({
  mode = "design",
  selectionName: propSelectionName,
  selectionIcon: propSelectionIcon,
  isLayerHidden: propIsLayerHidden,
  onToggleHideLayer: propOnToggleHideLayer,
  onReset,
  onDelete,
  statusChips: propStatusChips,
  onSelectStatusChip,
  aiOpen = false,
  onAiClose,
  aiMessages,
  onAiSendMessage,
  aiInputPlaceholder,
  designSections = DEFAULT_DESIGN_SECTIONS,
  motionRows = DEFAULT_MOTION_ROWS,
  codeRows = DEFAULT_CODE_ROWS,
  children,
  className = "",
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const frameId = useId();
  const bodyId = `${frameId}-body`;
  const designContainerId = `${frameId}-design`;
  const motionContainerId = `${frameId}-key`;
  const codeContainerId = `${frameId}-code`;

  // Live selection inspector hook to resolve real element data when props are not provided
  const inspector = useSelectionInspector();

  const activeSelectionName = propSelectionName !== undefined ? propSelectionName : inspector.selectionName;
  const activeSelectionIcon = propSelectionIcon !== undefined ? propSelectionIcon : inspector.selectionIcon;
  const activeIsHidden = propIsLayerHidden !== undefined ? propIsLayerHidden : inspector.isLayerHidden;
  const activeToggleHide = propOnToggleHideLayer !== undefined ? propOnToggleHideLayer : inspector.onToggleHide;
  const activeStatusChips: StatusChip[] = propStatusChips !== undefined ? propStatusChips : [];

  const handleStatusChipClick = (chip: StatusChip) => {
    onSelectStatusChip?.(chip);
    const target = chip.targetSection ?? chip.id;

    // Scroll smoothly to target section
    if (bodyRef.current) {
      const targetElement = bodyRef.current.querySelector(
        `[data-section-id="${target}"]`
      );
      if (targetElement && typeof targetElement.scrollIntoView === "function") {
        const isReduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        targetElement.scrollIntoView({
          behavior: isReduced ? "auto" : "smooth",
          block: "start",
        });
      }
    }
  };

  return (
    <aside
      aria-label="Inspector"
      data-testid="right-panel"
      data-mode={mode}
      data-ai-open={aiOpen ? "true" : undefined}
      className={`ll-zone ll-right ll:w-panel ll:h-full ll:flex ll:flex-col ll:min-h-0 ll:overflow-hidden ll:bg-surface-panel ll:border-l ll:border-border ${className}`}
    >
      {/* Expanded AI View: swaps the entire right panel body */}
      {aiOpen ? (
        <RightPanelAiChat
          onAiClose={onAiClose}
          aiMessages={aiMessages}
          onAiSendMessage={onAiSendMessage}
          aiInputPlaceholder={aiInputPlaceholder}
        />
      ) : (
        <>
          {/* Header: visible only in design mode */}
          {mode === "design" && (
            <RightPanelHeader
              selectionName={activeSelectionName}
              selectionIcon={activeSelectionIcon}
              isLayerHidden={activeIsHidden}
              onToggleHideLayer={activeToggleHide}
              onReset={onReset}
              onDelete={onDelete}
              statusChips={activeStatusChips}
              onSelectStatusChip={handleStatusChipClick}
            />
          )}

          {/* Inspector Body */}
          <div
            id={bodyId}
            ref={bodyRef}
            className="ll-zbody ll:flex-1 ll:min-h-0 ll:overflow-y-auto"
          >
            {children ? (
              children
            ) : mode === "design" ? (
              <div id={designContainerId} className="ll:flex ll:flex-col">
                {designSections.map((sec) => (
                  <RightPanelSection
                    key={sec.id}
                    id={sec.id}
                    title={sec.title}
                    onAdd={sec.onAdd}
                    moreContent={sec.moreContent}
                    headerAction={sec.headerAction}
                  >
                    {sec.children}
                  </RightPanelSection>
                ))}
              </div>
            ) : mode === "motion" ? (
              <div id={motionContainerId} className="ll:flex ll:flex-col">
                {motionRows.map((row) => (
                  <RightPanelAccordionRow
                    key={row.id}
                    id={row.id}
                    label={row.label}
                    value={row.value}
                    isMuted={row.isMuted}
                    defaultOpen={row.defaultOpen}
                  >
                    {row.children}
                  </RightPanelAccordionRow>
                ))}
              </div>
            ) : (
              <div id={codeContainerId} className="ll:flex ll:flex-col">
                {codeRows.map((row) => (
                  <RightPanelAccordionRow
                    key={row.id}
                    id={row.id}
                    label={row.label}
                    value={row.value}
                    isMuted={row.isMuted}
                    defaultOpen={row.defaultOpen}
                  >
                    {row.children}
                  </RightPanelAccordionRow>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
