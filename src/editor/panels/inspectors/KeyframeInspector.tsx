"use client";

import React, { useState, useMemo } from "react";
import { Frame } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { SegmentedControl, type SegmentedControlOption } from "@/editor/components/SegmentedControl";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayers } from "@/core/store/useDocumentStore";
import { DEFAULT_LAYERS, DEFAULT_BEZIER, EASING_BEZIERS, EASING_SVG_PATHS } from "./constants";
import type { KeyframeInspectorProps, CubicBezierCurve } from "./types";

/** Easing list of the design file (the Easing select of #ins-key, without Spring). */
const DESIGN_EASINGS: readonly string[] = [
  "Linear",
  "Ease in",
  "Ease out",
  "Ease in out",
  "Back out",
  "Anticipate",
  "Custom",
];

const CURVE_TABS: readonly SegmentedControlOption<string>[] = [
  { value: "Curve", label: "Curve" },
  { value: "Spring", label: "Spring" },
];

const SECTION_CLASS =
  "ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border first:ll:border-t-0";
const TITLE_CLASS = "ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6";
const HEADING_CLASS = "ll:text-body ll:font-medium ll:text-primary ll:m-0";
const BODY_CLASS = "ll-dbody ll:flex ll:flex-col ll:gap-2";
const GRID_CLASS = "ll-dgrid ll:grid ll:grid-cols-2 ll:gap-2";
const FIELD_CLASS =
  "ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors";
const LABEL_CLASS =
  "ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none";
const INPUT_CLASS =
  "ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0";
const BUTTON_CLASS =
  "ll:h-7 ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:disabled:opacity-45 ll:transition-colors";

interface KeyFieldProps {
  label: string;
  title: string;
  value: string;
  onValueChange?: (val: string) => void;
  suffix?: string;
  readOnly?: boolean;
}

const KeyField: React.FC<KeyFieldProps> = ({ label, title, value, onValueChange, suffix, readOnly }) => (
  <div className={FIELD_CLASS} title={title}>
    <span className={LABEL_CLASS}>{label}</span>
    <input
      type="text"
      aria-label={title}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={`${INPUT_CLASS} ${readOnly ? "ll:text-secondary" : ""}`}
    />
    {suffix && <span className={LABEL_CLASS}>{suffix}</span>}
  </div>
);

/** Keyframe actions used by the design's Keyframes section. Optional: a button without a handler is disabled. */
export interface KeyframeActions {
  onDuplicate?: () => void;
  onDelete?: () => void;
  onStretch?: (factor: number) => void;
}

export const KeyframeInspector: React.FC<KeyframeInspectorProps & KeyframeActions> = ({
  layer: propLayer,
  property: propProperty,
  timecode: propTimecode,
  onTimecodeChange,
  value: propValue,
  onValueChange,
  valueSuffix = "%",
  valuePrefix = "Value",
  duration: propDuration,
  onDurationChange,
  delay: propDelay,
  onDelayChange,
  easing: propEasing,
  onEasingChange,
  availableEasings = DESIGN_EASINGS,
  bezier: propBezier,
  onBezierChange,
  onAddPreset,
  onDuplicate,
  onDelete,
  onStretch,
  className = "",
  style,
}) => {
  // Connect to real document layers and selection
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const elements = useLayers();

  const activeLayerName = useMemo(() => {
    if (selectedElementId && elements[selectedElementId]) {
      return elements[selectedElementId].name || selectedElementId;
    }
    return DEFAULT_LAYERS[0] || "Headline";
  }, [selectedElementId, elements]);

  // Internal states when uncontrolled
  const [internalProperty] = useState<string>("Opacity");
  const [internalTimecode, setInternalTimecode] = useState<string>("00:01.20");
  const [internalValue, setInternalValue] = useState<string>("100");
  const [internalDuration, setInternalDuration] = useState<string>("00:00.60");
  const [internalDelay, setInternalDelay] = useState<string>("00:00.00");
  const [internalEasing, setInternalEasing] = useState<string>("Ease out");
  const [internalBezier, setInternalBezier] = useState<CubicBezierCurve>(DEFAULT_BEZIER);
  const [curveTab, setCurveTab] = useState<string>("Curve");

  const layer = propLayer ?? activeLayerName;
  const property = propProperty ?? internalProperty;
  const timecode = propTimecode ?? internalTimecode;
  const value = propValue ?? internalValue;
  const duration = propDuration ?? internalDuration;
  const delay = propDelay ?? internalDelay;
  const easing = propEasing ?? internalEasing;
  const bezier = propBezier ?? internalBezier;

  const handleEasingSelect = (val: string) => {
    if (onEasingChange) onEasingChange(val);
    else setInternalEasing(val);

    const nextBezier = EASING_BEZIERS[val] ?? DEFAULT_BEZIER;
    if (onBezierChange) onBezierChange(nextBezier);
    else setInternalBezier(nextBezier);
  };

  const handleBezierPointChange = (key: keyof CubicBezierCurve, val: number) => {
    const updated = { ...bezier, [key]: val };
    if (onBezierChange) onBezierChange(updated);
    else setInternalBezier(updated);
  };

  const easingOptions = availableEasings.map((e) => ({ value: e, label: e }));
  const svgPath = EASING_SVG_PATHS[easing] ?? EASING_SVG_PATHS["Ease out"];

  return (
    <div
      id="ins-key"
      role="region"
      aria-label="Keyframe Inspector"
      className={`ll-keyframe-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
      style={style}
    >
      {/* Header: Frame icon + "Keyframe" (design .rtop: 44px, 18px title) */}
      <div className="ll-rtop ll:flex ll:items-center ll:gap-2 ll:px-4 ll:h-11 ll:border-b ll:border-border ll:shrink-0 ll:min-w-0">
        <Icon icon={Frame} size={16} className="ll-rico ll:text-muted ll:shrink-0" />
        <span className="ll-rname ll:text-heading ll:font-semibold ll:text-primary ll:truncate">
          Keyframe
        </span>
      </div>

      {/* 1. Easing */}
      <section className={SECTION_CLASS}>
        <div className={TITLE_CLASS}>
          <h3 className={HEADING_CLASS}>Easing</h3>
        </div>
        <div className={BODY_CLASS}>
          <SegmentedControl
            size="sm"
            ariaLabel="Easing type"
            value={curveTab}
            onChange={setCurveTab}
            options={CURVE_TABS}
          />

          {/* SVG curve box (design .kcurve) */}
          <svg
            className="ll-kcurve ll:block ll:w-full ll:bg-surface-canvas ll:rounded-sm ll:text-control-primary"
            style={{ height: "240px" }}
            viewBox="0 0 272 240"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${easing} curve`}
          >
            <path
              d={svgPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Preview row (design .ecv): the moving square sits on the curve's start */}
          <div aria-hidden="true" className="ll:relative ll:h-8">
            <span className="ll:absolute ll:left-0 ll:top-1/2 ll:block ll:size-2 ll:bg-control-primary ll:rounded-xs" />
          </div>

          <Select
            size="sm"
            aria-label="Easing"
            value={easing}
            onChange={handleEasingSelect}
            options={easingOptions}
          />

          {/* Bezier parameters: x1, y1 and x2, y2 */}
          <div className={GRID_CLASS}>
            <KeyField
              label="x1"
              title="x1"
              value={String(bezier.x1)}
              onValueChange={(v) => handleBezierPointChange("x1", parseFloat(v) || 0)}
            />
            <KeyField
              label="y1"
              title="y1"
              value={String(bezier.y1)}
              onValueChange={(v) => handleBezierPointChange("y1", parseFloat(v) || 0)}
            />
          </div>
          <div className={GRID_CLASS}>
            <KeyField
              label="x2"
              title="x2"
              value={String(bezier.x2)}
              onValueChange={(v) => handleBezierPointChange("x2", parseFloat(v) || 0)}
            />
            <KeyField
              label="y2"
              title="y2"
              value={String(bezier.y2)}
              onValueChange={(v) => handleBezierPointChange("y2", parseFloat(v) || 0)}
            />
          </div>

          <div className="ll:text-micro ll:leading-snug ll:text-muted">
            Drag the handles, or click the curve to add points. Eases the segment to the next keyframe.
          </div>

          <button type="button" onClick={() => onAddPreset?.(easing)} className={`${BUTTON_CLASS} ll:w-full`}>
            Save as preset
          </button>
        </div>
      </section>

      {/* 2. Target (read-only in the design) */}
      <section className={SECTION_CLASS}>
        <div className={TITLE_CLASS}>
          <h3 className={HEADING_CLASS}>Target</h3>
        </div>
        <div className={BODY_CLASS}>
          <KeyField label="Layer" title="Layer" value={layer} readOnly />
          <KeyField label="Property" title="Property" value={property} readOnly />
        </div>
      </section>

      {/* 3. Timing */}
      <section className={SECTION_CLASS}>
        <div className={TITLE_CLASS}>
          <h3 className={HEADING_CLASS}>Timing</h3>
        </div>
        <div className={BODY_CLASS}>
          <div className={GRID_CLASS}>
            <KeyField
              label="At"
              title="Time"
              value={timecode}
              onValueChange={(v) => (onTimecodeChange ? onTimecodeChange(v) : setInternalTimecode(v))}
            />
            <KeyField
              label={valuePrefix}
              title="Value"
              value={value}
              suffix={valueSuffix}
              onValueChange={(v) => (onValueChange ? onValueChange(v) : setInternalValue(v))}
            />
          </div>
        </div>
      </section>

      {/* 4. Clip */}
      <section className={SECTION_CLASS}>
        <div className={TITLE_CLASS}>
          <h3 className={HEADING_CLASS}>Clip</h3>
        </div>
        <div className={BODY_CLASS}>
          <div className={GRID_CLASS}>
            <KeyField
              label="Delay"
              title="Clip delay"
              value={delay}
              onValueChange={(v) => (onDelayChange ? onDelayChange(v) : setInternalDelay(v))}
            />
            <KeyField
              label="Duration"
              title="Clip duration"
              value={duration}
              onValueChange={(v) => (onDurationChange ? onDurationChange(v) : setInternalDuration(v))}
            />
          </div>
        </div>
      </section>

      {/* 5. Keyframes */}
      <section className={SECTION_CLASS}>
        <div className={TITLE_CLASS}>
          <h3 className={HEADING_CLASS}>Keyframes</h3>
        </div>
        <div className="ll-dbody ll:grid ll:grid-cols-2 ll:gap-2">
          <button type="button" onClick={onDuplicate} disabled={!onDuplicate} className={BUTTON_CLASS}>
            Duplicate
          </button>
          <button type="button" onClick={onDelete} disabled={!onDelete} className={BUTTON_CLASS}>
            Delete
          </button>
          <button type="button" onClick={() => onStretch?.(0.9)} disabled={!onStretch} className={BUTTON_CLASS}>
            Stretch 0.9×
          </button>
          <button type="button" onClick={() => onStretch?.(1.1)} disabled={!onStretch} className={BUTTON_CLASS}>
            Stretch 1.1×
          </button>
        </div>
      </section>
    </div>
  );
};

export default KeyframeInspector;
