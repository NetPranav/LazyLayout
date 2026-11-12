/**
 * The Design master track in ROADMAP.md (Phases D1–D21) is outside the number order that `check-roadmap-order.mts` checks,
 * so this checks it:
 *   1. Every row of the track's table has an entry (`### Phase DN · …`) with the same status and the same Needs, and the
 *      other way round.
 *   2. Every D-phase named in a Needs line exists and is earlier; every numbered phase exists in ROADMAP.md; every
 *      `3D-NNN` exists in ROADMAP_3D.md and is not deferred (⏸).
 *   3. Lanes are A or B; statuses are ✅ 🚧 📋.
 *
 * Run: `npm run check:design-track` (exit code 1 on any error).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const main = readFileSync(join(process.cwd(), "DOCS", "INITIAL", "ROADMAP.md"), "utf8");
const r3d = readFileSync(join(process.cwd(), "DOCS", "INITIAL", "ROADMAP_3D.md"), "utf8");
const errors: string[] = [];

const start = main.indexOf("# DESIGN MASTER TRACK");
if (start < 0) {
  console.error("No DESIGN MASTER TRACK section in ROADMAP.md.");
  process.exit(1);
}
const end = main.indexOf("\n# ", start + 5);
const track = main.slice(start, end < 0 ? undefined : end);

type Item = { needs: string; status: string; lane: string };
const rows = new Map<number, Item>();
for (const m of track.matchAll(/^\| D(\d+) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (\S+) \|$/gm)) {
  rows.set(Number(m[1]), { needs: m[4].trim(), lane: m[5].trim(), status: m[6] });
}
const entries = new Map<number, Item>();
for (const m of track.matchAll(/^### Phase D(\d+) · .*\n\*\*Needs:\*\* (.*?) · \*\*Was:\*\* .*? · \*\*Lane:\*\* (.*?) · \*\*Status:\*\* (\S+)$/gm)) {
  entries.set(Number(m[1]), { needs: m[2].trim(), lane: m[3].trim(), status: m[4] });
}

const numbered = new Set([...main.matchAll(/^### Phase (\d+) · /gm)].map((m) => Number(m[1])));
const r3dStatus = new Map([...r3d.matchAll(/^\| 3D-(\d{3}) \| .*\| (\S+) \|$/gm)].map((m) => [Number(m[1]), m[2]]));

for (const [n, r] of rows) {
  const e = entries.get(n);
  if (!e) { errors.push(`D${n} is in the table but has no entry.`); continue; }
  if (e.status !== r.status) errors.push(`D${n}: table says ${r.status}, entry says ${e.status}.`);
  if (e.needs !== r.needs) errors.push(`D${n}: the entry's Needs ("${e.needs}") differ from the table ("${r.needs}").`);
  if (e.lane !== r.lane) errors.push(`D${n}: the entry's lane differs from the table.`);
  if (!["A", "B"].includes(r.lane)) errors.push(`D${n}: lane "${r.lane}" is not A or B.`);
  if (!["✅", "🚧", "📋"].includes(r.status)) errors.push(`D${n}: status "${r.status}" is not ✅ 🚧 📋.`);
  for (const m of r.needs.matchAll(/D(\d+)\s*–\s*D(\d+)|D(\d+)|3D-(\d{3})|\b(\d{1,3})\b/g)) {
    if (m[1]) { if (Number(m[2]) >= n) errors.push(`D${n} needs D${m[1]}–D${m[2]}, which is not all earlier.`); continue; }
    if (m[3]) { const d = Number(m[3]); if (!rows.has(d)) errors.push(`D${n} needs D${d}, which doesn't exist.`); else if (d >= n) errors.push(`D${n} needs D${d}, which is not earlier.`); continue; }
    if (m[4]) { const st = r3dStatus.get(Number(m[4])); if (!st) errors.push(`D${n} needs 3D-${m[4]}, which is not in ROADMAP_3D.`); else if (st === "⏸") errors.push(`D${n} needs the deferred 3D-${m[4]}.`); continue; }
    if (m[5] && !numbered.has(Number(m[5]))) errors.push(`D${n} needs Phase ${m[5]}, which doesn't exist.`);
  }
}
for (const n of entries.keys()) if (!rows.has(n)) errors.push(`D${n} has an entry but no table row.`);

console.log(`Design master track: ${rows.size} phases (lane A ${[...rows.values()].filter((r) => r.lane === "A").length}, lane B ${[...rows.values()].filter((r) => r.lane === "B").length}).`);
if (errors.length) {
  console.error(errors.map((e) => "  ✖ " + e).join("\n"));
  process.exit(1);
}
console.log("Design master track checks passed.");
