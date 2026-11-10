"use client";

import React from "react";
import { ColorSwatch } from "../controls/ColorSwatch";
import { NumberField } from "@/editor/components/NumberField";
import { Select } from "@/editor/components/Select";
import { Checkbox } from "@/editor/components/Checkbox";
import type { InspectorSectionProps } from "../types";

export const GEOMETRY_OPTIONS = [
  { value: "Box", label: "Box" },
  { value: "Sphere", label: "Sphere" },
  { value: "Plane", label: "Plane" },
  { value: "Model", label: "Model" },
] as const;

export const CAMERA_OPTIONS = [
  { value: "Perspective", label: "Perspective" },
  { value: "Orthographic", label: "Orthographic" },
] as const;

export const LIGHT_OPTIONS = [
  { value: "Point", label: "Point" },
  { value: "Directional", label: "Directional" },
  { value: "Ambient", label: "Ambient" },
] as const;

export const Object3DSection: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
  className = "",
}) => {
  const geometry = (getValue?.("object3d.geometry") as string) || "Box";
  const materialColor = (getValue?.("object3d.materialColor") as string) || "C8C8C8";
  const metalness = (getValue?.("object3d.metalness") as number) ?? 0.2;
  const roughness = (getValue?.("object3d.roughness") as number) ?? 0.6;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`}>
      <Select
        size="sm"
        aria-label="Geometry"
        value={geometry}
        options={GEOMETRY_OPTIONS}
        onChange={(v) => onUpdateProp?.("object3d.geometry", v)}
      />

      {/* Material Color */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
          <ColorSwatch label="Material colour picker" hex={materialColor} onChange={(h) => onUpdateProp?.("object3d.materialColor", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
          <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
            <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
            <input
              type="text"
              maxLength={6}
              aria-label="Material hex"
              value={materialColor}
              onChange={(e) =>
                onUpdateProp?.(
                  "object3d.materialColor",
                  e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                )
              }
              className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
            />
          </div>
        </div>
        <span className="ll-dsub ll:text-micro ll:font-sans ll:text-muted ll:shrink-0">
          Material
        </span>
      </div>

      {/* Metalness & Roughness */}
      <div className="ll:grid ll:grid-cols-2 ll:gap-2 ll:w-full">
        <NumberField
          size="sm"
          label="Metal"
          aria-label="Metalness"
          value={metalness}
          step={0.1}
          precision={2}
          onChange={(v) => onUpdateProp?.("object3d.metalness", v)}
        />
        <NumberField
          size="sm"
          label="Rough"
          aria-label="Roughness"
          value={roughness}
          step={0.1}
          precision={2}
          onChange={(v) => onUpdateProp?.("object3d.roughness", v)}
        />
      </div>
    </div>
  );
};

export const Object3DMore: React.FC<InspectorSectionProps> = ({
  getValue,
  onUpdateProp,
}) => {
  const posX = (getValue?.("object3d.posX") as number) ?? 0;
  const posY = (getValue?.("object3d.posY") as number) ?? 0;
  const posZ = (getValue?.("object3d.posZ") as number) ?? 0;

  const rotX = (getValue?.("object3d.rotX") as number) ?? 0;
  const rotY = (getValue?.("object3d.rotY") as number) ?? 0;
  const rotZ = (getValue?.("object3d.rotZ") as number) ?? 0;

  const scaleX = (getValue?.("object3d.scaleX") as number) ?? 1;
  const scaleY = (getValue?.("object3d.scaleY") as number) ?? 1;
  const scaleZ = (getValue?.("object3d.scaleZ") as number) ?? 1;

  const emissiveHex = (getValue?.("object3d.emissive") as string) || "000000";
  const emissiveIntensity = (getValue?.("object3d.emissiveIntensity") as number) ?? 0;

  const wireframe = (getValue?.("object3d.wireframe") as boolean) || false;
  const transparent = (getValue?.("object3d.transparent") as boolean) || false;
  const castShadow = (getValue?.("object3d.castShadow") as boolean) ?? true;
  const receiveShadow = (getValue?.("object3d.receiveShadow") as boolean) ?? true;

  const camera = (getValue?.("object3d.camera") as string) || "Perspective";
  const fov = (getValue?.("object3d.fov") as number) ?? 50;

  const light = (getValue?.("object3d.light") as string) || "Point";
  const lightColor = (getValue?.("object3d.lightColor") as string) || "FFFFFF";
  const lightIntensity = (getValue?.("object3d.lightIntensity") as number) ?? 1;

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:w-full">
      {/* 3D Position */}
      <div className="ll:flex ll:flex-col ll:gap-1">
        <span className="ll:text-small ll:font-sans ll:text-muted">Position</span>
        <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
          <NumberField
            size="sm"
            label="X"
            aria-label="Position X"
            value={posX}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.posX", v)}
          />
          <NumberField
            size="sm"
            label="Y"
            aria-label="Position Y"
            value={posY}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.posY", v)}
          />
          <NumberField
            size="sm"
            label="Z"
            aria-label="Position Z"
            value={posZ}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.posZ", v)}
          />
        </div>
      </div>

      {/* 3D Rotation */}
      <div className="ll:flex ll:flex-col ll:gap-1">
        <span className="ll:text-small ll:font-sans ll:text-muted">Rotation</span>
        <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
          <NumberField
            size="sm"
            label="X"
            aria-label="Rotation X"
            suffix="°"
            value={rotX}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.rotX", v)}
          />
          <NumberField
            size="sm"
            label="Y"
            aria-label="Rotation Y"
            suffix="°"
            value={rotY}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.rotY", v)}
          />
          <NumberField
            size="sm"
            label="Z"
            aria-label="Rotation Z"
            suffix="°"
            value={rotZ}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.rotZ", v)}
          />
        </div>
      </div>

      {/* 3D Scale */}
      <div className="ll:flex ll:flex-col ll:gap-1">
        <span className="ll:text-small ll:font-sans ll:text-muted">Scale</span>
        <div className="ll:grid ll:grid-cols-3 ll:gap-1.5">
          <NumberField
            size="sm"
            label="X"
            aria-label="Scale X"
            value={scaleX}
            step={0.1}
            precision={2}
            onChange={(v) => onUpdateProp?.("object3d.scaleX", v)}
          />
          <NumberField
            size="sm"
            label="Y"
            aria-label="Scale Y"
            value={scaleY}
            step={0.1}
            precision={2}
            onChange={(v) => onUpdateProp?.("object3d.scaleY", v)}
          />
          <NumberField
            size="sm"
            label="Z"
            aria-label="Scale Z"
            value={scaleZ}
            step={0.1}
            precision={2}
            onChange={(v) => onUpdateProp?.("object3d.scaleZ", v)}
          />
        </div>
      </div>

      {/* Emissive */}
      <div className="ll:pt-2 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
        <div className="ll:flex ll:items-center ll:gap-2 ll:w-full">
          <div className="ll:flex ll:items-center ll:gap-1.5 ll:flex-1 ll:min-w-0">
            <ColorSwatch label="Emissive colour picker" hex={emissiveHex} onChange={(h) => onUpdateProp?.("object3d.emissive", h)} className="ll-dsw ll:w-7 ll:h-7 ll:rounded-sm ll:border ll:border-border ll:shrink-0" />
            <div className="ll-dfield ll:flex ll:items-center ll:gap-1 ll:flex-1 ll:min-w-0 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-border-active ll:rounded-sm">
              <span className="ll:font-mono ll:text-micro ll:text-muted ll:select-none">#</span>
              <input
                type="text"
                maxLength={6}
                aria-label="Emissive hex"
                value={emissiveHex}
                onChange={(e) =>
                  onUpdateProp?.(
                    "object3d.emissive",
                    e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
                  )
                }
                className="ll:w-full ll:min-w-0 ll:bg-transparent ll:border-0 ll:p-0 ll:font-mono ll:text-micro ll:text-primary ll:outline-none"
              />
            </div>
          </div>
          <NumberField
            size="sm"
            label="Int"
            aria-label="Emissive intensity"
            value={emissiveIntensity}
            step={0.1}
            precision={1}
            onChange={(v) => onUpdateProp?.("object3d.emissiveIntensity", v)}
          />
        </div>
      </div>

      {/* Flags */}
      <div className="ll:pt-2 ll:border-t ll:border-border ll:grid ll:grid-cols-2 ll:gap-1.5">
        <Checkbox
          label="Wireframe"
          checked={wireframe}
          onChange={(v) => onUpdateProp?.("object3d.wireframe", v)}
        />
        <Checkbox
          label="Transparent"
          checked={transparent}
          onChange={(v) => onUpdateProp?.("object3d.transparent", v)}
        />
        <Checkbox
          label="Cast shadow"
          checked={castShadow}
          onChange={(v) => onUpdateProp?.("object3d.castShadow", v)}
        />
        <Checkbox
          label="Receive shadow"
          checked={receiveShadow}
          onChange={(v) => onUpdateProp?.("object3d.receiveShadow", v)}
        />
      </div>

      {/* Camera & Light */}
      <div className="ll:pt-2 ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2">
        <div className="ll:grid ll:grid-cols-2 ll:gap-2">
          <Select
            size="sm"
            label="Camera"
            aria-label="Camera"
            value={camera}
            options={CAMERA_OPTIONS}
            onChange={(v) => onUpdateProp?.("object3d.camera", v)}
          />
          <NumberField
            size="sm"
            label="FOV"
            aria-label="Field of view"
            suffix="°"
            value={fov}
            step={1}
            onChange={(v) => onUpdateProp?.("object3d.fov", v)}
          />
        </div>

        <div className="ll:grid ll:grid-cols-2 ll:gap-2">
          <Select
            size="sm"
            label="Light"
            aria-label="Light"
            value={light}
            options={LIGHT_OPTIONS}
            onChange={(v) => onUpdateProp?.("object3d.light", v)}
          />
          <NumberField
            size="sm"
            label="Int"
            aria-label="Light intensity"
            value={lightIntensity}
            step={0.1}
            precision={1}
            onChange={(v) => onUpdateProp?.("object3d.lightIntensity", v)}
          />
        </div>
      </div>
    </div>
  );
};
