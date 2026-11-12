"use client";

/**
 * ============================================================================
 * MATERIAL PROPERTIES TAB (Phase 3D-022, 3D-023, 3D-033)
 * ============================================================================
 * Features:
 *   - Material slots list per object.
 *   - Shared user count badge ("Shared by X objects") & "Make single user" action.
 *   - Material Looks strip (Matte, Glossy plastic, Brushed metal, Glass, etc.).
 *   - Simple Face: 4-6 plain-word PBR controls (Base Color, Metallic, Roughness,
 *     Glow/Emissive, Opacity, Wireframe).
 *   - Pro Face: Exhaustive FieldRenderer for Material3dSchema.
 * ============================================================================
 */

import React, { useState } from "react";
import { Plus, Copy, Sparkles, Box } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { Slider } from "@/editor/components/Slider";
import { NumberField } from "@/editor/components/NumberField";
import { Toggle } from "@/editor/components/Toggle";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { useDocument } from "@/core/store/useDocumentStore";
import { tryRunCommand } from "@/core/commands";
import { userCount } from "@/core/document/dataBlocks";
import { Material3dSchema } from "@/core/document/scene3d";
import { LooksStrip } from "./LooksStrip";
import { FieldRenderer } from "./FieldRenderer";
import type { PropertiesFace } from "./propertiesFace";

export interface MaterialTabProps {
  objectId: string;
  face: PropertiesFace;
  className?: string;
}

export const MaterialTab: React.FC<MaterialTabProps> = ({
  objectId,
  face,
  className = "",
}) => {
  const doc = useDocument((d) => d);
  const obj = doc.objects?.[objectId];

  const [activeSlot, setActiveSlot] = useState(0);

  if (!obj) {
    return (
      <div className="ll:p-4 ll:text-micro ll:text-muted">
        No 3D object selected.
      </div>
    );
  }

  const materialSlots = obj.materialSlots ?? obj.materials ?? [];
  const activeMatId = materialSlots[activeSlot];
  const mat = activeMatId ? doc.materials?.[activeMatId] : undefined;

  // Shared user count
  const users = activeMatId ? userCount(doc, "material", activeMatId) : 0;

  const handleMakeSingleUser = () => {
    tryRunCommand("3d.material.make_single_user", {
      objectId,
      slot: activeSlot,
    });
  };

  const handleAddMaterialSlot = () => {
    tryRunCommand("3d.material.add", { objectId });
  };

  const handleUpdateMaterial = (field: string, val: unknown) => {
    if (!activeMatId) return;
    tryRunCommand("3d.material.set", {
      materialId: activeMatId,
      [field]: val,
    });
  };

  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-material">
      {/* Simple Face: Material Looks Strip */}
      {face === "simple" && (
        <LooksStrip
          section="material"
          targetId={objectId}
        />
      )}

      {/* Material Slots & Shared User Count Header */}
      <div className="ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:items-center ll:justify-between">
          <span className="ll:text-micro ll:font-semibold ll:text-primary">
            Material Slots ({materialSlots.length})
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddMaterialSlot}
            className="ll:flex ll:items-center ll:gap-1"
          >
            <Icon icon={Plus} size={13} />
            <span>New Slot</span>
          </Button>
        </div>

        {/* Slot selector chips */}
        {materialSlots.length > 0 ? (
          <div className="ll:flex ll:items-center ll:gap-1.5 ll:overflow-x-auto ll:pb-1">
            {materialSlots.map((slotMatId, idx) => {
              const slotMat = doc.materials?.[slotMatId];
              const isSelected = activeSlot === idx;

              return (
                <button
                  key={`${slotMatId}-${idx}`}
                  type="button"
                  onClick={() => setActiveSlot(idx)}
                  className={`ll:flex ll:items-center ll:gap-1.5 ll:px-2.5 ll:py-1 ll:rounded ll:text-micro ll:border ll:cursor-pointer ll:transition-all ${
                    isSelected
                      ? "ll:bg-accent/10 ll:border-accent ll:text-accent font-semibold"
                      : "ll:bg-surface-canvas ll:border-border ll:text-secondary ll:hover:bg-surface-hover"
                  }`}
                >
                  <span
                    className="ll:w-2.5 ll:h-2.5 ll:rounded-full ll:border ll:border-border/60"
                    style={{ backgroundColor: slotMat?.baseColor ?? "#ffffff" }}
                  />
                  <span>{slotMat?.name || `Material.${idx + 1}`}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="ll:p-3 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md ll:text-micro ll:text-muted ll:flex ll:items-center ll:justify-between">
            <span>No material assigned</span>
            <Button size="sm" variant="secondary" onClick={handleAddMaterialSlot}>
              Assign Material
            </Button>
          </div>
        )}

        {/* Shared user count badge & "Make Single User" */}
        {activeMatId && (
          <div className="ll:flex ll:items-center ll:justify-between ll:py-1 ll:px-1">
            <span
              data-testid="shared-user-count"
              className="ll:text-micro ll:text-muted ll:flex ll:items-center ll:gap-1"
            >
              <Icon icon={Box} size={12} />
              <span>{users <= 1 ? "Single user" : `Shared by ${users} objects`}</span>
            </span>

            {users > 1 && (
              <Button
                data-testid="make-single-user-button"
                size="sm"
                variant="secondary"
                onClick={handleMakeSingleUser}
                className="ll:flex ll:items-center ll:gap-1"
              >
                <Icon icon={Copy} size={12} />
                <span>Make Single User</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Material Fields */}
      {mat ? (
        face === "simple" ? (
          <div className="ll:flex ll:flex-col ll:gap-3.5 ll:pt-2 ll:border-t ll:border-border/40">
            {/* Base Color */}
            <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
              <span className="ll:text-micro ll:text-secondary ll:font-medium">Color</span>
              <div className="ll:w-32">
                <ColorSwatchField
                  hex={mat.baseColor}
                  onChangeHex={(c: string) => handleUpdateMaterial("baseColor", c)}
                  aria-label="Base Color"
                  withPicker
                />
              </div>
            </div>

            {/* Roughness */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Roughness</span>
                <span className="ll:text-micro ll:text-muted">{mat.roughness.toFixed(2)}</span>
              </div>
              <Slider
                aria-label="Roughness"
                value={mat.roughness}
                min={0}
                max={1}
                step={0.01}
                onChange={(r) => handleUpdateMaterial("roughness", r)}
              />
            </div>

            {/* Metallic */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Metallic</span>
                <span className="ll:text-micro ll:text-muted">{mat.metallic.toFixed(2)}</span>
              </div>
              <Slider
                aria-label="Metallic"
                value={mat.metallic}
                min={0}
                max={1}
                step={0.01}
                onChange={(m) => handleUpdateMaterial("metallic", m)}
              />
            </div>

            {/* Emissive / Glow */}
            <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
              <div className="ll:flex ll:items-center ll:gap-1.5">
                <Icon icon={Sparkles} size={13} className="ll:text-muted" />
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Glow Color</span>
              </div>
              <div className="ll:w-32">
                <ColorSwatchField
                  hex={mat.emissive}
                  onChangeHex={(em: string) => handleUpdateMaterial("emissive", em)}
                  aria-label="Glow Color"
                  withPicker
                />
              </div>
            </div>

            {/* Emissive Intensity */}
            <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
              <span className="ll:text-micro ll:text-secondary">Glow Intensity</span>
              <div className="ll:w-28">
                <NumberField
                  aria-label="Glow Intensity"
                  value={mat.emissiveIntensity ?? 0}
                  min={0}
                  step={0.1}
                  onChange={(ei) => handleUpdateMaterial("emissiveIntensity", ei)}
                  size="sm"
                />
              </div>
            </div>

            {/* Opacity */}
            <div className="ll:flex ll:flex-col ll:gap-1">
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Opacity</span>
                <span className="ll:text-micro ll:text-muted">
                  {((mat.opacity ?? 1.0) * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                aria-label="Opacity"
                value={mat.opacity ?? 1.0}
                min={0}
                max={1}
                step={0.01}
                onChange={(o) => handleUpdateMaterial("opacity", o)}
              />
            </div>

            {/* Wireframe */}
            <div className="ll:flex ll:items-center ll:justify-between ll:pt-1">
              <span className="ll:text-micro ll:text-secondary ll:font-medium">Wireframe</span>
              <Toggle
                aria-label="Wireframe"
                checked={Boolean(mat.wireframe)}
                onChange={(w) => handleUpdateMaterial("wireframe", w)}
                size="sm"
              />
            </div>
          </div>
        ) : (
          /* Pro Face: Exhaustive Material Schema */
          <FieldRenderer
            schema={Material3dSchema}
            values={mat as unknown as Record<string, unknown>}
            onChange={(field, val) => handleUpdateMaterial(field, val)}
            excludeKeys={["id"]}
          />
        )
      ) : null}
    </div>
  );
};
