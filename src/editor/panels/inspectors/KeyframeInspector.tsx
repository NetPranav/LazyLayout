"use client";

import React, { useState, useId, useMemo } from "react";
import { Frame, Plus, Minus } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { useLayers } from "@/core/store/useDocumentStore";
import {
  DEFAULT_LAYERS,
  DEFAULT_PROPERTIES,
  DEFAULT_EASINGS,
  PLAYBACK_OPTIONS,
  DEFAULT_BEZIER,
  EASING_BEZIERS,
  EASING_SVG_PATHS,
} from "./constants";
import type { KeyframeInspectorProps, PlaybackMode, CubicBezierCurve } from "./types";

export const KeyframeInspector: React.FC<KeyframeInspectorProps> = ({
  layer: propLayer,
  onLayerChange,
  availableLayers: propAvailableLayers,
  property: propProperty,
  onPropertyChange,
  availableProperties = DEFAULT_PROPERTIES,
  timecode: propTimecode,
  onTimecodeChange,
  value: propValue,
  onValueChange,
  valueSuffix = "%",
  valuePrefix = "O",
  duration: propDuration,
  onDurationChange,
  delay: propDelay,
  onDelayChange,
  easing: propEasing,
  onEasingChange,
  availableEasings = DEFAULT_EASINGS,
  bezier: propBezier,
  onBezierChange,
  playback: propPlayback,
  onPlaybackChange,
  presets: propPresets,
  onAddPreset,
  onRemovePreset,
  className = "",
  style,
}) => {
  const inspectorId = useId();

  // Connect to real document layers and selection
  const selectedElementId = useSelectionStore((s) => s.selectedId);
  const elements = useLayers();

  const liveLayerNames = useMemo(() => {
    const names = Object.values(elements)
      .map((el) => el.name || el.id)
      .filter(Boolean);
    return names.length > 0 ? names : DEFAULT_LAYERS;
  }, [elements]);

  const activeLayerName = useMemo(() => {
    if (selectedElementId && elements[selectedElementId]) {
      return elements[selectedElementId].name || selectedElementId;
    }
    return DEFAULT_LAYERS[0] || "Headline";
  }, [selectedElementId, elements]);

  // Internal states when uncontrolled
  const [internalLayer, setInternalLayer] = useState<string>(activeLayerName);
  const [internalProperty, setInternalProperty] = useState<string>("Opacity");
  const [internalTimecode, setInternalTimecode] = useState<string>("00:01.20");
  const [internalValue, setInternalValue] = useState<string>("100");
  const [internalDuration, setInternalDuration] = useState<string>("0.6");
  const [internalDelay, setInternalDelay] = useState<string>("0");
  const [internalEasing, setInternalEasing] = useState<string>("Ease out");
  const [internalBezier, setInternalBezier] = useState<CubicBezierCurve>(DEFAULT_BEZIER);
  const [internalPlayback, setInternalPlayback] = useState<PlaybackMode>("Off");
  const [internalPresets, setInternalPresets] = useState<string[]>([]);
  const [newPresetName, setNewPresetName] = useState<string>("");
  const [isAddingPreset, setIsAddingPreset] = useState<boolean>(false);

  const availableLayers = propAvailableLayers ?? liveLayerNames;
  const layer = propLayer ?? (selectedElementId ? activeLayerName : internalLayer);
  const property = propProperty ?? internalProperty;
  const timecode = propTimecode ?? internalTimecode;
  const value = propValue ?? internalValue;
  const duration = propDuration ?? internalDuration;
  const delay = propDelay ?? internalDelay;
  const easing = propEasing ?? internalEasing;
  const bezier = propBezier ?? internalBezier;
  const playback = propPlayback ?? internalPlayback;
  const presets = propPresets ?? internalPresets;

  const handleLayerSelect = (val: string) => {
    if (onLayerChange) onLayerChange(val);
    else setInternalLayer(val);
  };

  const handlePropertySelect = (val: string) => {
    if (onPropertyChange) onPropertyChange(val);
    else setInternalProperty(val);
  };

  const handleTimecodeChange = (val: string) => {
    if (onTimecodeChange) onTimecodeChange(val);
    else setInternalTimecode(val);
  };

  const handleValueChange = (val: string) => {
    if (onValueChange) onValueChange(val);
    else setInternalValue(val);
  };

  const handleDurationChange = (val: string) => {
    if (onDurationChange) onDurationChange(val);
    else setInternalDuration(val);
  };

  const handleDelayChange = (val: string) => {
    if (onDelayChange) onDelayChange(val);
    else setInternalDelay(val);
  };

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

  const handlePlaybackSelect = (val: PlaybackMode) => {
    if (onPlaybackChange) onPlaybackChange(val);
    else setInternalPlayback(val);
  };

  const handleAddPresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPresetName.trim();
    if (!trimmed) return;

    if (onAddPreset) onAddPreset(trimmed);
    else setInternalPresets((prev) => [...prev, trimmed]);

    setNewPresetName("");
    setIsAddingPreset(false);
  };

  const handleRemovePresetClick = (idx: number) => {
    if (onRemovePreset) onRemovePreset(idx);
    else setInternalPresets((prev) => prev.filter((_, i) => i !== idx));
  };

  // Convert layer and property arrays to Select options
  const layerOptions = availableLayers.map((l) => ({ value: l, label: l }));
  const propertyOptions = availableProperties.map((p) => ({ value: p, label: p }));
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
      {/* 1. Header: Frame Icon + "Keyframe" matching prototype: .rtop (.rico + .rname) */}
      <div className="ll-rtop ll:flex ll:items-center ll:gap-2 ll:px-4 ll:h-header ll:border-b ll:border-border ll:shrink-0 ll:min-w-0">
        <Icon icon={Frame} size={16} className="ll-rico ll:text-muted ll:shrink-0" />
        <span className="ll-rname ll:text-title ll:font-semibold ll:text-primary ll:truncate">
          Keyframe
        </span>
      </div>

      {/* 2. Target Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Target
          </h3>
          <div className="ll-sp ll:flex-1" />
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          <Select
            size="sm"
            aria-label="Layer"
            value={layer}
            onChange={handleLayerSelect}
            options={layerOptions}
          />
          <Select
            size="sm"
            aria-label="Property"
            value={property}
            onChange={handlePropertySelect}
            options={propertyOptions}
          />
        </div>
      </section>

      {/* 3. Timing Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Timing
          </h3>
          <div className="ll-sp ll:flex-1" />
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Row 1: At + Value */}
          <div className="ll-dgrid ll:grid ll:grid-cols-2 ll:gap-2">
            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="Time"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                At
              </span>
              <input
                type="text"
                aria-label="Time"
                value={timecode}
                onChange={(e) => handleTimecodeChange(e.target.value)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>

            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="Value"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                {valuePrefix}
              </span>
              <input
                type="text"
                aria-label="Value"
                value={value}
                onChange={(e) => handleValueChange(e.target.value)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
              {valueSuffix && (
                <span className="ll-sf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                  {valueSuffix}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Duration + Delay */}
          <div className="ll-dgrid ll:grid ll:grid-cols-2 ll:gap-2">
            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="Duration"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                Dur
              </span>
              <input
                type="text"
                aria-label="Duration"
                value={duration}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
              <span className="ll-sf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                s
              </span>
            </div>

            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="Delay"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                Delay
              </span>
              <input
                type="text"
                aria-label="Delay"
                value={delay}
                onChange={(e) => handleDelayChange(e.target.value)}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
              <span className="ll-sf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                s
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Easing Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Easing
          </h3>
          <div className="ll-sp ll:flex-1" />
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Easing Preset Dropdown */}
          <Select
            size="sm"
            aria-label="Easing"
            value={easing}
            onChange={handleEasingSelect}
            options={easingOptions}
          />

          {/* SVG Curve Box (Matching prototype .kcurve) */}
          <svg
            className="ll-kcurve ll:block ll:w-full ll:bg-surface-canvas ll:rounded-sm ll:text-control-primary"
            style={{ height: "120px" }}
            viewBox="0 0 272 120"
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

          {/* Bezier Parameter Fields: x1, y1 & x2, y2 */}
          <div className="ll-dgrid ll:grid ll:grid-cols-2 ll:gap-2">
            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="x1"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                x1
              </span>
              <input
                type="text"
                aria-label="x1"
                value={String(bezier.x1)}
                onChange={(e) =>
                  handleBezierPointChange("x1", parseFloat(e.target.value) || 0)
                }
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>

            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="y1"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                y1
              </span>
              <input
                type="text"
                aria-label="y1"
                value={String(bezier.y1)}
                onChange={(e) =>
                  handleBezierPointChange("y1", parseFloat(e.target.value) || 0)
                }
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>

          <div className="ll-dgrid ll:grid ll:grid-cols-2 ll:gap-2">
            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="x2"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                x2
              </span>
              <input
                type="text"
                aria-label="x2"
                value={String(bezier.x2)}
                onChange={(e) =>
                  handleBezierPointChange("x2", parseFloat(e.target.value) || 0)
                }
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>

            <div
              className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:min-w-0 ll:transition-colors"
              title="y2"
            >
              <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0 ll:select-none">
                y2
              </span>
              <input
                type="text"
                aria-label="y2"
                value={String(bezier.y2)}
                onChange={(e) =>
                  handleBezierPointChange("y2", parseFloat(e.target.value) || 0)
                }
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Playback Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-b ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Playback
          </h3>
          <div className="ll-sp ll:flex-1" />
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          <SegmentedControl
            size="sm"
            ariaLabel="Playback mode"
            value={playback}
            onChange={handlePlaybackSelect}
            options={PLAYBACK_OPTIONS}
          />
        </div>
      </section>

      {/* 6. Presets Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3">
        <div className="ll-dtitle ll:flex ll:items-center ll:justify-between ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-small ll:font-medium ll:text-primary ll:m-0">
            Presets
          </h3>
          <IconButton
            size="sm"
            aria-label="Add preset"
            tooltip="Add preset"
            icon={<Icon icon={Plus} size={14} />}
            onClick={() => setIsAddingPreset((prev) => !prev)}
          />
        </div>

        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Add Preset Form */}
          {isAddingPreset && (
            <form
              onSubmit={handleAddPresetSubmit}
              className="ll:flex ll:items-center ll:gap-1.5"
            >
              <div className="ll-dfield ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-border ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                <input
                  type="text"
                  placeholder="Choose or name a preset"
                  aria-label="Preset"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:w-full ll:font-mono ll:text-micro ll:text-primary ll:placeholder:text-muted ll:p-0"
                />
              </div>
              <IconButton
                type="submit"
                size="sm"
                aria-label="Save preset"
                tooltip="Save"
                disabled={!newPresetName.trim()}
                icon={<Icon icon={Plus} size={12} />}
              />
            </form>
          )}

          {/* Presets List */}
          {presets.map((preset, idx) => (
            <div
              key={`${preset}-${idx}`}
              className="ll-dr ll:flex ll:items-center ll:justify-between ll:gap-2"
            >
              <div className="ll-dfield ll:flex ll:items-center ll:h-7 ll:px-2 ll:bg-surface-bar ll:rounded-sm ll:flex-1 ll:min-w-0">
                <span className="ll:font-mono ll:text-micro ll:text-primary ll:truncate">
                  {preset}
                </span>
              </div>
              <IconButton
                size="sm"
                aria-label={`Remove preset ${preset}`}
                tooltip="Remove preset"
                icon={<Icon icon={Minus} size={12} />}
                onClick={() => handleRemovePresetClick(idx)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default KeyframeInspector;
