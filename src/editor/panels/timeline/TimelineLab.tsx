"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, RotateCcw } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { IconButton } from "@/editor/components/IconButton";
import { TracksList } from "@/editor/shell/left-panel/TracksList";
import { TimelinePanel } from "./TimelinePanel";
import { DEFAULT_SAMPLE_TRACKS } from "./constants";
import type { TimelineTrack } from "./types";

export function TimelineLab() {
  const [theme, setTheme] = useState<"paper" | "dark" | "warm" | "lilac" | "white">("paper");
  const [tracks, setTracks] = useState<TimelineTrack[]>(() =>
    DEFAULT_SAMPLE_TRACKS.map((t) => ({
      ...t,
      keyframes: [...t.keyframes],
      clip: t.clip ? { ...t.clip } : undefined,
    }))
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string>("headline");
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>("kf-2");
  const [lastAction, setLastAction] = useState<string>("Initial state loaded");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "paper" ? "dark" : "paper"));
  };

  const handleSelectTrack = (trackId: string) => {
    setSelectedTrackId(trackId);
    setLastAction(`Selected track: ${trackId}`);
  };

  const handleSelectKeyframe = (kfId: string | null, trackId?: string) => {
    setSelectedKeyframeId(kfId);
    if (trackId) setSelectedTrackId(trackId);
    setLastAction(kfId ? `Selected keyframe: ${kfId}` : "Deselected keyframe");
  };

  const handleAddKeyframe = (trackId: string, time: number) => {
    const newId = `kf-${Date.now()}`;
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        const newKf = {
          id: newId,
          time,
          value: "default",
          ease: "power2.out",
        };
        return {
          ...t,
          keyframes: [...t.keyframes, newKf].sort((a, b) => a.time - b.time),
        };
      })
    );
    setSelectedKeyframeId(newId);
    setLastAction(`Added keyframe on ${trackId} at ${time.toFixed(2)}s`);
  };

  const handleUpdateKeyframeTime = (trackId: string, kfId: string, time: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          keyframes: t.keyframes
            .map((k) => (k.id === kfId ? { ...k, time } : k))
            .sort((a, b) => a.time - b.time),
        };
      })
    );
    setLastAction(`Retimed keyframe ${kfId} on ${trackId} to ${time.toFixed(2)}s`);
  };

  const handleDeleteKeyframe = (trackId: string, kfId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          keyframes: t.keyframes.filter((k) => k.id !== kfId),
        };
      })
    );
    if (selectedKeyframeId === kfId) setSelectedKeyframeId(null);
    setLastAction(`Deleted keyframe ${kfId} from ${trackId}`);
  };

  const handleSlideClip = (trackId: string, deltaSec: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId || !t.clip) return t;
        const nextStart = Math.max(0, t.clip.start + deltaSec);
        return {
          ...t,
          clip: { ...t.clip, start: nextStart },
        };
      })
    );
    setLastAction(`Slid clip on ${trackId} by ${deltaSec.toFixed(2)}s`);
  };

  const resetSampleData = () => {
    setTracks(
      DEFAULT_SAMPLE_TRACKS.map((t) => ({
        ...t,
        keyframes: [...t.keyframes],
        clip: t.clip ? { ...t.clip } : undefined,
      }))
    );
    setSelectedTrackId("headline");
    setSelectedKeyframeId("kf-2");
    setLastAction("Reset to sample data");
  };

  const tracksForLeftPanel = tracks.map((t) => ({
    id: t.id,
    name: t.name,
    selected: t.id === selectedTrackId,
  }));

  return (
    <div className="editor-root ll-lab-root ll:flex ll:flex-col ll:items-center ll:justify-start ll:min-h-screen ll:bg-surface-backdrop ll:p-6 ll:font-sans ll:select-none">
      {/* Verification Header & Controls */}
      <div className="ll:w-full ll:max-w-7xl ll:flex ll:items-center ll:justify-between ll:mb-4 ll:px-4 ll:py-3 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-soft">
        <div className="ll:flex ll:items-center ll:gap-4">
          <div>
            <span className="ll:text-title ll:font-semibold ll:text-primary ll:block">
              Timeline Workstation Lab (Motion Mode)
            </span>
            <span className="ll:text-micro ll:text-muted">
              Height token: --ll-size-bottom-motion-h (260px) · Apple-level layout · Concentric alignment
            </span>
          </div>

          <div className="ll:flex ll:items-center ll:gap-1.5 ll:bg-surface-bar ll:px-2 ll:py-1 ll:rounded-sm ll:border ll:border-border">
            <span className="ll:text-micro ll:font-medium ll:text-muted">Theme:</span>
            {(["paper", "dark", "warm", "lilac", "white"] as const).map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setTheme(th)}
                className={`ll:px-2 ll:py-0.5 ll:rounded-xs ll:text-micro ll:font-medium ll:capitalize ll:transition-none ${
                  theme === th
                    ? "ll:bg-control-primary ll:text-control-primary-fg"
                    : "ll:text-secondary ll:hover:text-primary"
                }`}
              >
                {th}
              </button>
            ))}
          </div>
        </div>

        <div className="ll:flex ll:items-center ll:gap-2">
          <Button variant="ghost" size="sm" onClick={resetSampleData} leftIcon={<Icon icon={RotateCcw} size={13} />}>
            Reset State
          </Button>
          <IconButton
            size="md"
            variant="ghost"
            aria-label="Toggle theme"
            tooltip={`Switch to ${theme === "paper" ? "dark" : "paper"}`}
            onClick={toggleTheme}
            icon={<Icon icon={theme === "paper" ? Moon : Sun} size={15} />}
          />
        </div>
      </div>

      {/* Frame 1440 x 900 Simulation Frame */}
      <div
        id="lab-frame"
        className="ll:w-viewport-desktop ll:h-160 ll-lab-frame ll:bg-surface-canvas ll:border ll:border-border ll:rounded-lg ll:shadow-soft ll:flex ll:flex-col ll:overflow-hidden ll:relative"
      >
        {/* Canvas area (mock canvas above timeline) */}
        <div className="ll:flex-1 ll:flex ll:items-center ll:justify-center ll:p-8 ll:relative ll:bg-surface-canvas">
          <div className="ll:text-center ll:max-w-md">
            <span className="ll:text-micro ll:uppercase ll:tracking-wider ll:text-muted ll:block ll:mb-1">
              Canvas Stage (Motion Preview)
            </span>
            <h1 className="ll:text-display ll:font-bold ll:text-primary ll:tracking-tight ll:mb-2">
              Design it once. Ship it lazily.
            </h1>
            <p className="ll:text-body ll:text-secondary ll:mb-4">
              Motion sequencer workstation aligned with left tracks panel. Click play, drag diamonds to retime, or scrub the ruler.
            </p>
            <div className="ll:inline-flex ll:items-center ll:gap-3">
              <span className="ll:px-3 ll:py-1.5 ll:bg-control-primary ll:text-control-primary-fg ll:rounded-sm ll:text-small ll:font-medium">
                Get started
              </span>
              <span className="ll:text-micro ll:font-mono ll:text-muted">
                Status: {lastAction}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Motion Area: Left Tracks list + Right TimelinePanel */}
        <div
          style={{ height: "var(--ll-size-bottom-motion-h)" }}
          className="ll:flex ll:w-full ll:border-t ll:border-border ll:bg-surface-panel"
        >
          {/* Left Panel Tracks Section (248px) */}
          <div
            style={{ width: "var(--ll-size-panel-left-w)" }}
            className="ll:shrink-0 ll:border-r ll:border-border"
          >
            <TracksList
              tracks={tracksForLeftPanel}
              selectedTrackId={selectedTrackId}
              onSelectTrack={handleSelectTrack}
              height="100%"
            />
          </div>

          {/* TimelinePanel (fills remaining width) */}
          <div className="ll:flex-1 ll:min-w-0">
            <TimelinePanel
              tracks={tracks}
              selectedTrackId={selectedTrackId}
              onSelectTrack={handleSelectTrack}
              selectedKeyframeId={selectedKeyframeId}
              onSelectKeyframe={handleSelectKeyframe}
              onAddKeyframe={handleAddKeyframe}
              onUpdateKeyframeTime={handleUpdateKeyframeTime}
              onDeleteKeyframe={handleDeleteKeyframe}
              onSlideClip={handleSlideClip}
              height="100%"
              onExport={() => setLastAction("Triggered animation export")}
              onOpenPresets={() => setLastAction("Opened animation presets")}
            />
          </div>
        </div>
      </div>

      {/* Verification Legend & Shortcut Guide */}
      <div className="ll:w-full ll:max-w-7xl ll:grid ll:grid-cols-3 ll:gap-4 ll:mt-4">
        <div className="ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <span className="ll:text-small ll:font-semibold ll:text-primary ll:block ll:mb-1">
            Aligned Geometry
          </span>
          <p className="ll:text-small ll:text-secondary">
            Header height is exactly 44px (token --ll-size-header-h) across both panels. Each track lane is exactly 32px (token --ll-size-row-h) aligned 1:1 with the left panel.
          </p>
        </div>

        <div className="ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <span className="ll:text-small ll:font-semibold ll:text-primary ll:block ll:mb-1">
            Keyboard Shortcuts
          </span>
          <p className="ll:text-small ll:text-secondary">
            <kbd className="ll:px-1 ll:py-0.5 ll:bg-surface-bar ll:rounded-xs ll:font-mono ll:text-micro">Space</kbd> Play/Pause ·{" "}
            <kbd className="ll:px-1 ll:py-0.5 ll:bg-surface-bar ll:rounded-xs ll:font-mono ll:text-micro">Home</kbd> Rewind ·{" "}
            <kbd className="ll:px-1 ll:py-0.5 ll:bg-surface-bar ll:rounded-xs ll:font-mono ll:text-micro">← / →</kbd> Step frame ·{" "}
            <kbd className="ll:px-1 ll:py-0.5 ll:bg-surface-bar ll:rounded-xs ll:font-mono ll:text-micro">Delete</kbd> Remove keyframe
          </p>
        </div>

        <div className="ll:p-4 ll:bg-surface-panel ll:border ll:border-border ll:rounded-md">
          <span className="ll:text-small ll:font-semibold ll:text-primary ll:block ll:mb-1">
            Scheduler Driven
          </span>
          <p className="ll:text-small ll:text-secondary">
            Playhead needle is updated via the single frameScheduler loop (render phase) without React re-renders.
          </p>
        </div>
      </div>
    </div>
  );
}
