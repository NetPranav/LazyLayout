"use client";

import React from "react";
import { Button } from "@/editor/components/Button";
import { NumberField } from "@/editor/components/NumberField";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { flattenBooleanGroups, setBooleanOperation } from "@/core/editing/booleanGroups";
import { isBooleanOp } from "@/core/editing/layerOutline";
import type { PathBoolOp } from "@/core/paths/pathOps";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const OPERATIONS: ReadonlyArray<{ value: PathBoolOp; label: string; title: string }> = [
  { value: "union", label: "Union", title: "Union: everything the pieces cover" },
  { value: "subtract", label: "Subtract", title: "Subtract: the bottom piece, minus the others" },
  { value: "intersect", label: "Intersect", title: "Intersect: only where all pieces overlap" },
  { value: "exclude", label: "Exclude", title: "Exclude: everywhere but the overlaps" },
];

/**
 * A live boolean group (Phases 104 and 108): its operation, the softness of a union (pieces melt together where they
 * come within twice this), and Flatten. The pieces stay layers of their own and can still be moved and edited.
 */
export const BooleanGroupSection: React.FC<InspectorSectionProps> = ({ selectedId, getValue, onUpdateProp, className = "" }) => {
  const raw = getValue?.("boolean.operation");
  const op: PathBoolOp = isBooleanOp(raw) ? raw : "union";
  const softRaw = getValue?.("boolean.softness");
  const softness = typeof softRaw === "number" && Number.isFinite(softRaw) ? softRaw : 0;
  const id = selectedId ?? "";

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`} data-testid="boolean-group-section">
      <SegmentedControl size="sm" ariaLabel="Boolean operation" options={OPERATIONS} value={op} onChange={(v) => id && setBooleanOperation([id], v)} />
      <OptionRow label="Softness">
        <NumberField
          size="sm"
          aria-label="Softness"
          value={softness}
          min={0}
          max={500}
          suffix="px"
          disabled={op !== "union"}
          title={op === "union" ? "Pieces closer than twice this melt together, like liquid" : "Softness melts pieces together in a Union"}
          onChange={(v) => onUpdateProp?.("boolean.softness", Math.max(0, Math.min(500, v)))}
        />
      </OptionRow>
      <Button size="sm" variant="secondary" aria-label="Flatten boolean group" disabled={!id} onClick={() => id && flattenBooleanGroups([id])}>
        Flatten
      </Button>
    </div>
  );
};
