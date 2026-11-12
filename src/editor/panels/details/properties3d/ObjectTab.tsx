"use client";

/**
 * ============================================================================
 * OBJECT PROPERTIES TAB (Phase 3D-022)
 * ============================================================================
 * Simple Face:
 *   - Object Name
 *   - Location (X, Y, Z)
 *   - Rotation (Euler shown in degrees, quaternion stored)
 *   - Scale (X, Y, Z)
 *   - Hierarchy Parent selection
 *   - Viewport and Render visibility toggles
 * Pro Face:
 *   - Generic schema-driven field renderer for Object3dSchema
 * ============================================================================
 */

import React, { useMemo } from "react";
import { Eye, EyeOff, Video } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { TextField } from "@/editor/components/TextField";
import { Select } from "@/editor/components/Select";
import { Toggle } from "@/editor/components/Toggle";
import { useDocument } from "@/core/store/useDocumentStore";
import { tryRunCommand } from "@/core/commands";
import { eulerFromQuat, quatFromEuler, type EulerOrder } from "@/core/3d/math";
import { Object3dSchema } from "@/core/document/scene3d";
import { FieldRenderer } from "./FieldRenderer";
import type { PropertiesFace } from "./propertiesFace";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface ObjectTabProps {
  objectId: string;
  face: PropertiesFace;
  className?: string;
}

export const ObjectTab: React.FC<ObjectTabProps> = ({
  objectId,
  face,
  className = "",
}) => {
  const doc = useDocument((d) => d);
  const obj = doc.objects?.[objectId];

  // Euler angles in degrees derived from stored Quaternion
  const eulerDeg = useMemo(() => {
    const q = obj?.transform?.rotationQuat ?? [0, 0, 0, 1];
    const rad = eulerFromQuat("XYZ" as EulerOrder, q);
    return [
      Math.round(rad[0] * RAD_TO_DEG * 10) / 10,
      Math.round(rad[1] * RAD_TO_DEG * 10) / 10,
      Math.round(rad[2] * RAD_TO_DEG * 10) / 10,
    ] as [number, number, number];
  }, [obj?.transform?.rotationQuat]);

  if (!obj) {
    return (
      <div className="ll:p-4 ll:text-micro ll:text-muted">
        No 3D object selected.
      </div>
    );
  }

  // Handle Location changes
  const handleLocationChange = (axisIndex: number, val: number) => {
    const loc: [number, number, number] = [...obj.transform.location];
    loc[axisIndex] = val;
    tryRunCommand("3d.object.set_location", { objectId, location: loc });
  };

  // Handle Rotation (Euler in degrees -> Quat)
  const handleRotationChange = (axisIndex: number, degVal: number) => {
    const nextDeg: [number, number, number] = [...eulerDeg];
    nextDeg[axisIndex] = degVal;
    const rad: [number, number, number] = [
      nextDeg[0] * DEG_TO_RAD,
      nextDeg[1] * DEG_TO_RAD,
      nextDeg[2] * DEG_TO_RAD,
    ];
    const quat = quatFromEuler("XYZ" as EulerOrder, rad[0], rad[1], rad[2]);
    tryRunCommand("3d.object.set_rotation", {
      objectId,
      rotationQuat: [quat[0], quat[1], quat[2], quat[3]],
    });
  };

  // Handle Scale changes
  const handleScaleChange = (axisIndex: number, val: number) => {
    const scl: [number, number, number] = [...obj.transform.scale];
    scl[axisIndex] = Math.max(1e-4, val);
    tryRunCommand("3d.object.set_scale", { objectId, scale: scl });
  };

  // Other objects candidate for parent
  const parentOptions = [
    { value: "none", label: "None (Root)" },
    ...Object.values(doc.objects ?? {})
      .filter((o) => o.id !== objectId)
      .map((o) => ({ value: o.id, label: o.name ?? o.id })),
  ];

  return (
    <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-object">
      {face === "simple" ? (
        <div className="ll:flex ll:flex-col ll:gap-3.5">
          {/* Object Name */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:font-medium">Name</span>
            <div className="ll:w-36">
              <TextField
                aria-label="Object Name"
                value={obj.name ?? ""}
                onChange={(e) => {
                  tryRunCommand("3d.object.rename", {
                    objectId,
                    name: e.target.value,
                  });
                }}
                size="sm"
              />
            </div>
          </div>

          {/* Location X, Y, Z */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary ll:font-medium">Location</span>
            <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <NumberField
                  key={axis}
                  label={axis}
                  data-testid={`prop-location-${axis.toLowerCase()}`}
                  aria-label={`Location ${axis}`}
                  value={obj.transform.location[i] ?? 0}
                  step={0.1}
                  onChange={(val) => handleLocationChange(i, val)}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Rotation Euler X, Y, Z (degrees) */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <div className="ll:flex ll:items-center ll:justify-between">
              <span className="ll:text-micro ll:text-secondary ll:font-medium">Rotation</span>
              <span className="ll:text-micro ll:text-muted ll:text-[10px]">XYZ Euler (°)</span>
            </div>
            <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <NumberField
                  key={axis}
                  label={axis}
                  data-testid={`prop-rotation-${axis.toLowerCase()}`}
                  aria-label={`Rotation ${axis}`}
                  value={eulerDeg[i]}
                  step={5}
                  onChange={(val) => handleRotationChange(i, val)}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Scale X, Y, Z */}
          <div className="ll:flex ll:flex-col ll:gap-1">
            <span className="ll:text-micro ll:text-secondary ll:font-medium">Scale</span>
            <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
              {(["X", "Y", "Z"] as const).map((axis, i) => (
                <NumberField
                  key={axis}
                  label={axis}
                  data-testid={`prop-scale-${axis.toLowerCase()}`}
                  aria-label={`Scale ${axis}`}
                  value={obj.transform.scale[i] ?? 1}
                  step={0.1}
                  min={0.001}
                  onChange={(val) => handleScaleChange(i, val)}
                  size="sm"
                />
              ))}
            </div>
          </div>

          {/* Parent Selection */}
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-micro ll:text-secondary ll:font-medium">Parent</span>
            <div className="ll:w-36">
              <Select
                aria-label="Parent Object"
                value={obj.parentId ?? "none"}
                onChange={(val) => {
                  if (val === "none") {
                    tryRunCommand("3d.object.unparent", { objectId });
                  } else {
                    tryRunCommand("3d.object.parent", {
                      childId: objectId,
                      parentId: val,
                    });
                  }
                }}
                options={parentOptions}
                size="sm"
              />
            </div>
          </div>

          {/* Visibility Controls */}
          <div className="ll:flex ll:items-center ll:justify-between ll:pt-1 ll:border-t ll:border-border/40">
            <div className="ll:flex ll:items-center ll:gap-1.5">
              <Icon
                icon={obj.visible !== false ? Eye : EyeOff}
                size={14}
                className="ll:text-muted"
              />
              <span className="ll:text-micro ll:text-secondary">Viewport Visibility</span>
            </div>
            <Toggle
              aria-label="Toggle Viewport Visibility"
              checked={obj.visible !== false}
              onChange={(v) => {
                tryRunCommand("3d.object.set_visibility", {
                  objectId,
                  visible: v,
                });
              }}
              size="sm"
            />
          </div>

          <div className="ll:flex ll:items-center ll:justify-between">
            <div className="ll:flex ll:items-center ll:gap-1.5">
              <Icon icon={Video} size={14} className="ll:text-muted" />
              <span className="ll:text-micro ll:text-secondary">Render Visibility</span>
            </div>
            <Toggle
              aria-label="Toggle Render Visibility"
              checked={obj.renderVisible !== false}
              onChange={(rv) => {
                tryRunCommand("3d.object.set_visibility", {
                  objectId,
                  renderVisible: rv,
                });
              }}
              size="sm"
            />
          </div>
        </div>
      ) : (
        /* Pro Face: Exhaustive Field Renderer */
        <FieldRenderer
          schema={Object3dSchema}
          values={obj as unknown as Record<string, unknown>}
          onChange={(key, val) => {
            if (key === "name" && typeof val === "string") {
              tryRunCommand("3d.object.rename", { objectId, name: val });
            } else if (key === "visible" && typeof val === "boolean") {
              tryRunCommand("3d.object.set_visibility", { objectId, visible: val });
            } else if (key === "renderVisible" && typeof val === "boolean") {
              tryRunCommand("3d.object.set_visibility", { objectId, renderVisible: val });
            }
          }}
          excludeKeys={["id", "modifiers", "type", "transform", "delta", "parentInverse"]}
        />
      )}
    </div>
  );
};
