"use client";

import React from "react";
import { PenLine, SquaresExclude, SquaresIntersect, SquaresSubtract, SquaresUnite } from "lucide-react";
import { Button } from "@/editor/components/Button";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { NumberField } from "@/editor/components/NumberField";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { combineSelection, enterSelectedPathEdit, exitPathEdit, joinOpenPaths, openPathLayers, roundPathCorners, roundableCorners, setFillRule, setSelectedPointType, sharedPointType, type FillRule, type PointType } from "@/editor/stage/pen/penAdapter";
import { isVectorSource } from "@/core/editing/vectorOps";
import type { BooleanOp } from "@/core/paths/booleans";
import { useDocument } from "@/core/store/useDocumentStore";
import { useVectorEditStore } from "@/core/store/useVectorEditStore";
import { OptionGroup, OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

const POINT_TYPES: ReadonlyArray<{ value: PointType; label: string; title: string }> = [
  { value: "straight", label: "Straight", title: "Straight: no handles" },
  { value: "mirrored", label: "Mirrored", title: "Mirrored: two equal, opposite handles" },
  { value: "free", label: "Free", title: "Free: the two handles move on their own" },
];

const FILL_RULES: ReadonlyArray<{ value: FillRule; label: string; title: string }> = [
  { value: "nonzero", label: "Non-zero", title: "Non-zero: overlapping loops in the same direction stay filled" },
  { value: "evenodd", label: "Even-odd", title: "Even-odd: every second overlap is a hole" },
];

const BOOLEANS: ReadonlyArray<{ op: BooleanOp; label: string; icon: typeof SquaresUnite }> = [
  { op: "union", label: "Union", icon: SquaresUnite },
  { op: "subtract", label: "Subtract", icon: SquaresSubtract },
  { op: "intersect", label: "Intersect", icon: SquaresIntersect },
  { op: "exclude", label: "Exclude", icon: SquaresExclude },
];

/** Section header button: starts or ends editing the selected path's points (the same as Enter on the canvas). */
export const VectorHeaderAction: React.FC<InspectorSectionProps> = ({ selectedIds = [] }) => {
  const editing = useVectorEditStore((s) => s.layerId !== null);
  return (
    <IconButton
      size="sm"
      aria-label={editing ? "Done editing points" : "Edit points"}
      tooltip={editing ? "Done (Enter)" : "Edit points (Enter)"}
      pressed={editing}
      disabled={!editing && selectedIds.length !== 1}
      onClick={() => (editing ? exitPathEdit() : enterSelectedPathEdit())}
      icon={<Icon icon={PenLine} size={14} />}
    />
  );
};

/** Vector section: shown when a path layer is selected. Point type, fill rule and the four boolean operations. */
export const VectorSection: React.FC<InspectorSectionProps> = ({ selectedIds = [], getValue, className = "" }) => {
  const layers = useDocument((d) => d.layers);
  const editing = useVectorEditStore((s) => s.layerId !== null);
  const nodes = useVectorEditStore((s) => s.nodes);
  const selected = useVectorEditStore((s) => s.selected);
  const pointType = editing ? sharedPointType(nodes, selected) : null;
  const rule = (getValue?.("svg.fillRule") as FillRule | null) || "nonzero";
  const sources = selectedIds.filter((id) => isVectorSource(layers[id]));
  const canCombine = !editing && sources.length >= 2;

  return (
    <div className={`ll:flex ll:flex-col ll:gap-2 ll:w-full ${className}`} data-testid="vector-section">
      <div title={editing ? "The type of the selected points" : "Edit points to change their type"}>
        <SegmentedControl
          size="sm"
          ariaLabel="Point type"
          options={POINT_TYPES}
          value={pointType ?? ("" as PointType)}
          disabled={!editing || selected.length === 0}
          onChange={setSelectedPointType}
        />
      </div>
      {!editing && <p className="ll:m-0 ll:text-micro ll:text-muted">Edit points (Enter) and pick one to set its type.</p>}

      <SegmentedControl size="sm" ariaLabel="Fill rule" options={FILL_RULES} value={rule} onChange={(v) => setFillRule(selectedIds, v)} />

      <div role="group" aria-label="Boolean operations" className="ll:grid ll:grid-cols-4 ll:gap-1">
        {BOOLEANS.map((b) => (
          <IconButton
            key={b.op}
            size="md"
            variant="secondary"
            aria-label={b.label}
            tooltip={canCombine ? b.label : `${b.label}: select two or more shapes`}
            disabled={!canCombine}
            className="ll:w-full"
            onClick={() => combineSelection(b.op, sources)}
            icon={<Icon icon={b.icon} size={14} />}
          />
        ))}
      </div>
    </div>
  );
};

/** The rest of the vector tools: round corners and join. Both are one-off edits of the path, not live properties. */
export const VectorOptions: React.FC<InspectorSectionProps> = ({ selectedId, selectedIds = [] }) => {
  const [radius, setRadius] = React.useState(8);
  const layers = useDocument((d) => d.layers);
  const id = selectedId ?? "";
  // re-read whenever the document changes
  const corners = layers[id] ? roundableCorners(id) : 0;
  const open = openPathLayers(selectedIds);

  return (
    <div className="ll:flex ll:flex-col ll:w-full">
      <OptionGroup>
        <OptionRow label="Corner radius">
          <NumberField size="sm" aria-label="Corner radius" min={0} value={radius} onChange={setRadius} className="ll:w-full" />
          <Button size="sm" disabled={corners === 0 || radius <= 0} title={corners === 0 ? "No sharp corner between straight segments" : "Round the sharp corners once"} onClick={() => roundPathCorners(id, radius)}>
            Round
          </Button>
        </OptionRow>
        <OptionRow label="Join">
          <Button size="sm" disabled={open.length !== 2} title={open.length === 2 ? "Join the two open paths end to end" : "Select two open paths"} onClick={() => joinOpenPaths(open[0], open[1])}>
            Join paths
          </Button>
        </OptionRow>
      </OptionGroup>
    </div>
  );
};
