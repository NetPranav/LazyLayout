/**
 * Image sequences (Design track D13): a picture that is a sheet of frames, `cols` x `rows`, shown one frame at a time. One
 * file means one request and one budget, the frame is a `background-position` (so the kernel, a driver and the export all
 * set it the same way), and nothing needs preloading beyond the sheet itself.
 *
 * Pure: no page access. Used by the image renderer, the kernel's style writes and the export's script.
 */
export interface SequenceGrid {
  cols: number;
  rows: number;
  /** Frames the sheet holds (<= cols x rows). */
  frames: number;
}

type Read = (path: string) => unknown;
const whole = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

/** The sheet's grid, or null when the layer is an ordinary picture (no columns or rows set). */
export function sequenceGrid(read: Read): SequenceGrid | null {
  const cols = whole(read("sequence.cols"));
  const rows = whole(read("sequence.rows"));
  if (cols < 1 || rows < 1) return null;
  const asked = whole(read("sequence.frames"));
  const frames = asked > 0 ? Math.min(asked, cols * rows) : cols * rows;
  return { cols, rows, frames };
}

/** The frame number shown for a value: rounded to the nearest, and held at the first and last. */
export const frameIndex = (grid: SequenceGrid, value: unknown): number => {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(grid.frames - 1, Math.max(0, Math.round(v)));
};

/** `background-position` that shows frame `value` (a sheet is read left to right, top to bottom). */
export function sequencePosition(grid: SequenceGrid, value: unknown): string {
  const i = frameIndex(grid, value);
  const col = i % grid.cols;
  const row = Math.floor(i / grid.cols);
  const x = grid.cols > 1 ? (col / (grid.cols - 1)) * 100 : 0;
  const y = grid.rows > 1 ? (row / (grid.rows - 1)) * 100 : 0;
  return `${+x.toFixed(4)}% ${+y.toFixed(4)}%`;
}

/** `background-size` that makes one cell fill the layer's box. */
export const sequenceSize = (grid: SequenceGrid): string => `${grid.cols * 100}% ${grid.rows * 100}%`;

/** The frames' value from a driver's range: `frames - 1` at the end. */
export const lastFrame = (grid: SequenceGrid): number => grid.frames - 1;

export const SCRUB_NAME = "Scrub frames";

/**
 * One driver that plays the sheet as `section` scrolls through the screen (0 as it enters at the bottom, 1 as it leaves at the
 * top): frame 0 to the last. Written in the binding grammar's own shape, so the engine, the export and the code view read it.
 */
export function scrubDraft(layerId: string, section: string, grid: SequenceGrid) {
  return {
    expr: {
      signal: { kind: "view" as const, layer: section, channel: "progress" as const },
      operators: [{ op: "remap" as const, inMin: 0, inMax: 1, outMin: 0, outMax: lastFrame(grid), clamp: true }],
    },
    target: { kind: "property" as const, on: { kind: "layer" as const, ref: layerId }, path: "sequence.frame" },
    /** Added to the layer's own Frame (0 unless set), which is how the export applies a driver too. */
    blend: "add" as const,
  };
}
