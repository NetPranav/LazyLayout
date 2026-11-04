"use client";

import React, { useState } from "react";

import { AlignBar } from "@/editor/panels/details/controls/AlignBar";
import { AlignmentGrid } from "@/editor/panels/details/controls/AlignmentGrid";
import { EasingCurveBox } from "@/editor/panels/details/controls/EasingCurveBox";
import { RepeatableRow } from "@/editor/panels/details/controls/RepeatableRow";
import { RowSettingsPopover } from "@/editor/panels/details/controls/RowSettingsPopover";
import { NumberField } from "@/editor/components/NumberField";
import { ColorSwatchField } from "@/editor/components/ColorSwatchField";
import { Button } from "@/editor/components/Button";
import { TimelineTransport } from "@/editor/panels/timeline/TimelineTransport";
import { TimelineRuler } from "@/editor/panels/timeline/TimelineRuler";
import { TimelineLane } from "@/editor/panels/timeline/TimelineLane";
import { TimelinePlayhead } from "@/editor/panels/timeline/TimelinePlayhead";
import { TimelineCurveGraph } from "@/editor/panels/timeline/TimelineCurveGraph";
import { CodePanel } from "@/editor/panels/code-view/CodePanel";
import { ConsoleView } from "@/editor/panels/code-view/ConsoleView";
import { CodeInspector } from "@/editor/panels/code-view/CodeInspector";
import type { TimelineTrack } from "@/editor/panels/timeline/types";

/* =========================================================================
   1. INSPECTOR CONTROLS DEMO
   ========================================================================= */
export function InspectorControlsDemo() {
  const [gridIndex, setGridIndex] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(4);
  const [curve, setCurve] = useState({ name: "Custom", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
  const [_rowOpen, _setRowOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [swatchHex, setSwatchHex] = useState("#CEB4F5");
  const [swatchOpacity, setSwatchOpacity] = useState(100);
  const [numVal, setNumVal] = useState<number | null>(340);
  const [boxValues, setBoxValues] = useState({ t: 16, r: 24, b: 16, l: 24 });

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Inspector Controls</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          AlignBar, AlignmentGrid, EasingCurveBox, RepeatableRow, RowSettingsPopover &amp; Section Fields
        </span>
      </div>

      <div className="ll:grid ll:grid-cols-1 ll:md:grid-cols-2 ll:gap-6">
        {/* AlignBar */}
        <div className="ll:flex ll:flex-col ll:gap-3">
          <span className="ll:text-small ll:font-semibold ll:text-primary">AlignBar (Toolbar of 9 Geometry Actions)</span>
          <div className="ll:bg-surface-panel ll:p-3 ll:border ll:border-border ll:rounded-md ll:inline-flex">
            <AlignBar
              isMulti={true}
              onAlign={() => {}}
              onDistribute={() => {}}
              onTidy={() => {}}
            />
          </div>
        </div>

        {/* AlignmentGrid */}
        <div className="ll:flex ll:flex-col ll:gap-3">
          <span className="ll:text-small ll:font-semibold ll:text-primary">AlignmentGrid (3×3 Position Matrix)</span>
          <div className="ll:bg-surface-panel ll:p-3 ll:border ll:border-border ll:rounded-md ll:inline-flex ll:items-center ll:gap-4">
            <AlignmentGrid
              selectedIndex={gridIndex}
              onChange={(idx) => setGridIndex(idx)}
            />
            <span className="ll:text-small ll:text-secondary">
              Selected Cell: <strong className="ll:text-primary">{gridIndex}</strong>
            </span>
          </div>
        </div>

        {/* EasingCurveBox */}
        <div className="ll:flex ll:flex-col ll:gap-3 ll:md:col-span-2">
          <span className="ll:text-small ll:font-semibold ll:text-primary">EasingCurveBox (Interactive SVG Bezier Editor)</span>
          <div className="ll:bg-surface-panel ll:p-4 ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-4 ll:max-w-md">
            <EasingCurveBox
              curve={curve}
              onChange={setCurve}
            />
            <div className="ll:text-micro ll:font-mono ll:text-secondary">
              cubic-bezier({curve.x1}, {curve.y1}, {curve.x2}, {curve.y2})
            </div>
          </div>
        </div>

        {/* RepeatableRow & Settings Popover */}
        <div className="ll:flex ll:flex-col ll:gap-3 ll:md:col-span-2">
          <span className="ll:text-small ll:font-semibold ll:text-primary">RepeatableRow (Reorder Grip, Lead Swatch &amp; Settings Popover)</span>
          <div className="ll:bg-surface-panel ll:p-4 ll:border ll:border-border ll:rounded-md ll:flex ll:flex-col ll:gap-3 ll:max-w-lg">
            <RepeatableRow
              id="row-fill-1"
              isOpen={popoverOpen}
              onOpenSettings={() => setPopoverOpen((p) => !p)}
              onToggleHide={() => {}}
              onRemove={() => {}}
              leadContent={
                <div
                  style={{ backgroundColor: swatchHex }}
                  className="ll:w-5 ll:h-5 ll:rounded-sm ll:border ll:border-swatch-line"
                />
              }
              summaryContent={
                <div className="ll:flex ll:items-center ll:gap-2 ll:flex-1">
                  <span className="ll:text-micro ll:font-mono ll:text-primary">{swatchHex}</span>
                  <span className="ll:text-micro ll:text-secondary">{swatchOpacity}%</span>
                </div>
              }
            />

            {popoverOpen && (
              <RowSettingsPopover
                title="Fill Settings"
                isOpen={popoverOpen}
                onClose={() => setPopoverOpen(false)}
              >
                <div className="ll:flex ll:flex-col ll:gap-3">
                  <ColorSwatchField
                    hex={swatchHex}
                    opacity={swatchOpacity}
                    onChangeHex={setSwatchHex}
                    onChangeOpacity={setSwatchOpacity}
                    label="Fill Color"
                  />
                </div>
              </RowSettingsPopover>
            )}
          </div>
        </div>

        {/* Section Field Kinds */}
        <div className="ll:flex ll:flex-col ll:gap-3 ll:md:col-span-2">
          <span className="ll:text-small ll:font-semibold ll:text-primary">Inspector Field Kinds (Scrub Fields &amp; 4-Way Inset Box)</span>
          <div className="ll:bg-surface-panel ll:p-4 ll:border ll:border-border ll:rounded-md ll:grid ll:grid-cols-1 ll:sm:grid-cols-3 ll:gap-4">
            <div className="ll:flex ll:flex-col ll:gap-1.5">
              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:text-secondary">Number Scrub Field</span>
              <NumberField
                label="W"
                value={numVal}
                onChange={setNumVal}
                suffix="px"
              />
            </div>

            <div className="ll:flex ll:flex-col ll:gap-1.5">
              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:text-secondary">Hex Color Field</span>
              <ColorSwatchField
                hex={swatchHex}
                opacity={swatchOpacity}
                onChangeHex={setSwatchHex}
                onChangeOpacity={setSwatchOpacity}
              />
            </div>

            <div className="ll:flex ll:flex-col ll:gap-1.5">
              <span className="ll:text-micro ll:font-semibold ll:uppercase ll:text-secondary">4-Way Padding Box (T R B L)</span>
              <div className="ll:grid ll:grid-cols-4 ll:gap-1">
                <NumberField label="T" value={boxValues.t} onChange={(v) => setBoxValues((b) => ({ ...b, t: v }))} />
                <NumberField label="R" value={boxValues.r} onChange={(v) => setBoxValues((b) => ({ ...b, r: v }))} />
                <NumberField label="B" value={boxValues.b} onChange={(v) => setBoxValues((b) => ({ ...b, b: v }))} />
                <NumberField label="L" value={boxValues.l} onChange={(v) => setBoxValues((b) => ({ ...b, l: v }))} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. TIMELINE DEMO
   ========================================================================= */
const SAMPLE_TRACK: TimelineTrack = {
  id: "track-opacity",
  name: "Hero Text",
  property: "opacity",
  keyframes: [
    { id: "kf1", time: 0, value: 0, ease: "linear" },
    { id: "kf2", time: 0.6, value: 1, ease: "power2.out" },
    { id: "kf3", time: 1.4, value: 0.8, ease: "power2.out" },
  ],
};

export function TimelineDemo() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [_currentTime, setCurrentTime] = useState(0.6);
  const [selectedKfId, setSelectedKfId] = useState<string | null>("kf2");
  const [viewMode, setViewMode] = useState<"tracks" | "graph">("tracks");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Timeline</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Motion Panel Transport, Ruler, Lanes, Playhead Scrub &amp; Curve Graph Editor
        </span>
      </div>

      <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:overflow-hidden ll:flex ll:flex-col">
        {/* 1. Transport Bar */}
        <TimelineTransport
          isPlaying={isPlaying}
          isLooping={true}
          currentTimeFormatted="00:00:18"
          durationFormatted="00:02:00"
          viewMode={viewMode}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onStop={() => setIsPlaying(false)}
          onStepBack={() => setCurrentTime((t) => Math.max(0, t - 0.1))}
          onStepForward={() => setCurrentTime((t) => Math.min(2, t + 0.1))}
          onToggleLoop={() => {}}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onToggleGraph={() => setViewMode((m) => (m === "tracks" ? "graph" : "tracks"))}
        />

        {/* 2. Timeline Body */}
        {viewMode === "tracks" ? (
          <div className="ll:relative ll:h-48 ll:bg-surface-bar ll:overflow-hidden ll:flex ll:flex-col">
            {/* Ruler */}
            <div className="ll:h-6 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0">
              <TimelineRuler
                duration={2}
                pixelsPerSecond={200}
                contentWidth={600}
                onSeek={setCurrentTime}
              />
            </div>

            {/* Lane */}
            <div className="ll:flex-1 ll:relative">
              <TimelineLane
                track={SAMPLE_TRACK}
                pixelsPerSecond={200}
                contentWidth={600}
                duration={2}
                isSelectedTrack={true}
                selectedKeyframeId={selectedKfId}
                onSelectTrack={() => {}}
                onSelectKeyframe={setSelectedKfId}
                onUpdateKeyframeTime={() => {}}
                onAddKeyframe={() => {}}
                onSeek={setCurrentTime}
              />

              {/* Playhead */}
              <TimelinePlayhead
                duration={2}
                pixelsPerSecond={200}
                onSeek={setCurrentTime}
              />
            </div>
          </div>
        ) : (
          <div className="ll:h-64 ll:bg-surface-panel">
            <TimelineCurveGraph
              onClose={() => setViewMode("tracks")}
              onApplyEase={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   3. CODE VIEW DEMO
   ========================================================================= */
export function CodeViewDemo() {
  const [activeTab, setActiveTab] = useState<"code" | "console" | "inspector">("code");

  return (
    <div className="ll:flex ll:flex-col ll:gap-8">
      <div>
        <h1 className="ll:text-title ll:font-semibold ll:text-primary ll:font-sans">Code View &amp; Console</h1>
        <span className="ll:text-micro ll:font-semibold ll:uppercase ll:tracking-wider ll:text-secondary">
          Code Preview with Line Numbers, Live Diagnostics Console &amp; Code Inspector
        </span>
      </div>

      <div className="ll:flex ll:items-center ll:gap-3">
        <Button
          variant={activeTab === "code" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setActiveTab("code")}
        >
          Code Editor View
        </Button>
        <Button
          variant={activeTab === "console" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setActiveTab("console")}
        >
          Live Diagnostics Console
        </Button>
        <Button
          variant={activeTab === "inspector" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setActiveTab("inspector")}
        >
          Code Inspector Properties
        </Button>
      </div>

      <div className="ll:rounded-md ll:border ll:border-border ll:bg-surface-panel ll:h-80 ll:overflow-hidden ll:flex ll:flex-col">
        {activeTab === "code" && (
          <CodePanel
            activeTab="code"
            onTabChange={() => {}}
          />
        )}

        {activeTab === "console" && (
          <ConsoleView />
        )}

        {activeTab === "inspector" && (
          <div className="ll:p-4 ll:overflow-y-auto">
            <CodeInspector />
          </div>
        )}
      </div>
    </div>
  );
}
