"use client";

/**
 * ============================================================================
 * WORLD ENVIRONMENT PROPERTIES TAB (Phase 3D-022)
 * ============================================================================
 * Controls the active scene's World data block:
 *   - Background horizon color
 *   - Ambient lighting color and intensity
 *   - Environment HDRI lighting intensity and rotation
 * ============================================================================
 */

import React from "react";
import { Globe, Sun, Image as ImageIcon } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Slider } from "@/editor/components/Slider";
import { NumberField } from "@/editor/components/NumberField";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { useDocument } from "@/core/store/useDocumentStore";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { tryRunCommand } from "@/core/commands";
import { World3dSchema } from "@/core/document/scene3d";
import { FieldRenderer } from "./FieldRenderer";
import type { PropertiesFace } from "./propertiesFace";

export interface WorldTabProps {
  face: PropertiesFace;
  className?: string;
}

export const WorldTab: React.FC<WorldTabProps> = ({
  face,
  className = "",
}) => {
  const doc = useDocument((d) => d);
  const editingSceneId = useViewportStore((s) => s.editingSceneId);

  // Find active world block
  const scene = editingSceneId
    ? doc.scenes?.[editingSceneId]
    : Object.values(doc.scenes ?? {})[0];
  const worldId = scene?.world ?? Object.keys(doc.worlds ?? {})[0];
  const world = worldId ? doc.worlds?.[worldId] : undefined;

  const handleUpdateWorld = (field: string, val: unknown) => {
    if (!worldId) return;
    tryRunCommand("3d.world.set", {
      worldId,
      [field]: val,
    });
  };

  if (!world) {
    return (
      <div className="ll:p-4 ll:text-micro ll:text-muted" data-testid="tab-world">
        No 3D World data block defined in the active scene.
      </div>
    );
  }

  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-world">
      {/* Header Info */}
      <div className="ll:flex ll:items-center ll:justify-between ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <Icon icon={Globe} size={14} className="ll:text-secondary" />
          <span className="ll:text-micro ll:font-semibold ll:text-primary">
            World: {world.name || "Default World"}
          </span>
        </div>
      </div>

      {face === "simple" ? (
        <div className="ll:flex ll:flex-col ll:gap-3.5">
          {/* Background Color */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:font-medium">Background Color</span>
            <div className="ll:w-32">
              <ColorSwatchField
                hex={world.color}
                onChangeHex={(c: string) => handleUpdateWorld("color", c)}
                aria-label="Background Color"
                withPicker
              />
            </div>
          </div>

          {/* Ambient Color */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <div className="ll:flex ll:items-center ll:gap-1.5">
              <Icon icon={Sun} size={14} className="ll:text-muted" />
              <span className="ll:text-micro ll:text-secondary ll:font-medium">Ambient Color</span>
            </div>
            <div className="ll:w-32">
              <ColorSwatchField
                hex={world.ambientColor ?? "#ffffff"}
                onChangeHex={(ac: string) => handleUpdateWorld("ambientColor", ac)}
                aria-label="Ambient Color"
                withPicker
              />
            </div>
          </div>

          {/* Ambient Strength / Intensity */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <div className="ll:flex ll:items-center ll:justify-between">
              <span className="ll:text-micro ll:text-secondary ll:font-medium">Ambient Strength</span>
              <span className="ll:text-micro ll:text-muted">
                {(world.ambientIntensity ?? 1.0).toFixed(2)}
              </span>
            </div>
            <Slider
              aria-label="Ambient Strength"
              value={world.ambientIntensity ?? 1.0}
              min={0}
              max={5}
              step={0.05}
              onChange={(ai) => handleUpdateWorld("ambientIntensity", ai)}
            />
          </div>

          {/* HDRI / Environment Lighting Intensity */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <div className="ll:flex ll:items-center ll:justify-between">
              <div className="ll:flex ll:items-center ll:gap-1.5">
                <Icon icon={ImageIcon} size={13} className="ll:text-muted" />
                <span className="ll:text-micro ll:text-secondary ll:font-medium">HDRI Strength</span>
              </div>
              <span className="ll:text-micro ll:text-muted">
                {(world.environmentIntensity ?? 1.0).toFixed(2)}
              </span>
            </div>
            <Slider
              aria-label="HDRI Strength"
              value={world.environmentIntensity ?? 1.0}
              min={0}
              max={5}
              step={0.05}
              onChange={(ei) => handleUpdateWorld("environmentIntensity", ei)}
            />
          </div>

          {/* Environment Rotation */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary">HDRI Rotation (°)</span>
            <div className="ll:w-28">
              <NumberField
                aria-label="HDRI Rotation"
                value={((world.environmentRotation ?? 0) * 180) / Math.PI}
                min={0}
                max={360}
                step={5}
                onChange={(deg) =>
                  handleUpdateWorld("environmentRotation", (deg * Math.PI) / 180)
                }
                size="sm"
              />
            </div>
          </div>
        </div>
      ) : (
        <FieldRenderer
          schema={World3dSchema}
          values={world as unknown as Record<string, unknown>}
          onChange={(field, val) => handleUpdateWorld(field, val)}
          excludeKeys={["id"]}
        />
      )}
    </div>
  );
};
