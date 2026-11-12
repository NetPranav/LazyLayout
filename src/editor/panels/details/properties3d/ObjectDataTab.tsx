"use client";

/**
 * ============================================================================
 * OBJECT DATA PROPERTIES TAB (Phase 3D-022)
 * ============================================================================
 * Contextual object data editor depending on object.type:
 *   - Mesh: Vertex and face counts, procedural parameters from `mesh.source`.
 *   - Light: Light type, color, intensity/power, size/distance, spot angle.
 *   - Camera: Projection, FOV, near/far clipping, ortho scale.
 *   - Armature: Bone hierarchy tree.
 * ============================================================================
 */

import React from "react";
import { Bone, Box, Sun, Shield } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Toggle } from "@/editor/components/Toggle";
import { Slider } from "@/editor/components/Slider";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { useDocument } from "@/core/store/useDocumentStore";
import { tryRunCommand } from "@/core/commands";
import {
  Mesh3dSchema,
  Light3dSchema,
  Camera3dSchema,
} from "@/core/document/scene3d";
import { LooksStrip } from "./LooksStrip";
import { FieldRenderer } from "./FieldRenderer";
import type { PropertiesFace } from "./propertiesFace";

export interface ObjectDataTabProps {
  objectId: string;
  face: PropertiesFace;
  className?: string;
}

export const ObjectDataTab: React.FC<ObjectDataTabProps> = ({
  objectId,
  face,
  className = "",
}) => {
  const doc = useDocument((d) => d);
  const obj = doc.objects?.[objectId];

  if (!obj) {
    return (
      <div className="ll:p-4 ll:text-micro ll:text-muted">
        No 3D object selected.
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 1. MESH OBJECT DATA
  // ---------------------------------------------------------------------------
  if (obj.type === "mesh") {
    const mesh = obj.dataId ? doc.meshes?.[obj.dataId] : undefined;
    const vertexCount = mesh?.positions
      ? Math.floor(mesh.positions.length / 3)
      : mesh?.binary?.vertexCount ?? 0;
    const faceCount = mesh?.indices
      ? Math.floor(mesh.indices.length / 3)
      : mesh?.binary?.faceCount ?? 0;
    const procedural = mesh?.source;

    return (
      <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-object-data">
        {/* Topology Statistics */}
        <div className="ll:flex ll:items-center ll:justify-between ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
          <div className="ll:flex ll:items-center ll:gap-1.5">
            <Icon icon={Box} size={14} className="ll:text-secondary" />
            <span className="ll:text-micro ll:font-semibold ll:text-primary">
              Mesh Topology
            </span>
          </div>
          <div className="ll:flex ll:items-center ll:gap-3 ll:text-micro ll:font-mono ll:text-secondary">
            <span>Vertices: <strong className="ll:text-primary">{vertexCount}</strong></span>
            <span>Faces: <strong className="ll:text-primary">{faceCount}</strong></span>
          </div>
        </div>

        {/* Procedural Primitive Parameters */}
        {procedural && (
          <div className="ll:flex ll:flex-col ll:gap-2.5">
            <div className="ll:flex ll:items-center ll:justify-between">
              <span className="ll:text-micro ll:font-semibold ll:text-primary ll:capitalize">
                Primitive: {procedural.kind}
              </span>
              <span className="ll:text-micro ll:text-muted ll:text-[10px]">Parametric Source</span>
            </div>

            <div className="ll:flex ll:flex-col ll:gap-2">
              {Object.entries(procedural.params).map(([key, val]) => {
                if (typeof val === "number") {
                  return (
                    <div key={key} className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                      <span className="ll:text-micro ll:text-secondary ll:capitalize">
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                      <div className="ll:w-28">
                        <NumberField
                          aria-label={key}
                          value={val}
                          step={key.includes("segments") || key.includes("rings") ? 1 : 0.1}
                          min={key.includes("segments") ? 3 : 0.001}
                          onChange={(nextVal) => {
                            tryRunCommand("3d.primitive.set_param", {
                              objectId,
                              param: key,
                              value: nextVal,
                            });
                          }}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {face === "pro" && mesh && (
          <FieldRenderer
            schema={Mesh3dSchema}
            values={mesh as unknown as Record<string, unknown>}
            onChange={() => {}}
            excludeKeys={["id", "positions", "indices", "normals", "uvs", "binary"]}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. LIGHT OBJECT DATA
  // ---------------------------------------------------------------------------
  if (obj.type === "light") {
    const light = obj.dataId ? doc.lights?.[obj.dataId] : undefined;

    const handleUpdateLight = (field: string, val: unknown) => {
      if (!obj.dataId) return;
      tryRunCommand("3d.light.set", {
        lightId: obj.dataId,
        [field]: val,
      });
    };

    return (
      <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-object-data">
        {/* Simple Face: Light Rig Looks */}
        {face === "simple" && (
          <LooksStrip section="light" targetId={objectId} />
        )}

        {light ? (
          face === "simple" ? (
            <div className="ll:flex ll:flex-col ll:gap-3.5">
              {/* Light Type */}
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Type</span>
                <div className="ll:w-32">
                  <Select
                    aria-label="Light Type"
                    value={light.type}
                    onChange={(t) => handleUpdateLight("type", t)}
                    options={[
                      { value: "point", label: "Point" },
                      { value: "sun", label: "Sun" },
                      { value: "spot", label: "Spot" },
                      { value: "area", label: "Area" },
                    ]}
                    size="sm"
                  />
                </div>
              </div>

              {/* Light Color */}
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <div className="ll:flex ll:items-center ll:gap-1.5">
                  <Icon icon={Sun} size={14} className="ll:text-muted" />
                  <span className="ll:text-micro ll:text-secondary ll:font-medium">Color</span>
                </div>
                <div className="ll:w-32">
                  <ColorSwatchField
                    data-testid="light-color"
                    hex={light.color}
                    onChangeHex={(c: string) => handleUpdateLight("color", c)}
                    aria-label="Light Color"
                    withPicker
                  />
                </div>
              </div>

              {/* Power / Intensity */}
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Power</span>
                <div className="ll:w-28">
                  <NumberField
                    data-testid="light-power"
                    aria-label="Light Power"
                    value={light.intensity}
                    min={0}
                    step={10}
                    onChange={(val) => handleUpdateLight("intensity", val)}
                    size="sm"
                  />
                </div>
              </div>

              {/* Spot Angle (for Spot lights) */}
              {light.type === "spot" && (
                <div className="ll:flex ll:flex-col ll:gap-1">
                  <div className="ll:flex ll:items-center ll:justify-between">
                    <span className="ll:text-micro ll:text-secondary ll:font-medium">Spot Angle</span>
                    <span className="ll:text-micro ll:text-muted">
                      {(((light.spotAngle ?? 0.78) * 180) / Math.PI).toFixed(0)}°
                    </span>
                  </div>
                  <Slider
                    aria-label="Spot Angle"
                    value={light.spotAngle ?? 0.78}
                    min={0.1}
                    max={Math.PI / 2}
                    step={0.05}
                    onChange={(sa) => handleUpdateLight("spotAngle", sa)}
                  />
                </div>
              )}

              {/* Cast Shadows */}
              <div className="ll:flex ll:items-center ll:justify-between ll:pt-1">
                <div className="ll:flex ll:items-center ll:gap-1.5">
                  <Icon icon={Shield} size={13} className="ll:text-muted" />
                  <span className="ll:text-micro ll:text-secondary">Cast Shadows</span>
                </div>
                <Toggle
                  aria-label="Cast Shadows"
                  checked={light.castShadow !== false}
                  onChange={(cs) => handleUpdateLight("castShadow", cs)}
                  size="sm"
                />
              </div>
            </div>
          ) : (
            <FieldRenderer
              schema={Light3dSchema}
              values={light as unknown as Record<string, unknown>}
              onChange={(field, val) => handleUpdateLight(field, val)}
              excludeKeys={["id"]}
            />
          )
        ) : (
          <div className="ll:text-micro ll:text-muted">No light data block found.</div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. CAMERA OBJECT DATA
  // ---------------------------------------------------------------------------
  if (obj.type === "camera") {
    const cam = obj.dataId ? doc.cameras?.[obj.dataId] : undefined;

    const handleUpdateCamera = (field: string, val: unknown) => {
      if (!obj.dataId) return;
      tryRunCommand("3d.camera.set", {
        cameraId: obj.dataId,
        [field]: val,
      });
    };

    return (
      <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-object-data">
        {cam ? (
          face === "simple" ? (
            <div className="ll:flex ll:flex-col ll:gap-3.5">
              {/* Projection */}
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:font-medium">Projection</span>
                <div className="ll:w-36">
                  <Select
                    aria-label="Camera Projection"
                    value={cam.type}
                    onChange={(p) => handleUpdateCamera("type", p)}
                    options={[
                      { value: "perspective", label: "Perspective" },
                      { value: "orthographic", label: "Orthographic" },
                    ]}
                    size="sm"
                  />
                </div>
              </div>

              {/* Field of View (FOV) */}
              {cam.type === "perspective" && (
                <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                  <span className="ll:text-micro ll:text-secondary ll:font-medium">FOV (°)</span>
                  <div className="ll:w-28">
                    <NumberField
                      aria-label="Field of View"
                      value={cam.fov}
                      min={10}
                      max={120}
                      step={1}
                      onChange={(f) => handleUpdateCamera("fov", f)}
                      size="sm"
                    />
                  </div>
                </div>
              )}

              {/* Orthographic Scale */}
              {cam.type === "orthographic" && (
                <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                  <span className="ll:text-micro ll:text-secondary ll:font-medium">Ortho Scale</span>
                  <div className="ll:w-28">
                    <NumberField
                      aria-label="Orthographic Scale"
                      value={cam.orthoScale ?? 6}
                      min={0.1}
                      step={0.5}
                      onChange={(s) => handleUpdateCamera("orthoScale", s)}
                      size="sm"
                    />
                  </div>
                </div>
              )}

              {/* Clipping Planes (Near / Far) */}
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary">Clip Near (m)</span>
                <div className="ll:w-28">
                  <NumberField
                    aria-label="Clip Near"
                    value={cam.near}
                    min={0.001}
                    step={0.1}
                    onChange={(n) => handleUpdateCamera("near", n)}
                    size="sm"
                  />
                </div>
              </div>

              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary">Clip Far (m)</span>
                <div className="ll:w-28">
                  <NumberField
                    aria-label="Clip Far"
                    value={cam.far}
                    min={1}
                    step={100}
                    onChange={(f) => handleUpdateCamera("far", f)}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          ) : (
            <FieldRenderer
              schema={Camera3dSchema}
              values={cam as unknown as Record<string, unknown>}
              onChange={(field, val) => handleUpdateCamera(field, val)}
              excludeKeys={["id"]}
            />
          )
        ) : (
          <div className="ll:text-micro ll:text-muted">No camera data block found.</div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. ARMATURE OBJECT DATA
  // ---------------------------------------------------------------------------
  if (obj.type === "armature") {
    const arm = obj.dataId ? doc.armatures?.[obj.dataId] : undefined;
    const bones = arm?.bones ?? [];

    return (
      <div className={`ll:flex ll:flex-col ll:gap-4 ${className}`} data-testid="tab-object-data">
        <div className="ll:flex ll:items-center ll:justify-between ll:p-2.5 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
          <div className="ll:flex ll:items-center ll:gap-1.5">
            <Icon icon={Bone} size={14} className="ll:text-secondary" />
            <span className="ll:text-micro ll:font-semibold ll:text-primary">
              Armature Bones ({bones.length})
            </span>
          </div>
        </div>

        <div className="ll:flex ll:flex-col ll:gap-1.5">
          {bones.map((bone) => (
            <div
              key={bone.id}
              className="ll:flex ll:items-center ll:justify-between ll:p-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded"
            >
              <span className="ll:text-micro ll:font-medium ll:text-primary">{bone.name}</span>
              <span className="ll:text-micro ll:text-muted ll:font-mono">
                [{bone.head.map((v) => v.toFixed(1)).join(", ")}]
              </span>
            </div>
          ))}
          {bones.length === 0 && (
            <div className="ll:p-3 ll:text-micro ll:text-muted ll:text-center">
              No bones in armature.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. EMPTY OBJECT
  // ---------------------------------------------------------------------------
  return (
    <div className={`ll:p-4 ll:text-micro ll:text-muted ${className}`} data-testid="tab-object-data">
      Empty object has no geometric data block.
    </div>
  );
};
