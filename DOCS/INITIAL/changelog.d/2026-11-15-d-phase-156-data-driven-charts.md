# Stage 4 · Phase 156 · Data-driven layers & animated charts

- **Scope:** Implemented Phase 156 in Lane D (`d/phase-156-data-driven-charts`) stacked on `d/phase-155-roles-relations-selectors`.
- **Core (`src/core/signals/dataDrivenCharts.ts`):**
  - Added CSV and JSON table parsers (`parseCsvDataTable`, `parseJsonDataTable`) and `bindRowsToCloneProperties`.
  - Added exact shape/path generators (`buildChartFromTable`) for `bar`, `line`, `area`, `pie`, and `donut` charts plus eased series interpolation (`interpolateSeriesValues`).
- **Tests:** Added `src/core/signals/__tests__/dataDrivenCharts.test.ts` validating all 5 chart forms + animated series transition + clone binding (verified at Milestone 3).
