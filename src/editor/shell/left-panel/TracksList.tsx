"use client";

import React from "react";
import type { TrackItem } from "./types";

export interface TracksListProps {
  tracks: TrackItem[];
  selectedTrackId?: string;
  onSelectTrack?: (id: string) => void;
  height?: number | string;
}

export const TracksList: React.FC<TracksListProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  height = "var(--ll-size-bottom-motion-h)",
}) => {
  return (
    <div
      id="p-tracks"
      style={{ height }}
      className="tracks ll:flex ll:flex-col ll:border-t ll:border-border ll:shrink-0 ll:mt-auto ll:overflow-hidden ll:bg-surface-panel"
    >
      <div className="zhead ll:h-header ll:flex ll:items-center ll:px-4 ll:shrink-0 ll:border-b ll:border-border">
        <span className="micro ll:text-body ll:font-medium ll:text-primary ll:tracking-normal">
          Tracks
        </span>
      </div>

      <div
        role="listbox"
        aria-label="Tracks"
        className="trows ll:flex-1 ll:min-h-0 ll:overflow-y-auto"
      >
        {tracks.map((track) => {
          const isSelected = track.id === selectedTrackId || Boolean(track.selected);
          return (
            <button
              key={track.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-sel={track.id}
              onClick={() => onSelectTrack?.(track.id)}
              className={`row trow ll:w-full ll:h-row ll:px-4 ll:flex ll:items-center ll:text-left ll:text-small ll:truncate ll:cursor-pointer ll:select-none ll:transition-none ll:outline-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset ${
                isSelected
                  ? "ll:bg-select-bg ll:text-select-fg"
                  : "ll:text-secondary ll:hover:bg-surface-hover ll:hover:text-primary"
              }`}
            >
              <span className="nm ll:truncate">{track.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
