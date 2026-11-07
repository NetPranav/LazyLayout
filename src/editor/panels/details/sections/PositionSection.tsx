"use client";

import React from "react";
import { RotateCw } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Button } from "@/editor/components/Button";
import { formatPin } from "@/core/geometry/cornerPin";
import { defaultMesh, formatMesh, parseMesh } from "@/core/geometry/meshWarp";
import { AlignBar } from "../controls/AlignBar";
import {
  INSPECTOR_CONSTANTS,
  POSITION_TYPE_OPTIONS,
  TRANSFORM_ORIGIN_OPTIONS,
} from "../constants";
import type { InspectorSectionProps } from "../types";
import type { AlignMode, SpreadAxis } from "@/core/geometry/align";

export interface PositionSectionProps extends InspectorSectionProps {
  onAlign?: (mode: AlignMode) => void;
  onDistribute?: (axis: SpreadAxis) => void;
  onTidy?: () => void;
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  isMulti = false,
  getValue,
  onUpdateProp,
  onAlign,
  onDistribute,
  onTidy,
  className = "",
}) => {
  // Read coordinates
  const rawX = getValue?.("frame.x") ?? getValue?.("x");
  const rawY = getValue?.("frame.y") ?? getValue?.("y");
  const rawRot = getValue?.("frame.rotation") ?? getValue?.("rotation");

  const xVal = typeof rawX === "number" ? rawX : rawX === null ? null : INSPECTOR_CONSTANTS.DEFAULT_POS_X;
  const yVal = typeof rawY === "number" ? rawY : rawY === null ? null : INSPECTOR_CONSTANTS.DEFAULT_POS_Y;
  const rotVal = typeof rawRot === "number" ? rawRot : rawRot === null ? null : INSPECTOR_CONSTANTS.DEFAULT_ROTATION;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      {/* Alignment Bar */}
      <AlignBar
        isMulti={isMulti}
        onAlign={onAlign}
        onDistribute={onDistribute}
        onTidy={onTidy}
      />

      {/* Main Coordinate Grid: X, Y, Rotation */}
      <div className="ll:grid ll:grid-cols-3 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="X"
          value={xVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("frame.x", v);
            onUpdateProp?.("x", v);
          }}
        />

        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Y"
          value={yVal}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(v) => {
            onUpdateProp?.("frame.y", v);
            onUpdateProp?.("y", v);
          }}
        />

        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label={<Icon icon={RotateCw} size={14} />}
          aria-label="Rotation"
          value={rotVal}
          suffix="°"
          step={INSPECTOR_CONSTANTS.STEP_ROTATION}
          onChange={(v) => {
            onUpdateProp?.("frame.rotation", v);
            onUpdateProp?.("rotation", v);
          }}
        />
      </div>
    </div>
  );
};

export const PositionMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  // Read advanced transform properties
  const posType = (getValue?.("layout.position") as string) || "static";
  const zIndex = (getValue?.("layout.zIndex") as number) ?? 0;
  const scaleX = (getValue?.("transform.scaleX") as number) ?? 1;
  const scaleY = (getValue?.("transform.scaleY") as number) ?? 1;
  const skewX = (getValue?.("transform.skewX") as number) ?? 0;
  const skewY = (getValue?.("transform.skewY") as number) ?? 0;
  const rotX = (getValue?.("transform.rotateX") as number) ?? 0;
  const rotY = (getValue?.("transform.rotateY") as number) ?? 0;
  const perspective = (getValue?.("transform.perspective") as number) ?? 0;
  const translateZ = (getValue?.("transform.translateZ") as number) ?? 0;
  const style3d = (getValue?.("transform.style3d") as string) || "flat";
  const origin = (getValue?.("transform.origin") as string) || "center";
  const role = (getValue?.("render.role") as string) || "content";

  // Offset values when position is relative/absolute/fixed/sticky
  const offTop = (getValue?.("layout.top") as number) ?? 0;
  const offRight = (getValue?.("layout.right") as number) ?? 0;
  const offBottom = (getValue?.("layout.bottom") as number) ?? 0;
  const offLeft = (getValue?.("layout.left") as number) ?? 0;

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {/* Position Type & Z-Index */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <Select
          size="sm"
          label="Position"
          aria-label="Position type"
          value={posType}
          options={POSITION_TYPE_OPTIONS}
          onChange={(val) => onUpdateProp?.("layout.position", val)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Z"
          value={zIndex}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("layout.zIndex", val)}
        />
      </div>

      {/* Offset 4-grid (shown when position type !== 'static') */}
      {posType !== "static" && (
        <div className="ll:flex ll:flex-col ll:gap-1">
          <span className="ll:text-small ll:font-sans ll:text-muted">
            Offset
          </span>
          <div className="ll:grid ll:grid-cols-4 ll:gap-1.5">
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="T"
              aria-label="Offset Top"
              value={offTop}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.top", val)}
            />
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="R"
              aria-label="Offset Right"
              value={offRight}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.right", val)}
            />
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="B"
              aria-label="Offset Bottom"
              value={offBottom}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.bottom", val)}
            />
            <NumberField
              size="sm"
              className="ll:*:!text-micro ll:!gap-2"
              label="L"
              aria-label="Offset Left"
              value={offLeft}
              step={INSPECTOR_CONSTANTS.STEP_INTEGER}
              onChange={(val) => onUpdateProp?.("layout.left", val)}
            />
          </div>
        </div>
      )}

      {/* Scale X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Scale X"
          title="Scale X: stretches the layer sideways. 1 is normal size, 2 is twice as wide."
          value={scaleX}
          step={INSPECTOR_CONSTANTS.STEP_FINE}
          precision={2}
          onChange={(val) => onUpdateProp?.("transform.scaleX", val)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Scale Y"
          title="Scale Y: stretches the layer up and down. 1 is normal size."
          value={scaleY}
          step={INSPECTOR_CONSTANTS.STEP_FINE}
          precision={2}
          onChange={(val) => onUpdateProp?.("transform.scaleY", val)}
        />
      </div>

      {/* Skew X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Skew X"
          title="Skew X: slants the layer sideways, like italics."
          suffix="°"
          value={skewX}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.skewX", val)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Skew Y"
          title="Skew Y: slants the layer up and down."
          suffix="°"
          value={skewY}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.skewY", val)}
        />
      </div>

      {/* 3D Rotate X & Y */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Rot X"
          suffix="°"
          value={rotX}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.rotateX", val)}
        />
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Rot Y"
          suffix="°"
          value={rotY}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.rotateY", val)}
        />
      </div>

      <NumberField
        size="sm"
        className="ll:*:!text-micro ll:!gap-2"
        label="Perspective"
        aria-label="Perspective"
        title="3D depth in px. Set it (try 600), then tilt with Rot X: the layer recedes and shrinks into the distance like text lying on a road. Rotation then turns it along the road. 0 is flat."
        suffix="px"
        value={perspective}
        step={50}
        onChange={(val) => onUpdateProp?.("transform.perspective", Math.max(0, val))}
      />

      {/* 3D Depth & Space */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2">
        <NumberField
          size="sm"
          className="ll:*:!text-micro ll:!gap-2"
          label="Translate Z"
          aria-label="Translate Z"
          title="Distance along the Z axis in px. Negative moves back into depth."
          suffix="px"
          value={translateZ}
          step={INSPECTOR_CONSTANTS.STEP_INTEGER}
          onChange={(val) => onUpdateProp?.("transform.translateZ", val)}
        />
        <Select
          size="sm"
          label="3D Space"
          aria-label="3D Space"
          title="Preserve 3D keeps children in the same shared 3D perspective context."
          value={style3d}
          options={[
            { value: "flat", label: "Flat" },
            { value: "preserve3d", label: "Preserve 3D" },
          ]}
          onChange={(val) => onUpdateProp?.("transform.style3d", val)}
        />
      </div>

      {/* Corner pin: lay the layer on a surface (a road, a wall) by dragging its four corners */}
      {(() => {
        const pinned = typeof getValue?.("transform.pin") === "string" && getValue?.("transform.pin") !== "";
        const x = Number(getValue?.("frame.x") ?? 0);
        const y = Number(getValue?.("frame.y") ?? 0);
        const w = Number(getValue?.("frame.width") ?? 0);
        const h = Number(getValue?.("frame.height") ?? 0);
        const flat = formatPin([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
        return (
          <div className="ll:flex ll:flex-col ll:gap-1">
            <div className="ll:flex ll:gap-1">
              <Button
                size="sm"
                aria-label={pinned ? "Reset corner pin" : "Pin corners"}
                disabled={w <= 0 || h <= 0}
                title="Puts four handles on the layer's corners and a grid on the surface. Drag each handle onto a corner of the road, wall or screen the layer should lie on."
                onClick={() => onUpdateProp?.("transform.pin", flat)}
              >
                {pinned ? "Reset pin" : "Pin corners"}
              </Button>
              {pinned && (
                <Button size="sm" aria-label="Remove corner pin" onClick={() => onUpdateProp?.("transform.pin", "")}>
                  Remove pin
                </Button>
              )}
            </div>
            <span className="ll:text-micro ll:font-sans ll:text-muted">Lay it on a surface: drag the four handles onto its corners.</span>
          </div>
        );
      })()}

      {/* Warp mesh: multi-point grid for bending text and images along a curve or surface */}
      {(() => {
        const meshVal = getValue?.("transform.mesh");
        const mesh = parseMesh(meshVal);
        const hasMesh = mesh !== null;
        const x = Number(getValue?.("frame.x") ?? 0);
        const y = Number(getValue?.("frame.y") ?? 0);
        const w = Number(getValue?.("frame.width") ?? 0);
        const h = Number(getValue?.("frame.height") ?? 0);
        const currentGrid = mesh ? `${mesh.cols}x${mesh.rows}` : "3x3";
        const gridOptions = [
          { value: "3x3", label: "3×3" },
          { value: "4x4", label: "4×4" },
          { value: "5x5", label: "5×5" },
        ];

        return (
          <div className="ll:flex ll:flex-col ll:gap-1">
            <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:items-end">
              <Select
                size="sm"
                label="Mesh grid"
                aria-label="Mesh grid size"
                value={currentGrid}
                options={gridOptions}
                onChange={(val) => {
                  const [c, r] = val.split("x").map(Number);
                  onUpdateProp?.("transform.mesh", formatMesh(defaultMesh(x, y, w, h, c, r)));
                }}
              />
              <div className="ll:flex ll:gap-1">
                {!hasMesh ? (
                  <Button
                    size="sm"
                    aria-label="Warp mesh"
                    disabled={w <= 0 || h <= 0}
                    title="Creates a multi-point mesh grid across the layer to bend it along curves and surfaces."
                    onClick={() => {
                      const [c, r] = currentGrid.split("x").map(Number);
                      onUpdateProp?.("transform.mesh", formatMesh(defaultMesh(x, y, w, h, c, r)));
                    }}
                  >
                    Warp mesh
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      aria-label="Reset warp mesh"
                      title="Resets mesh control points to a flat grid."
                      onClick={() => onUpdateProp?.("transform.mesh", formatMesh(defaultMesh(x, y, w, h, mesh.cols, mesh.rows)))}
                    >
                      Reset mesh
                    </Button>
                    <Button
                      size="sm"
                      aria-label="Remove warp mesh"
                      title="Removes the warp mesh and restores the plain layer."
                      onClick={() => onUpdateProp?.("transform.mesh", "")}
                    >
                      Remove mesh
                    </Button>
                  </>
                )}
              </div>
            </div>
            <span className="ll:text-micro ll:font-sans ll:text-muted">
              Bend along a curve: drag control points to warp. Shift-drag moves row.
            </span>
          </div>
        );
      })()}

      {/* Transform Origin */}
      <Select
        size="sm"
        label="Origin"
        aria-label="Transform origin"
        title="The point rotation, scale and skew turn around."
        value={origin}
        options={TRANSFORM_ORIGIN_OPTIONS}
        onChange={(val) => onUpdateProp?.("transform.origin", val)}
      />

      {/* Render Role (Phase 73: Content vs Helper / Null) */}
      <Select
        size="sm"
        label="Role"
        aria-label="Render role"
        title="A helper layer is an invisible null driver; drawn dashed in Design mode, never rendered in Preview or export."
        value={role}
        options={[
          { value: "content", label: "Content" },
          { value: "helper", label: "Helper (Null)" },
        ]}
        onChange={(val) => onUpdateProp?.("render.role", val)}
      />
    </div>
  );
};
