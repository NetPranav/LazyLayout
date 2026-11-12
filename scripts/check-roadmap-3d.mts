/**
 * ROADMAP_3D.md consistency check.
 *
 * Checks `DOCS/INITIAL/ROADMAP_3D.md`:
 *   1. Every phase in the §6 index has the same status as its own entry (`### Phase 3D-NNN`). A deferred phase (⏸) may have
 *      no entry until it is scheduled; every other phase must have one.
 *   2. Statuses are one of ✅ 🚧 📋 ⏸.
 *   3. Every `3D-NNN` named in a **Needs** line exists in the index.
 *   4. **Nothing active needs a deferred phase** (the owner's order of 2026-11-13).
 *   5. There are no cycles in the Needs graph.
 * A ✅ phase whose Needs are not all ✅ is only a warning here: a phase can be done while a foundation under it still has a
 * named gap (its "Status check" line says which).
 *
 * Run: `npm run check:roadmap-3d` (exit code 1 on any error).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const text = readFileSync(join(process.cwd(), "DOCS", "INITIAL", "ROADMAP_3D.md"), "utf8");
const errors: string[] = [];
const warnings: string[] = [];

const ids = (t: string): number[] => {
  const out: number[] = [];
  for (const m of t.matchAll(/3D-(\d{3})\s*–\s*3D-(\d{3})|3D-(\d{3})/g)) {
    if (m[3]) out.push(Number(m[3]));
    else for (let k = Number(m[1]); k <= Number(m[2]); k++) out.push(k);
  }
  return out;
};

const rows = new Map<number, { needs: number[]; status: string }>();
for (const m of text.matchAll(/^\| 3D-(\d{3}) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (\S+) \|$/gm)) {
  const n = Number(m[1]);
  if (rows.has(n)) errors.push(`3D-${m[1]} is in the index twice.`);
  rows.set(n, { needs: ids(m[4]), status: m[6] });
}

const entries = new Map<number, { needs: number[]; status: string }>();
const lines = text.split("\n");
for (let i = 0; i < lines.length; i++) {
  const head = /^### Phase 3D-(\d{3}) · /.exec(lines[i]);
  if (!head) continue;
  const n = Number(head[1]);
  if (entries.has(n)) errors.push(`3D-${head[1]} has two entries (line ${i + 1}).`);
  const meta = lines.slice(i + 1, i + 3).find((l) => l.startsWith("**Needs:**")) ?? "";
  entries.set(n, {
    needs: ids(/\*\*Needs:\*\*\s*([^·]*)/.exec(meta)?.[1] ?? ""),
    status: /\*\*Status:\*\*\s*(✅|🚧|📋|⏸)/.exec(meta)?.[1] ?? "",
  });
}

const OK = new Set(["✅", "🚧", "📋", "⏸"]);
for (const [n, r] of rows) {
  const tag = `3D-${String(n).padStart(3, "0")}`;
  if (!OK.has(r.status)) errors.push(`${tag}: status "${r.status}" is not ✅ 🚧 📋 ⏸.`);
  const e = entries.get(n);
  if (!e) {
    if (r.status !== "⏸") errors.push(`${tag} has no entry and is not deferred.`);
  } else {
    if (e.status !== r.status) errors.push(`${tag}: index says ${r.status}, entry says ${e.status || "nothing"}.`);
    if (e.needs.join() !== r.needs.join()) errors.push(`${tag}: the entry's Needs differ from the index row.`);
  }
  for (const d of r.needs) {
    if (!rows.has(d)) errors.push(`${tag} needs 3D-${String(d).padStart(3, "0")}, which is not in the index.`);
    else if (r.status !== "⏸" && rows.get(d)!.status === "⏸") errors.push(`${tag} is active but needs the deferred 3D-${String(d).padStart(3, "0")}.`);
    else if (r.status === "✅" && rows.get(d)!.status !== "✅") warnings.push(`${tag} is ✅ while its Need 3D-${String(d).padStart(3, "0")} is ${rows.get(d)!.status}.`);
  }
}
for (const n of entries.keys()) if (!rows.has(n)) errors.push(`3D-${String(n).padStart(3, "0")} has an entry but no index row.`);

// cycles (depth-first)
const state = new Map<number, number>();
const walk = (n: number, path: number[]): void => {
  if (state.get(n) === 2) return;
  if (state.get(n) === 1) { errors.push(`Needs cycle: ${[...path.slice(path.indexOf(n)), n].map((x) => "3D-" + String(x).padStart(3, "0")).join(" → ")}`); return; }
  state.set(n, 1);
  for (const d of rows.get(n)?.needs ?? []) if (rows.has(d)) walk(d, [...path, n]);
  state.set(n, 2);
};
for (const n of rows.keys()) walk(n, []);

const count = (s: string) => [...rows.values()].filter((r) => r.status === s).length;
console.log(`ROADMAP_3D: ${rows.size} phases (✅ ${count("✅")}, 🚧 ${count("🚧")}, 📋 ${count("📋")}, ⏸ ${count("⏸")}), ${entries.size} entries.`);
if (warnings.length) console.log(`${warnings.length} warning(s), e.g. ${warnings.slice(0, 3).join(" ")}`);
if (errors.length) {
  console.error(errors.map((e) => "  ✖ " + e).join("\n"));
  process.exit(1);
}
console.log("ROADMAP_3D checks passed.");
