import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bindRowsToCloneProperties,
  buildChartFromTable,
  interpolateSeriesValues,
  parseCsvDataTable,
  parseJsonDataTable,
} from "../dataDrivenCharts.js";

describe("Phase 156 · Data-driven layers & animated charts", () => {
  it("parses CSV/JSON tables and builds exact bar, line, area, pie, and donut shapes", () => {
    const csv = "month,revenue\nJan,25\nFeb,50\nMar,100\nApr,25";
    const table = parseCsvDataTable(csv);
    const jsonTable = parseJsonDataTable([
      { month: "Jan", revenue: 25 },
      { month: "Feb", revenue: 50 },
      { month: "Mar", revenue: 100 },
      { month: "Apr", revenue: 25 },
    ]);
    assert.deepEqual(table.rows, jsonTable.rows);

    const spec = { width: 400, height: 200, labelColumn: "month", valueColumn: "revenue", gapPx: 0 };

    // 1) Bar
    const bar = buildChartFromTable("bar", table, spec);
    assert.equal(bar.kind, "bar");
    assert.equal(bar.bars[2]!.height, 200);
    assert.equal(bar.bars[0]!.height, 50);

    // 2) Line
    const line = buildChartFromTable("line", table, spec);
    assert.equal(line.kind, "line");
    assert.equal(line.points[2]!.y, 0);

    // 3) Area
    const area = buildChartFromTable("area", table, spec);
    assert.equal(area.kind, "area");
    assert.ok(area.svgPath.endsWith("Z"));

    // 4) Pie
    const pie = buildChartFromTable("pie", table, spec);
    assert.equal(pie.kind, "pie");
    assert.equal(pie.slices[2]!.fraction, 0.5);
    assert.equal(pie.slices[2]!.innerRadius, 0);

    // 5) Donut
    const donut = buildChartFromTable("donut", table, spec);
    assert.equal(donut.kind, "donut");
    assert.ok(donut.slices[0]!.innerRadius > 0);
  });

  it("animates chart data transitions smoothly and binds rows to clone properties", () => {
    const table = parseCsvDataTable("label,score\nA,20\nB,80");
    const bound = bindRowsToCloneProperties(table, { "shape.height": "score", "text.content": "label" });
    assert.equal(bound[0]!["shape.height"], 20);
    assert.equal(bound[1]!["text.content"], "B");

    const mid = interpolateSeriesValues([20, 80], [100, 40], 0.5);
    assert.ok(mid[0]! > 60 && mid[0]! < 100);
    assert.ok(mid[1]! < 80 && mid[1]! > 40);

    const end = interpolateSeriesValues([20, 80], [100, 40], 1);
    assert.deepEqual(end, [100, 40]);
  });
});

describe("Phase 156 · CSV parsing (review 2026-11-17)", () => {
  it("keeps commas, quotes and line breaks inside quoted cells, and only plain decimals become numbers", async () => {
    const { parseCsvDataTable } = await import("../dataDrivenCharts");
    const table = parseCsvDataTable('name,note,value\n"Smith, J","said ""hi""\nthen left",12.5\nhex,x,0x10\n');
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[0]!.name, "Smith, J");
    assert.equal(table.rows[0]!.note, 'said "hi"\nthen left');
    assert.equal(table.rows[0]!.value, 12.5);
    assert.equal(table.rows[1]!.value, "0x10", "hex stays text");
  });
});
