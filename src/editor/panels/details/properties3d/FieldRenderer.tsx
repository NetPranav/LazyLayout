"use client";

/**
 * ============================================================================
 * GENERIC ZOD FIELD RENDERER (Phase 3D-022 Pro Face)
 * ============================================================================
 * Introspects Zod v4 schemas using the public `def` property to render typed,
 * accessible UI controls for every field of a 3D data block.
 * ============================================================================
 */

import React from "react";
import { NumberField } from "@/editor/components/NumberField";
import { TextField } from "@/editor/components/TextField";
import { Toggle } from "@/editor/components/Toggle";
import { Select } from "@/editor/components/Select";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";

export type FieldMetaType =
  | "number"
  | "string"
  | "boolean"
  | "enum"
  | "vector3"
  | "quaternion"
  | "color"
  | "array"
  | "object"
  | "unknown";

export interface FieldMeta {
  type: FieldMetaType;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
  shape?: Record<string, unknown>;
}

/**
 * Inspects a Zod v4 schema via its public `def` to derive control metadata.
 */
export function inspectZodSchema(schema: unknown, fieldName = ""): FieldMeta {
  type ZDef = {
    type?: string;
    defaultValue?: unknown;
    innerType?: unknown;
    in?: unknown;
    items?: unknown[];
    shape?: Record<string, unknown> | (() => Record<string, unknown>);
  };
  type ZSchema = {
    def?: ZDef;
    _def?: ZDef;
    description?: string;
    minValue?: number | null;
    maxValue?: number | null;
    isInt?: boolean;
    options?: string[];
    shape?: Record<string, unknown>;
  };

  let cur = schema as ZSchema;
  let defaultValue: unknown;
  const description = cur?.description;

  // Unwrap wrappers (default, prefault, optional, nullable, readonly, pipe)
  while (cur && (cur.def || cur._def)) {
    const d = cur.def ?? cur._def;
    const t = d?.type;
    if (t === "default" || t === "prefault") {
      const dv = d?.defaultValue;
      defaultValue = typeof dv === "function" ? (dv as () => unknown)() : dv;
      cur = d?.innerType as ZSchema;
    } else if (t === "optional" || t === "nullable" || t === "readonly") {
      cur = d?.innerType as ZSchema;
    } else if (t === "pipe") {
      cur = d?.in as ZSchema;
    } else {
      break;
    }
  }

  const d = cur?.def ?? cur?._def;
  const t = d?.type;

  if (t === "number") {
    const min =
      typeof cur?.minValue === "number" && Number.isFinite(cur.minValue)
        ? cur.minValue
        : undefined;
    const max =
      typeof cur?.maxValue === "number" && Number.isFinite(cur.maxValue)
        ? cur.maxValue
        : undefined;
    return {
      type: "number",
      default: defaultValue,
      min,
      max,
      step: cur?.isInt ? 1 : undefined,
      description,
    };
  }

  if (t === "string") {
    const isColor =
      /color/i.test(fieldName) ||
      fieldName === "emissive" ||
      fieldName === "baseColor" ||
      fieldName === "ambientColor";
    return { type: isColor ? "color" : "string", default: defaultValue, description };
  }

  if (t === "boolean") {
    return { type: "boolean", default: defaultValue, description };
  }

  if (t === "enum") {
    return {
      type: "enum",
      default: defaultValue,
      options: [...(cur?.options ?? [])],
      description,
    };
  }

  if (t === "tuple") {
    const n = d?.items?.length ?? 0;
    return {
      type: n === 3 ? "vector3" : n === 4 ? "quaternion" : "array",
      default: defaultValue,
      description,
    };
  }

  if (t === "array") {
    return { type: "array", default: defaultValue, description };
  }

  if (t === "object") {
    const rawShape =
      typeof d?.shape === "function" ? d.shape() : (d?.shape ?? cur?.shape);
    return { type: "object", default: defaultValue, shape: rawShape, description };
  }

  return { type: "unknown", default: defaultValue, description };
}

export interface FieldRendererProps {
  schema: unknown;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Exclude internal or read-only fields */
  excludeKeys?: string[];
  className?: string;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  schema,
  values,
  onChange,
  excludeKeys = ["id"],
  className = "",
}) => {
  type SWithShape = {
    shape?: Record<string, unknown>;
    def?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) };
    _def?: { shape?: Record<string, unknown> | (() => Record<string, unknown>) };
  };

  const s = schema as SWithShape;
  const shape =
    typeof s?.def?.shape === "function"
      ? s.def.shape()
      : s?.def?.shape ??
        (typeof s?._def?.shape === "function" ? s._def.shape() : s?._def?.shape) ??
        s?.shape ??
        {};

  const fields = Object.entries(shape).filter(([key]) => !excludeKeys.includes(key));

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2.5 ${className}`} data-testid="field-renderer">
      {fields.map(([key, fieldSchema]) => {
        const meta = inspectZodSchema(fieldSchema, key);
        const currentVal = values[key] ?? meta.default;

        return (
          <div
            key={key}
            data-field-key={key}
            className="ll:flex ll:flex-col ll:gap-1 ll:border-b ll:border-border/40 ll:pb-2"
          >
            {/* Number Field */}
            {meta.type === "number" && (
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <div className="ll:w-28">
                  <NumberField
                    aria-label={key}
                    value={
                      typeof currentVal === "number"
                        ? currentVal
                        : Number(meta.default ?? 0)
                    }
                    min={meta.min}
                    max={meta.max}
                    step={meta.step ?? (meta.min !== undefined && meta.min >= 0 ? 0.1 : 0.05)}
                    onChange={(val) => onChange(key, val)}
                    size="sm"
                  />
                </div>
              </div>
            )}

            {/* Boolean Toggle */}
            {meta.type === "boolean" && (
              <div className="ll:flex ll:items-center ll:justify-between">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <Toggle
                  aria-label={key}
                  checked={Boolean(currentVal)}
                  onChange={(val) => onChange(key, val)}
                  size="sm"
                />
              </div>
            )}

            {/* Enum Select */}
            {meta.type === "enum" && (
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <div className="ll:w-32">
                  <Select
                    aria-label={key}
                    value={String(currentVal ?? "")}
                    onChange={(val) => onChange(key, val)}
                    options={(meta.options ?? []).map((opt) => ({
                      value: opt,
                      label: opt,
                    }))}
                    size="sm"
                  />
                </div>
              </div>
            )}

            {/* Color Swatch Field */}
            {meta.type === "color" && (
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <div className="ll:w-32">
                  <ColorSwatchField
                    hex={String(currentVal ?? "#ffffff")}
                    onChangeHex={(hex: string) => onChange(key, hex)}
                    aria-label={key}
                    withPicker
                  />
                </div>
              </div>
            )}

            {/* String Text Field */}
            {meta.type === "string" && (
              <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <div className="ll:w-32">
                  <TextField
                    aria-label={key}
                    value={String(currentVal ?? "")}
                    onChange={(e) => onChange(key, e.target.value)}
                    size="sm"
                  />
                </div>
              </div>
            )}

            {/* Vector3 (X, Y, Z) */}
            {meta.type === "vector3" && (
              <div className="ll:flex ll:flex-col ll:gap-1">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <div className="ll:grid ll:grid-cols-3 ll:gap-1">
                  {(["X", "Y", "Z"] as const).map((axis, i) => {
                    const vec = (Array.isArray(currentVal)
                      ? currentVal
                      : [0, 0, 0]) as [number, number, number];
                    return (
                      <NumberField
                        key={axis}
                        label={axis}
                        aria-label={`${key} ${axis}`}
                        value={Number(vec[i] ?? 0)}
                        step={0.1}
                        onChange={(val) => {
                          const nextVec: [number, number, number] = [...vec];
                          nextVec[i] = val;
                          onChange(key, nextVec);
                        }}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quaternion (X, Y, Z, W) */}
            {meta.type === "quaternion" && (
              <div className="ll:flex ll:flex-col ll:gap-1">
                <span className="ll:text-micro ll:text-secondary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <div className="ll:grid ll:grid-cols-4 ll:gap-1">
                  {(["X", "Y", "Z", "W"] as const).map((axis, i) => {
                    const q = (Array.isArray(currentVal)
                      ? currentVal
                      : [0, 0, 0, 1]) as [number, number, number, number];
                    return (
                      <NumberField
                        key={axis}
                        label={axis}
                        aria-label={`${key} ${axis}`}
                        value={Number(q[i] ?? (i === 3 ? 1 : 0))}
                        step={0.05}
                        onChange={(val) => {
                          const nextQ: [number, number, number, number] = [...q];
                          nextQ[i] = val;
                          onChange(key, nextQ);
                        }}
                        size="sm"
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nested Object / Sub-schema */}
            {meta.type === "object" && meta.shape && (
              <div className="ll:pl-2 ll:border-l ll:border-border ll:flex ll:flex-col ll:gap-1">
                <span className="ll:text-micro ll:font-semibold ll:text-primary ll:capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <FieldRenderer
                  schema={{ shape: meta.shape }}
                  values={
                    typeof currentVal === "object" && currentVal !== null
                      ? (currentVal as Record<string, unknown>)
                      : {}
                  }
                  onChange={(nestedKey, nestedVal) => {
                    const currentObj =
                      typeof currentVal === "object" && currentVal !== null
                        ? (currentVal as Record<string, unknown>)
                        : {};
                    onChange(key, { ...currentObj, [nestedKey]: nestedVal });
                  }}
                  excludeKeys={excludeKeys}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
