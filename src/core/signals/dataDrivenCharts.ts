/**
 * @file dataDrivenCharts.ts
 * @module core/signals/dataDrivenCharts
 * @description Phase 156: CSV/JSON/collection table parsing, data-driven clone
 * property binding, and bar/line/area/pie/donut chart shape geometry generation with
 * deterministic animated transitions on data updates (stage & export parity).
 */

export type DataCellValue = string | number | boolean;

export type DataTableRow = Readonly<Record<string, DataCellValue>>;

export interface DataTable {
  readonly headers: readonly string[];
  readonly rows: readonly DataTableRow[];
}

export type ChartKind = "bar" | "line" | "area" | "pie" | "donut";

export interface ChartLayoutSpec {
  readonly width: number;
  readonly height: number;
  readonly labelColumn: string;
  readonly valueColumn: string;
  readonly maxValue?: number;
  readonly gapPx?: number;
  readonly donutInnerRatio?: number;
}

export interface BarShapeItem {
  readonly index: number;
  readonly label: string;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LinePointItem {
  readonly index: number;
  readonly label: string;
  readonly value: number;
  readonly x: number;
  readonly y: number;
}

export interface PieSliceItem {
  readonly index: number;
  readonly label: string;
  readonly value: number;
  readonly fraction: number;
  readonly startAngleDeg: number;
  readonly endAngleDeg: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly svgPath: string;
}

export type BuiltChartModel =
  | { readonly kind: "bar"; readonly maxValue: number; readonly bars: readonly BarShapeItem[] }
  | { readonly kind: "line" | "area"; readonly maxValue: number; readonly points: readonly LinePointItem[]; readonly svgPath: string }
  | { readonly kind: "pie" | "donut"; readonly total: number; readonly slices: readonly PieSliceItem[] };

function coerceCell(raw: string): DataCellValue {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** Parses a CSV string with headers into a typed `DataTable`. */
export function parseCsvDataTable(csv: string): DataTable {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const rows: DataTableRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]!);
    const obj: Record<string, DataCellValue> = {};
    headers.forEach((h, i) => {
      obj[h] = coerceCell(cells[i] ?? "");
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** Parses a JSON array (or JSON string) into a `DataTable`. */
export function parseJsonDataTable(
  input: string | readonly Readonly<Record<string, unknown>>[],
): DataTable {
  const parsed: unknown = typeof input === "string" ? JSON.parse(input) : input;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { headers: [], rows: [] };
  }
  const headerSet = new Set<string>();
  for (const row of parsed) {
    if (row && typeof row === "object") {
      for (const k of Object.keys(row)) headerSet.add(k);
    }
  }
  const headers = [...headerSet];
  const rows: DataTableRow[] = parsed.map((row) => {
    const obj: Record<string, DataCellValue> = {};
    const rec = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    for (const h of headers) {
      const v = rec[h];
      obj[h] = typeof v === "number" || typeof v === "boolean" || typeof v === "string" ? v : String(v ?? "");
    }
    return obj;
  });
  return { headers, rows };
}

/** Binds data table rows directly into clone/layer property overrides. */
export function bindRowsToCloneProperties(
  table: DataTable,
  propertyMap: Readonly<Record<string, string>>,
): readonly Readonly<Record<string, DataCellValue>>[] {
  return table.rows.map((row) => {
    const bound: Record<string, DataCellValue> = {};
    for (const [propPath, colName] of Object.entries(propertyMap)) {
      if (colName in row) {
        bound[propPath] = row[colName]!;
      }
    }
    return bound;
  });
}

/** Smoothly interpolates numeric series values for animated chart transitions. */
export function interpolateSeriesValues(
  prevValues: readonly number[],
  nextValues: readonly number[],
  progress: number,
): readonly number[] {
  const t = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 1));
  const eased = 1 - Math.pow(1 - t, 3);
  const count = Math.max(prevValues.length, nextValues.length);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = prevValues[i] ?? 0;
    const b = nextValues[i] ?? 0;
    result.push(a + (b - a) * eased);
  }
  return result;
}

function buildSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = Math.min(359.99, Math.max(0, endDeg - startDeg));
  const a0 = ((startDeg - 90) * Math.PI) / 180;
  const a1 = ((startDeg + sweep - 90) * Math.PI) / 180;
  const largeArc = sweep > 180 ? 1 : 0;

  const ox0 = cx + Math.cos(a0) * outerR;
  const oy0 = cy + Math.sin(a0) * outerR;
  const ox1 = cx + Math.cos(a1) * outerR;
  const oy1 = cy + Math.sin(a1) * outerR;

  if (innerR <= 1e-4) {
    return `M ${cx.toFixed(3)} ${cy.toFixed(3)} L ${ox0.toFixed(3)} ${oy0.toFixed(3)} A ${outerR.toFixed(3)} ${outerR.toFixed(3)} 0 ${largeArc} 1 ${ox1.toFixed(3)} ${oy1.toFixed(3)} Z`;
  }
  const ix1 = cx + Math.cos(a1) * innerR;
  const iy1 = cy + Math.sin(a1) * innerR;
  const ix0 = cx + Math.cos(a0) * innerR;
  const iy0 = cy + Math.sin(a0) * innerR;
  return [
    `M ${ox0.toFixed(3)} ${oy0.toFixed(3)}`,
    `A ${outerR.toFixed(3)} ${outerR.toFixed(3)} 0 ${largeArc} 1 ${ox1.toFixed(3)} ${oy1.toFixed(3)}`,
    `L ${ix1.toFixed(3)} ${iy1.toFixed(3)}`,
    `A ${innerR.toFixed(3)} ${innerR.toFixed(3)} 0 ${largeArc} 0 ${ix0.toFixed(3)} ${iy0.toFixed(3)}`,
    "Z",
  ].join(" ");
}

/**
 * Generates exact geometry shapes for `bar`, `line`, `area`, `pie`, and `donut` charts.
 */
export function buildChartFromTable(
  kind: ChartKind,
  table: DataTable,
  spec: ChartLayoutSpec,
  overrideNumericValues?: readonly number[],
): BuiltChartModel {
  const labels = table.rows.map((row, idx) => String(row[spec.labelColumn] ?? idx));
  const rawValues = table.rows.map((row, idx) => {
    if (overrideNumericValues && overrideNumericValues[idx] !== undefined) {
      return Math.max(0, overrideNumericValues[idx]!);
    }
    const cell = row[spec.valueColumn];
    return typeof cell === "number" && Number.isFinite(cell) ? Math.max(0, cell) : 0;
  });

  if (kind === "bar") {
    const count = Math.max(1, rawValues.length);
    const gap = Math.max(0, spec.gapPx ?? 8);
    const maxVal = spec.maxValue ?? Math.max(1, ...rawValues);
    const barW = Math.max(1, (spec.width - gap * Math.max(0, count - 1)) / count);
    const bars: BarShapeItem[] = rawValues.map((val, idx) => {
      const h = (val / maxVal) * spec.height;
      return {
        index: idx,
        label: labels[idx]!,
        value: val,
        x: idx * (barW + gap),
        y: spec.height - h,
        width: barW,
        height: h,
      };
    });
    return { kind: "bar", maxValue: maxVal, bars };
  }

  if (kind === "line" || kind === "area") {
    const maxVal = spec.maxValue ?? Math.max(1, ...rawValues);
    const count = rawValues.length;
    const points: LinePointItem[] = rawValues.map((val, idx) => {
      const x = count > 1 ? (idx / (count - 1)) * spec.width : spec.width * 0.5;
      const y = spec.height - (val / maxVal) * spec.height;
      return { index: idx, label: labels[idx]!, value: val, x, y };
    });

    if (points.length === 0) {
      return { kind, maxValue: maxVal, points: [], svgPath: "" };
    }
    const lineSegments = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`);
    const svgPath =
      kind === "area"
        ? [...lineSegments, `L ${points[points.length - 1]!.x.toFixed(3)} ${spec.height.toFixed(3)}`, `L ${points[0]!.x.toFixed(3)} ${spec.height.toFixed(3)}`, "Z"].join(" ")
        : lineSegments.join(" ");

    return { kind, maxValue: maxVal, points, svgPath };
  }

  const total = Math.max(1e-6, rawValues.reduce((acc, v) => acc + v, 0));
  const cx = spec.width * 0.5;
  const cy = spec.height * 0.5;
  const outerR = Math.min(cx, cy);
  const innerR = kind === "donut" ? outerR * Math.min(0.9, Math.max(0.15, spec.donutInnerRatio ?? 0.55)) : 0;

  let cursorDeg = 0;
  const slices: PieSliceItem[] = rawValues.map((val, idx) => {
    const fraction = val / total;
    const sweepDeg = fraction * 360;
    const startAngleDeg = cursorDeg;
    const endAngleDeg = cursorDeg + sweepDeg;
    cursorDeg = endAngleDeg;
    return {
      index: idx,
      label: labels[idx]!,
      value: val,
      fraction,
      startAngleDeg,
      endAngleDeg,
      innerRadius: innerR,
      outerRadius: outerR,
      svgPath: buildSectorPath(cx, cy, innerR, outerR, startAngleDeg, endAngleDeg),
    };
  });

  return { kind, total, slices };
}
