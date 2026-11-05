"use client";

import React, { useState } from "react";
import { Film, X } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Select } from "@/editor/components/Select";
import { SegmentedControl } from "@/editor/components/SegmentedControl";
import {
  useMotionModel,
  motionActions,
  timecode,
  parseTime,
  layerLength,
  layerName,
  isGrp,
  EZL,
  type EaseName,
} from "@/editor/motion-model";
import { useSelectionStore } from "@/core/store/useSelectionStore";

const FPS_OPTIONS = [
  { value: "24", label: "24 fps" },
  { value: "30", label: "30 fps" },
  { value: "60", label: "60 fps" },
];

const SPEED_OPTIONS = [
  { value: "0.25", label: "0.25×" },
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
];

const LOOP_OPTIONS = [
  { value: "Off", label: "Off" },
  { value: "Loop", label: "Loop" },
  { value: "Ping-pong", label: "Ping-pong" },
];

const EASING_OPTIONS = EZL.slice(0, 7).map((e) => ({
  value: e,
  label: e,
}));

export const CompositionInspector: React.FC<{ className?: string }> = ({ className = "" }) => {
  const comp = useMotionModel((s) => s.comp);
  const speed = useMotionModel((s) => s.speed);
  const loop = useMotionModel((s) => s.loop);
  const playhead = useMotionModel((s) => s.playhead);

  const [lengthInput, setLengthInput] = useState(() => timecode(comp.dur, comp.fps));
  const [defaultEase, setDefaultEase] = useState<EaseName>("Ease out");

  const loopValue = loop === 0 ? "Off" : loop === 1 ? "Loop" : "Ping-pong";

  const handleLoopChange = (val: string) => {
    const nextLoop = val === "Off" ? 0 : val === "Loop" ? 1 : 2;
    motionActions.setLoop(nextLoop);
  };

  const handleFpsChange = (val: string) => {
    const fps = parseInt(val, 10) || 60;
    motionActions.setComp({ fps });
  };

  const handleSpeedChange = (val: string) => {
    const sp = parseFloat(val) || 1;
    motionActions.setSpeed(sp);
  };

  const handleLengthCommit = () => {
    const frames = parseTime(lengthInput, comp.fps);
    if (!isNaN(frames) && frames > 0) {
      motionActions.setComp({ dur: frames });
    } else {
      setLengthInput(timecode(comp.dur, comp.fps));
    }
  };

  const handleLayerSelect = (id: string) => {
    useSelectionStore.getState().select(id, "element");
  };

  const handleAddMarker = () => {
    motionActions.addMarker(playhead);
  };

  const animatedLayers = comp.layers.filter((l) => !isGrp(l) || l.tr.length > 0);

  return (
    <div
      className={`ll-comp-inspector ll:flex ll:flex-col ll:w-full ll:bg-surface-panel ll:box-border ll:select-none ${className}`}
    >
      {/* Header: Film icon + "Timeline" */}
      <div className="ll-rtop ll:flex ll:items-center ll:gap-2 ll:px-4 ll:h-11 ll:border-b ll:border-border ll:shrink-0 ll:min-w-0">
        <Icon icon={Film} size={16} className="ll-rico ll:text-muted ll:shrink-0" />
        <span className="ll-rname ll:text-heading ll:font-semibold ll:text-primary ll:truncate">
          Timeline
        </span>
      </div>

      {/* 1. Composition Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border ll:first:border-t-0">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Composition</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {/* Length */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Length
            </span>
            <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
              <input
                type="text"
                aria-label="Composition length"
                value={lengthInput}
                onChange={(e) => setLengthInput(e.target.value)}
                onBlur={handleLengthCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLengthCommit();
                }}
                className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
              />
            </div>
          </div>

          {/* Frame rate */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Frame rate
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Select
                size="sm"
                aria-label="Frame rate"
                value={String(comp.fps)}
                onChange={handleFpsChange}
                options={FPS_OPTIONS}
              />
            </div>
          </div>

          {/* Loop */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Loop
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <SegmentedControl
                size="sm"
                ariaLabel="Loop"
                value={loopValue}
                onChange={handleLoopChange}
                options={LOOP_OPTIONS}
              />
            </div>
          </div>

          {/* Speed */}
          <div className="ll-dtrow ll:flex ll:items-center ll:gap-2">
            <span className="ll-dlbl ll:w-20 ll:shrink-0 ll:text-micro ll:font-medium ll:text-muted">
              Speed
            </span>
            <div className="ll:flex-1 ll:min-w-0">
              <Select
                size="sm"
                aria-label="Playback speed"
                value={String(speed)}
                onChange={handleSpeedChange}
                options={SPEED_OPTIONS}
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
                aria-label="Default easing"
                value={defaultEase}
                onChange={(val) => setDefaultEase(val as EaseName)}
                options={EASING_OPTIONS}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Animated layers Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Animated layers</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-1">
          <div className="ll-ktr">
            {animatedLayers.map((l) => {
              const dur = layerLength(l);
              const clipText = `${l.clips.length} ${l.clips.length === 1 ? "clip" : "clips"} · ${timecode(dur, comp.fps)}`;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleLayerSelect(l.id)}
                  className="ll-ktrk"
                >
                  <span className="ll:text-micro ll:font-medium">{layerName(l.id)}</span>
                  <span className="ll:font-mono ll:text-micro ll:text-muted">{clipText}</span>
                </button>
              );
            })}
          </div>

          {animatedLayers.length === 0 && (
            <div className="ll:text-micro ll:text-muted ll:py-1">
              Nothing is animated yet. Add a fade to the selected layer to start.
            </div>
          )}
        </div>
      </section>

      {/* 3. Markers Section */}
      <section className="ll-dsec ll:flex ll:flex-col ll:gap-2 ll:px-4 ll:py-3 ll:border-t ll:border-border">
        <div className="ll-dtitle ll:flex ll:items-center ll:gap-2 ll:min-h-6">
          <h3 className="ll:text-body ll:font-medium ll:text-primary ll:m-0">Markers</h3>
        </div>
        <div className="ll-dbody ll:flex ll:flex-col ll:gap-2">
          {comp.markers.map((m) => (
            <div key={m.id} className="ll:flex ll:items-center ll:gap-1.5">
              <button
                type="button"
                onClick={() => motionActions.setPlayhead(m.t)}
                title="Go to marker"
                className="ll:h-7 ll:w-18 ll:shrink-0 ll:px-2 ll:border ll:border-border ll:rounded-sm ll:font-mono ll:text-micro ll:text-primary ll:hover:bg-surface-bar ll:transition-colors"
              >
                {timecode(m.t, comp.fps)}
              </button>
              <div className="ll-dfield ll:flex ll:items-center ll:gap-2 ll:h-7 ll:px-2 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm ll:flex-1 ll:min-w-0">
                <input
                  type="text"
                  aria-label="Marker name"
                  value={m.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const nextMarkers = comp.markers.map((x) => (x.id === m.id ? { ...x, name } : x));
                    motionActions.setComp({ markers: nextMarkers });
                  }}
                  className="ll:bg-transparent ll:border-0 ll:outline-none ll:flex-1 ll:min-w-0 ll:font-mono ll:text-micro ll:text-primary ll:p-0"
                />
              </div>
              <button
                type="button"
                onClick={() => motionActions.deleteMarker(m.id)}
                aria-label={`Delete ${m.name}`}
                title="Delete marker"
                className="ll:size-7 ll:grid ll:place-items-center ll:text-muted ll:hover:text-primary ll:transition-colors"
              >
                <Icon icon={X} size={14} />
              </button>
            </div>
          ))}

          {comp.markers.length === 0 && (
            <div className="ll:text-micro ll:text-muted ll:py-1">No markers.</div>
          )}

          <button
            type="button"
            onClick={handleAddMarker}
            className="ll:h-7 ll:w-full ll:px-2.5 ll:border ll:border-border ll:rounded-sm ll:text-micro ll:font-medium ll:text-secondary ll:whitespace-nowrap ll:hover:bg-surface-bar ll:hover:text-primary ll:transition-colors"
          >
            Add marker at playhead
          </button>
        </div>
      </section>
    </div>
  );
};

export default CompositionInspector;
