"use client";

/**
 * ============================================================================
 * 3D PROPERTIES EDITOR (ROADMAP 3D-022, 3D-023, 3D-030)
 * ============================================================================
 * Blender-style properties inspector for active 3D selections.
 * Features:
 *   - Blender tab strip: Object, Modifiers, Physics, Material, Object Data,
 *     Constraints, World, Render.
 *   - Simple / Pro face toggle at top right (persisted to localStorage).
 *   - Integrated Looks system and non-destructive Modifier stack.
 *   - Mounts seamlessly into LazyLayout's RightPanelConnected frame.
 * ============================================================================
 */

import React from "react";
import {
  Box,
  Layers,
  Activity,
  Sparkles,
  Database,
  Link2,
  Globe,
  Gauge,
  Lightbulb,
  Camera,
  Bone,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { useDocument } from "@/core/store/useDocumentStore";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import {
  usePropertiesFace,
  usePropertiesTab,
  type Tab3dId,
} from "./propertiesFace";
import { ObjectTab } from "./ObjectTab";
import { ModifiersTab } from "./ModifiersTab";
import { PhysicsTab } from "./PhysicsTab";
import { MaterialTab } from "./MaterialTab";
import { ObjectDataTab } from "./ObjectDataTab";
import { ConstraintsTab } from "./ConstraintsTab";
import { WorldTab } from "./WorldTab";
import { RenderTab } from "./RenderTab";

export interface Properties3dProps {
  activeId?: string | null;
  className?: string;
}

export const Properties3d: React.FC<Properties3dProps> = ({
  activeId: propActiveId,
  className = "",
}) => {
  const storeActiveId = useViewportStore((s) => s.selection.active);
  const activeId = propActiveId ?? storeActiveId;

  const doc = useDocument((d) => d);
  const obj = activeId ? doc.objects?.[activeId] : undefined;

  const face = usePropertiesFace((s) => s.face);
  const setFace = usePropertiesFace((s) => s.setFace);

  const activeTab = usePropertiesTab((s) => s.activeTab);
  const setActiveTab = usePropertiesTab((s) => s.setActiveTab);

  // Dynamic icon for Object Data tab depending on selected object type
  const objectDataIcon =
    obj?.type === "light"
      ? Lightbulb
      : obj?.type === "camera"
      ? Camera
      : obj?.type === "armature"
      ? Bone
      : Database;

  const TABS: Array<{ id: Tab3dId; label: string; icon: typeof Box; title: string }> = [
    { id: "object", label: "Object", icon: Box, title: "Object transforms & hierarchy" },
    { id: "modifiers", label: "Modifiers", icon: Layers, title: "Non-destructive modifier stack" },
    { id: "physics", label: "Physics", icon: Activity, title: "Physics simulation & surface springs" },
    { id: "material", label: "Material", icon: Sparkles, title: "PBR Material slots & looks" },
    { id: "object-data", label: "Data", icon: objectDataIcon, title: "Geometry & object data" },
    { id: "constraints", label: "Constraints", icon: Link2, title: "Object tracking & motion limits" },
    { id: "world", label: "World", icon: Globe, title: "Environment & background lighting" },
    { id: "render", label: "Render", icon: Gauge, title: "GPU quality tiers & budgets" },
  ];

  return (
    <div
      data-testid="properties-3d"
      className={`ll:flex ll:flex-col ll:w-full ll:h-full ll:bg-surface-panel ${className}`}
    >
      {/* Top Bar: Blender Tab Icons & Simple/Pro Toggle */}
      <div className="ll:flex ll:items-center ll:justify-between ll:px-3 ll:py-2 ll:border-b ll:border-border ll:bg-surface-bar ll:shrink-0 ll:gap-2">
        {/* Horizontal Tab Strip */}
        <div className="ll:flex ll:items-center ll:gap-1 ll:overflow-x-auto ll:no-scrollbar">
          {TABS.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-tab={tab.id}
                data-active={isTabActive ? "true" : undefined}
                title={tab.title}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`ll:p-1.5 ll:rounded ll:flex ll:items-center ll:justify-center ll:transition-all ll:border-0 ll:cursor-pointer ${
                  isTabActive
                    ? "ll:bg-accent/15 ll:text-accent font-semibold shadow-sm"
                    : "ll:bg-transparent ll:text-muted ll:hover:text-primary ll:hover:bg-surface-hover"
                }`}
              >
                <Icon icon={tab.icon} size={15} />
              </button>
            );
          })}
        </div>

        {/* Simple / Pro Segmented Control */}
        <div className="ll:shrink-0">
          <SegmentedControl
            size="compact"
            ariaLabel="Inspector Face: Simple or Pro"
            value={face}
            options={[
              { value: "simple", label: "Simple", title: "Plain controls + Looks" },
              { value: "pro", label: "Pro", title: "Exhaustive field renderer" },
            ]}
            onChange={(val) => setFace(val as "simple" | "pro")}
          />
        </div>
      </div>

      {/* Active Tab Body */}
      <div className="ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:p-4">
        {activeTab === "object" && (
          <ObjectTab objectId={activeId ?? ""} face={face} />
        )}
        {activeTab === "modifiers" && (
          <ModifiersTab objectId={activeId ?? ""} face={face} />
        )}
        {activeTab === "physics" && (
          <PhysicsTab objectId={activeId ?? ""} face={face} />
        )}
        {activeTab === "material" && (
          <MaterialTab objectId={activeId ?? ""} face={face} />
        )}
        {activeTab === "object-data" && (
          <ObjectDataTab objectId={activeId ?? ""} face={face} />
        )}
        {activeTab === "constraints" && (
          <ConstraintsTab objectId={activeId ?? ""} face={face} />
        )}
        {activeTab === "world" && (
          <WorldTab face={face} />
        )}
        {activeTab === "render" && (
          <RenderTab face={face} />
        )}
      </div>
    </div>
  );
};
