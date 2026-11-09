"use client";

import React, { useState } from "react";
import {
  Frame,
  Type,
  Image as ImageIcon,
  Square,
  Timer,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Diamond,
} from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import { Slider } from "./Slider";
import {
  useMotionModel,
  motionActions,
  timecode,
  parseTime,
  layerName,
  layerType,
  PROPS,
  PORD,
  EZL,
  valueAt,
  formatValue,
  clampN,
  type MotionLayer,
  type PropId,
  type Trigger,
  type ClipCategory,
  type RepeatMode,
  type EaseName,
} from "@/editor/motion-model";

export const CATEGORY_OPTIONS: { value: ClipCategory; label: string }[] = [
  { value: "Entrance", label: "Entrance" },
  { value: "Hover", label: "Hover" },
  { value: "Tap", label: "Tap" },
  { value: "Scroll", label: "Scroll" },
  { value: "Loop", label: "Loop" },
  { value: "Morph", label: "Morph" },
  { value: "Exit", label: "Exit" },
  { value: "Focus", label: "Focus" },
  { value: "Stagger", label: "Stagger" },
  { value: "Layout", label: "Layout" },
];

export const TRIGGER_OPTIONS: { value: Trigger; label: string }[] = [
  { value: "On load", label: "On load" },
  { value: "On hover", label: "On hover" },
  { value: "On press", label: "On press" },
  { value: "On focus", label: "On focus" },
  { value: "On scroll into view", label: "On scroll into view" },
  { value: "While scrolling", label: "While scrolling" },
  { value: "Follow the pointer", label: "Follow the pointer" },
  { value: "While dragged", label: "While dragged" },
  { value: "On a timer", label: "On a timer" },
  { value: "On leave", label: "On leave" },
  { value: "When its layout changes", label: "When its layout changes" },
];

const REPEAT_OPTIONS = [
  { value: "Once", label: "Once" },
  { value: "Number", label: "Number" },
  { value: "Forever", label: "Forever" },
];

const ON_OFF_OPTIONS = [
  { value: "Off", label: "Off" },
  { value: "On", label: "On" },
];

const STAGGER_FROM_OPTIONS = [
  { value: "Start", label: "Start" },
  { value: "Center", label: "Center" },
  { value: "End", label: "End" },
  { value: "Edges", label: "Edges" },
  { value: "Random", label: "Random" },
];

const EASING_OPTIONS = EZL.slice(0, 7).map((e) => ({
  value: e,
  label: e,
}));

export interface LayerInspectorProps {
  layer: MotionLayer;
  className?: string;
}

export const LayerInspector: React.FC<LayerInspectorProps> = ({ layer, className = "" }) => {
  const playhead = useMotionModel((s) => s.playhead);
  const selectedClipIndex = useMotionModel((s) => s.selectedClip);
  const comp = useMotionModel((s) => s.comp);

  const clip = layer.clips[selectedClipIndex] || layer.clips[0] || { s: 0, e: comp.dur };
  const clipCount = layer.clips.length;

  const isScrollTrigger =
    layer.trig === "On scroll into view" || layer.trig === "While scrolling";
  const isFrame = layerType(layer.id) === "frame" || layer.id === "hero";

  // Layer Icon Selection
  const lType = layerType(layer.id);
  const HeaderIcon =
    lType === "text"
      ? Type
      : lType === "image"
      ? ImageIcon
      : lType === "button"
      ? Square
      : Frame;

  // Add Property Dropdown state
  const [showAddProp, setShowAddProp] = useState(false);

  // Remaining properties to add
  const existingProps = new Set(layer.tr.map((t) => t.p));
  const availableProps = PORD.filter((p) => !existingProps.has(p));

  // Handlers for Layer changes
  const handleCategoryChange = (val: string) => {
    motionActions.setClipCategory(layer.id, val as ClipCategory);
  };

  const handleTriggerChange = (val: string) => {
    motionActions.setClipTrigger(layer.id, val as Trigger);
  };

  const triggerOptions = React.useMemo(() => {
    if (layer.trig === "On click") {
      return [...TRIGGER_OPTIONS, { value: "On click" as Trigger, label: "On click" }];
    }
    return TRIGGER_OPTIONS;
  }, [layer.trig]);

  const handleClipDelayBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const f = parseTime(e.target.value, comp.fps);
    if (!isNaN(f)) {
      motionActions.moveClip(layer.id, selectedClipIndex, f);
    }
  };

  const handleClipDurBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const dur = parseTime(e.target.value, comp.fps);
    if (!isNaN(dur) && dur > 0) {
      motionActions.trimClip(layer.id, selectedClipIndex, "e", clip.s + dur);
    }
  };

  const handleLayerEaseChange = (val: string) => {
    motionActions.setLayer(layer.id, { ease: val as EaseName });
  };

  const handleRepeatChange = (val: string) => {
    motionActions.setLayer(layer.id, { rep: val as RepeatMode });
  };

  const handleSplitAtPlayhead = () => {
    motionActions.splitClip(layer.id, selectedClipIndex, playhead);
  };

  // Effect Controls Actions
  const handleWatchToggle = (p: PropId) => {
    const tr = layer.tr.find((t) => t.p === p);
    if (!tr || layer.lock) return;

    if (tr.keys.length > 0) {
      // Remove all keys
      const keyIds = tr.keys.map((k) => k.id);
      motionActions.deleteKeys(keyIds);
    } else {
      // Add a keyframe at playhead
      motionActions.addKey(layer.id, p, playhead);
    }
  };

  const handleNavKey = (p: PropId, dir: 1 | -1) => {
    const tr = layer.tr.find((t) => t.p === p);
    if (!tr) return;

    let best: number | null = null;
    for (const k of tr.keys) {
      if (dir > 0 ? k.t > playhead : k.t < playhead) {
        if (best === null || (dir > 0 ? k.t < best : k.t > best)) {
          best = k.t;
        }
      }
    }

    if (best !== null) {
      motionActions.setPlayhead(best);
    }
  };

  const handleToggleKeyAtPlayhead = (p: PropId) => {
    const tr = layer.tr.find((t) => t.p === p);
    if (!tr || layer.lock) return;

    const hit = tr.keys.find((k) => k.t === playhead);
    if (hit) {
      motionActions.deleteKeys([hit.id]);
    } else {
      motionActions.addKey(layer.id, p, playhead);
    }
  };

  const handleScrubPointerDown = (p: PropId, e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0 || layer.lock) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const initialVal = valueAt(layer, p, playhead);
    const spec = PROPS[p];

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const stepMult = ev.shiftKey ? 5 : 1;
      const rangeMult = spec.hi - spec.lo > 1000 ? 2 : 1;
      const nextVal = clampN(
        initialVal + Math.round(dx * stepMult * rangeMult),
        spec.lo,
        spec.hi
      );

      // Add or update keyframe at playhead
      motionActions.addKey(layer.id, p, playhead, nextVal);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      className={`ll-layer-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
    >
      {/* Header: Layer Type Icon + Layer Name */}
      <div className="ll-rtop ll:flex ll:items-center ll:gap-2 ll:px-4 ll:h-11 ll:border-b ll:border-border ll:shrink-0 ll:min-w-0">
        <Icon icon={HeaderIcon} size={16} className="ll-rico ll:text-muted ll:shrink-0" />
        <span className="ll-rname ll:text-heading ll:font-semibold ll:text-primary ll:truncate">
          {layerName(layer.id)}
        </span>
      </div>

      {/* 1. Trigger Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border ll:first:border-t-0">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Trigger</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Category Select */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Category
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Select
                size="sm"
                aria-label="Category"
                value={layer.category ?? "Entrance"}
                onChange={handleCategoryChange}
                options={CATEGORY_OPTIONS}
              />
            </div>
          </div>

          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Trigger
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Select
                size="sm"
                aria-label="Trigger"
                value={layer.trig}
                onChange={handleTriggerChange}
                options={triggerOptions}
              />
            </div>
          </div>

          {/* Scroll options if trigger is scroll-based */}
          {isScrollTrigger && (
            <>
              <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
                <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                  Start
                </span>
                <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                  <input
                    type="text"
                    aria-label="Scroll start"
                    value={layer.ss}
                    onChange={(e) => motionActions.setLayer(layer.id, { ss: e.target.value })}
                    className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                  />
                </div>
              </div>

              <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
                <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                  End
                </span>
                <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                  <input
                    type="text"
                    aria-label="Scroll end"
                    value={layer.se}
                    onChange={(e) => motionActions.setLayer(layer.id, { se: e.target.value })}
                    className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                  />
                </div>
              </div>

              <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
                <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                  Scrub
                </span>
                <div className="ll:flex-1 ll:min-w-0">
                  <SegmentedControl
                    size="sm"
                    ariaLabel="Scrub"
                    value={layer.scrub ? "On" : "Off"}
                    onChange={(v) => motionActions.setLayer(layer.id, { scrub: v === "On" })}
                    options={ON_OFF_OPTIONS}
                  />
                </div>
              </div>

              <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
                <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                  Pin
                </span>
                <div className="ll:flex-1 ll:min-w-0">
                  <SegmentedControl
                    size="sm"
                    ariaLabel="Pin"
                    value={layer.pin ? "On" : "Off"}
                    onChange={(v) => motionActions.setLayer(layer.id, { pin: v === "On" })}
                    options={ON_OFF_OPTIONS}
                  />
                </div>
              </div>

              <div className="ll:flex ll:flex-col ll:gap-1.5 ll:mt-1">
                <span className="ll:text-micro ll:font-medium ll:text-muted">Scroll preview</span>
                <div className="ll:flex ll:items-center ll:gap-2">
                  <div className="ll:flex-1 ll:min-w-0">
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={layer.sprev}
                      onChange={(v) => motionActions.setLayer(layer.id, { sprev: v })}
                      unit="%"
                      ariaLabel="Scroll preview"
                    />
                  </div>
                  <span className="ll:w-10 ll:text-right ll:font-mono ll:text-micro ll:text-primary">
                    {layer.sprev}%
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Hover / Click / Press helper note */}
          {(layer.trig === "On hover" || layer.trig === "On click" || layer.trig === "On press") && (
            <div className="ll:text-micro ll:text-muted ll:py-1">
              Preview: {layer.trig === "On hover" ? "hover" : "press"} the element on the canvas.
            </div>
          )}
        </div>
      </section>

      {/* 2. Clip Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Clip</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Delay */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Delay
            </span>
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
              <input
                type="text"
                aria-label="Clip delay"
                defaultValue={timecode(clip.s, comp.fps)}
                onBlur={handleClipDelayBlur}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Duration
            </span>
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
              <input
                type="text"
                aria-label="Clip duration"
                defaultValue={timecode(clip.e - clip.s, comp.fps)}
                onBlur={handleClipDurBlur}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>

          {/* Easing */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Easing
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Select
                size="sm"
                aria-label="Layer easing"
                value={layer.ease}
                onChange={handleLayerEaseChange}
                options={EASING_OPTIONS}
              />
            </div>
          </div>

          <div className="ll:text-micro ll:text-muted ll:leading-snug">
            {clipCount > 1
              ? `Clip ${selectedClipIndex + 1} of ${clipCount}. Delay and Duration are for this clip.`
              : "One clip. Use Split (C) to cut it at the playhead."}
          </div>

          <button
            type="button"
            onClick={handleSplitAtPlayhead}
            className="ll:h-7 ll:w-full ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
          >
            Split at playhead
          </button>
        </div>
      </section>

      {/* 3. Repeat Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Repeat</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Repeat
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Select
                size="sm"
                aria-label="Repeat"
                value={layer.rep}
                onChange={handleRepeatChange}
                options={REPEAT_OPTIONS}
              />
            </div>
          </div>

          {layer.rep === "Number" && (
            <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
              <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                Times
              </span>
              <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                <input
                  type="number"
                  aria-label="Repeat count"
                  value={layer.rn}
                  onChange={(e) =>
                    motionActions.setLayer(layer.id, {
                      rn: clampN(parseInt(e.target.value, 10) || 1, 1, 99),
                    })
                  }
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                />
              </div>
            </div>
          )}

          {layer.rep !== "Once" && (
            <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
              <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                Yoyo
              </span>
              <div className="ll:flex-1 ll:min-w-0">
                <SegmentedControl
                  size="sm"
                  ariaLabel="Yoyo"
                  value={layer.yoyo ? "On" : "Off"}
                  onChange={(v) => motionActions.setLayer(layer.id, { yoyo: v === "On" })}
                  options={ON_OFF_OPTIONS}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Stagger Section (if frame or stagger category) */}
      {(isFrame || layer.category === "Stagger") && (
        <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
          <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
            <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Stagger</h3>
          </div>
          <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
            <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
              <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                Between
              </span>
              <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                <input
                  type="number"
                  aria-label="Delay between children"
                  value={layer.stag}
                  onChange={(e) =>
                    motionActions.setLayer(layer.id, {
                      stag: clampN(parseInt(e.target.value, 10) || 0, 0, 1000),
                    })
                  }
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                />
                <span className="ll-pf ll:font-mono ll:text-micro ll:font-medium ll:text-muted ll:shrink-0">
                  ms
                </span>
              </div>
            </div>

            <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
              <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
                From
              </span>
              <div className="ll:flex-1 ll:min-w-0">
                <Select
                  size="sm"
                  aria-label="Stagger from"
                  value={layer.sfrom}
                  onChange={(val) =>
                    motionActions.setLayer(layer.id, {
                      sfrom: val as "Start" | "End" | "Center",
                    })
                  }
                  options={STAGGER_FROM_OPTIONS}
                />
              </div>
            </div>

            <div className="ll:text-micro ll:text-muted ll:leading-snug">
              The children of this frame play one after another.
            </div>
          </div>
        </section>
      )}

      {/* 5. Properties Section (Effect Controls style rows) */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Properties</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {layer.tr.length > 0 ? (
            <div className="ll-ktr ll:flex ll:flex-col">
              {layer.tr.map((tr) => {
                const spec = PROPS[tr.p];
                const hasKeys = tr.keys.length > 0;
                const hasKeyAtPlayhead = tr.keys.some((k) => k.t === playhead);
                const currentVal = valueAt(layer, tr.p, playhead);
                const valFormatted = formatValue(tr.p, currentVal);

                return (
                  <div key={tr.p} className="ll-fxr">
                    {/* Stopwatch button */}
                    <button
                      type="button"
                      onClick={() => handleWatchToggle(tr.p)}
                      aria-pressed={hasKeys}
                      aria-label={`Keyframing for ${spec.n}`}
                      title={hasKeys ? "Remove all keyframes" : "Add a keyframe at the playhead"}
                      className={`ll:size-6 ll:grid ll:place-items-center ll:rounded-sm ll:transition-colors ${
                        hasKeys ? "ll:text-control-primary" : "ll:text-muted ll:hover:text-primary"
                      }`}
                    >
                      <Icon icon={Timer} size={14} />
                    </button>

                    {/* Property Name */}
                    <span className="ll-nm">{spec.n}</span>

                    {/* Live Readout (Drag to change) */}
                    <span
                      className={`ll-rd ${!hasKeys ? "mt ll:text-muted" : "ll:text-primary"}`}
                      title="Drag to change the value at the playhead"
                      onPointerDown={(e) => handleScrubPointerDown(tr.p, e)}
                    >
                      {valFormatted}
                    </span>

                    {/* Keyframe Navigator */}
                    <span className="ll-nav ll:flex ll:items-center">
                      <button
                        type="button"
                        onClick={() => handleNavKey(tr.p, -1)}
                        aria-label="Previous keyframe"
                        title="Previous keyframe"
                        className="ll:size-5 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:transition-colors"
                      >
                        <Icon icon={ChevronLeft} size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleKeyAtPlayhead(tr.p)}
                        aria-pressed={hasKeyAtPlayhead}
                        aria-label="Add or remove a keyframe at the playhead"
                        title="Add or remove a keyframe"
                        className={`ll:size-5 ll:grid ll:place-items-center ll:transition-colors ${
                          hasKeyAtPlayhead
                            ? "ll:text-control-primary"
                            : "ll:text-muted ll:hover:text-primary"
                        }`}
                      >
                        <Icon
                          icon={Diamond}
                          size={10}
                          className={hasKeyAtPlayhead ? "ll:fill-current" : ""}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavKey(tr.p, 1)}
                        aria-label="Next keyframe"
                        title="Next keyframe"
                        className="ll:size-5 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:transition-colors"
                      >
                        <Icon icon={ChevronRight} size={12} />
                      </button>
                    </span>

                    {/* Delete Track Button */}
                    <button
                      type="button"
                      onClick={() => motionActions.removeProperty(layer.id, tr.p)}
                      aria-label={`Delete ${spec.n} track`}
                      title="Delete track"
                      className="ll:size-6 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:transition-colors"
                    >
                      <Icon icon={Trash2} size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ll:text-micro ll:text-muted ll:py-1">
              No animated properties yet.
            </div>
          )}

          {/* Add property */}
          {availableProps.length > 0 ? (
            <div className="ll:flex ll:flex-col ll:gap-1">
              {showAddProp ? (
                <div className="ll:flex ll:flex-col ll:gap-1 ll:p-2 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-sm">
                  <span className="ll:text-micro ll:font-medium ll:text-muted">Choose property:</span>
                  <div className="ll:grid ll:grid-cols-2 ll:gap-1">
                    {availableProps.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          motionActions.addProperty(layer.id, p);
                          setShowAddProp(false);
                        }}
                        className="ll:h-7 ll:px-2 ll:text-left ll:text-micro ll:font-medium ll:rounded-xs ll:bg-surface-bar ll:text-primary ll:hover:bg-surface-hover ll:transition-colors"
                      >
                        {PROPS[p].n}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddProp(true)}
                  className="ll:h-7 ll:w-full ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
                >
                  Add property
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="ll:h-7 ll:w-full ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-muted ll:opacity-45 ll:cursor-default"
            >
              Add property
            </button>
          )}

          {/* Quick Presets */}
          <div className="ll:flex ll:flex-col ll:gap-1 ll:mt-2">
            <span className="ll:text-micro ll:font-medium ll:text-muted">Presets</span>
            <div className="ll:grid ll:grid-cols-2 ll:gap-1">
              {["Fade in", "Slide up", "Pop", "Stagger"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => motionActions.applyPreset(layer.id, p)}
                  className="ll:h-7 ll:px-2 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LayerInspector;
