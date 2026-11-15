"use client";
import React from "react";
import { useStore } from "zustand";
import { Button } from "@/editor/components/Button";
import { NumberField } from "@/editor/components/NumberField";
import { documentStore } from "@/core/store/documentState";
import { bindingsOf, removeBinding, setDriversNamed } from "@/core/bindings/bindingCommands";
import { SCRUB_NAME, scrubDraft, sequenceGrid } from "@/core/render/sequence";
import { OptionRow } from "../options/OptionRow";
import type { InspectorSectionProps } from "../types";

/**
 * Image sequence (Design track D13, Main 188): the picture is a sheet of frames in a grid. Set the columns and rows, then
 * Scrub with scroll plays the frames as the section the picture sits in scrolls through the screen. For the Apple-style
 * sticky canvas, give the section its tall height and pin the picture in Scroll. One file, so one request and one size budget.
 */
export const SequenceSection: React.FC<InspectorSectionProps> = ({ selectedId, isMulti, layer, getValue, onUpdateProp, className = "" }) => {
  useStore(documentStore, (s) => s.document.bindings); // re-read when the driver changes
  if (!selectedId || isMulti || layer?.archetype !== "image") return null;
  const num = (path: string) => {
    const v = getValue?.(path);
    return typeof v === "number" ? v : 0;
  };
  const grid = sequenceGrid((p) => getValue?.(p));
  const mine = bindingsOf(selectedId).find((b) => b.name === SCRUB_NAME);
  const set = (path: string, v: number, max: number) => onUpdateProp?.(path, Math.min(max, Math.max(0, Math.round(v))));
  return (
    <div className={`ll-dbody ll:flex ll:flex-col ll:gap-1.5 ll:-mx-1 ${className}`} data-testid="sequence-section">
      <OptionRow label="Sheet">
        <div className="ll:grid ll:grid-cols-2 ll:gap-1.5 ll:w-full">
          <NumberField size="sm" aria-label="Sequence columns" title="How many frames across the picture. 0 makes it an ordinary picture." value={num("sequence.cols")} min={0} step={1} precision={0} onChange={(v) => set("sequence.cols", v, 64)} />
          <NumberField size="sm" aria-label="Sequence rows" title="How many frames down the picture." value={num("sequence.rows")} min={0} step={1} precision={0} onChange={(v) => set("sequence.rows", v, 64)} />
        </div>
      </OptionRow>
      <OptionRow label="Frames">
        <NumberField size="sm" aria-label="Sequence frames" title="How many frames the sheet holds, when the last row is short. 0 counts every cell." value={num("sequence.frames")} min={0} step={1} precision={0} onChange={(v) => set("sequence.frames", v, 4096)} />
      </OptionRow>
      {grid ? (
        <>
          <OptionRow label="Frame">
            <NumberField size="sm" aria-label="Sequence frame" title={`The frame shown, 0 to ${grid.frames - 1}. A driver or a keyframe can move it.`} value={num("sequence.frame")} min={0} max={grid.frames - 1} step={1} precision={0} onChange={(v) => set("sequence.frame", v, grid.frames - 1)} />
          </OptionRow>
          <Button
            size="sm"
            aria-label={mine ? "Stop scrubbing with scroll" : "Scrub with scroll"}
            onClick={() => {
              if (mine) removeBinding(mine.id);
              else {
                const section = layer.parentId;
                if (section) setDriversNamed(selectedId, SCRUB_NAME, [scrubDraft(selectedId, section, grid)], "Scrub frames with scroll");
              }
            }}
          >
            {mine ? "Stop scrubbing with scroll" : "Scrub with scroll"}
          </Button>
          <p className="ll:m-0 ll:text-micro ll:text-muted" role="note">
            Plays frame 0 to {grid.frames - 1} while the picture&apos;s section scrolls through the screen (shown in Motion and Preview).
          </p>
        </>
      ) : (
        <p className="ll:m-0 ll:text-micro ll:text-muted" role="note">
          Put a sheet of frames in the picture, then set its columns and rows.
        </p>
      )}
    </div>
  );
};
