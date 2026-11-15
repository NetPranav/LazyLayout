/**
 * ROADMAP v5: the release plan (ROADMAP.md §2) is the order of work. This checks it against the phase catalogue:
 * the numbered phases, the Surfaces track (S) and the Design track (D) in ROADMAP.md, and ROADMAP_3D.md.
 *
 *   1. Every phase that is not ✅ is in exactly one work package: a release (R0, R1, …) or a Later theme (L1, L2, …).
 *      A pointer phase (its index title says "→ ROADMAP_3D 3D-…", "→ Design track D…" or "→ ROADMAP.md D…") is not
 *      listed: it is done where its target is done, so it is placed with its target.
 *   2. A phase in a release needs only phases that are ✅, in the same release, or in an earlier release.
 *      Nothing in a release may need a Later phase.
 *   3. A deferred phase (⏸) is in Later.
 *   4. A package names only phases that exist.
 *
 * It prints the progress of each release and names the active one (the first release that is not all ✅).
 * Ranges in a package ("64–77", "3D-033 – 3D-043", "D4 – D7") skip ✅ and pointer phases.
 *
 * Run: `npm run check:release-plan` (exit code 1 on any error).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (name: string): string =>
  readFileSync(join(process.cwd(), "DOCS", "INITIAL", name), "utf8").replace(/\r\n/g, "\n");
const main = read("ROADMAP.md");
const r3d = read("ROADMAP_3D.md");

type Phase = { id: string; title: string; needs: string[]; status: string; pointsTo: string[] };
const phases = new Map<string, Phase>();
const errors: string[] = [];
const pad = (n: number): string => String(n).padStart(3, "0");

/** Phase ids named in a piece of text. `numbers` also takes bare numbers as numbered phases. */
function idsIn(text: string, numbers: boolean): string[] {
  const out: string[] = [];
  const re = /3D-(\d{3})\s*[–-]\s*3D-(\d{3})|3D-(\d{3})|\bD(\d+)\s*[–-]\s*D(\d+)|\bD(\d+)\b|\bS(\d+b?)\b|\b(\d+)\s*[–-]\s*(\d+)\b|\b(\d+)\b/g;
  for (const m of text.matchAll(re)) {
    if (m[1]) for (let k = Number(m[1]); k <= Number(m[2]); k++) out.push(`3D-${pad(k)}`);
    else if (m[3]) out.push(`3D-${m[3]}`);
    else if (m[4]) for (let k = Number(m[4]); k <= Number(m[5]); k++) out.push(`D${k}`);
    else if (m[6]) out.push(`D${Number(m[6])}`);
    else if (m[7]) out.push(`S${m[7]}`);
    else if (!numbers) continue;
    else if (m[8]) for (let k = Number(m[8]); k <= Number(m[9]); k++) out.push(String(k));
    else if (m[10]) out.push(String(Number(m[10])));
  }
  return out;
}

/** The phases a pointer row hands its work to ("… → ROADMAP_3D 3D-044"). */
function pointer(title: string): string[] {
  const at = title.search(/→\s*\*?(ROADMAP_3D|ROADMAP\.md|Design track)/);
  return at < 0 ? [] : idsIn(title.slice(at), false);
}

// --- the catalogue -------------------------------------------------------------------------------------------------

// Numbered phases: | N | title | needs | was | stage | status |
for (const m of main.matchAll(/^\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|[^|]*\|[^|]*\|\s*(✅|🚧|📋)\s*\|\s*$/gm)) {
  const id = String(Number(m[1]));
  phases.set(id, { id, title: m[2].trim(), needs: idsIn(m[3], true), status: m[4], pointsTo: pointer(m[2]) });
}

// Design track: | DN | title | was | needs | lane | status |
const designStart = main.indexOf("# DESIGN MASTER TRACK");
const designEnd = main.indexOf("\n# ", designStart + 5);
for (const m of main.slice(designStart, designEnd).matchAll(/^\| D(\d+) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (\S+) \|$/gm)) {
  const id = `D${Number(m[1])}`;
  phases.set(id, { id, title: m[2].trim(), needs: idsIn(m[4], true), status: m[6], pointsTo: [] });
}

// Surfaces track: entries only (### Phase S2 · …), no Needs between tracks.
for (const m of main.matchAll(/^### Phase (S\d+b?) · (.*)\n(\*\*Needs:\*\*.*)$/gm)) {
  const status = /\*\*Status:\*\*\s*(✅|🚧|📋)/.exec(m[3])?.[1] ?? "";
  if (!status) errors.push(`${m[1]} has no status.`);
  phases.set(m[1], { id: m[1], title: m[2].trim(), needs: [], status, pointsTo: [] });
}

// ROADMAP_3D: | 3D-NNN | title | was | needs | lane | status |
for (const m of r3d.matchAll(/^\| 3D-(\d{3}) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (\S+) \|$/gm)) {
  const id = `3D-${m[1]}`;
  phases.set(id, { id, title: m[2].trim(), needs: idsIn(m[4], false), status: m[6], pointsTo: pointer(m[2]) });
}

// --- the plan ------------------------------------------------------------------------------------------------------

const planStart = main.indexOf("<!-- release-plan:start -->");
const planEnd = main.indexOf("<!-- release-plan:end -->");
if (planStart < 0 || planEnd < planStart) {
  console.error("ROADMAP.md has no release plan (the release-plan:start and release-plan:end markers).");
  process.exit(1);
}

const LATER = Number.MAX_SAFE_INTEGER;
const DONE = -1;
type Group = { key: string; name: string; rank: number; ids: string[] };
const groups: Group[] = [];
const placed = new Map<string, { rank: number; pack: string }>();
let current: Group | undefined;

for (const line of main.slice(planStart, planEnd).split("\n")) {
  const head = /^### (R(\d+)|Later) · (.*)$/.exec(line);
  if (head) {
    current = { key: head[1], name: head[3].trim(), rank: head[2] === undefined ? LATER : Number(head[2]), ids: [] };
    if (groups.some((g) => g.key === current!.key)) errors.push(`${current.key} appears twice in the plan.`);
    groups.push(current);
    continue;
  }
  const row = /^\| ((?:R\d+\.\d+)|(?:L\d+)) \|.*\|([^|]*)\|\s*$/.exec(line);
  if (!row || !current) continue;
  const pack = row[1];
  const inRelease = pack.startsWith("R");
  if (inRelease !== (current.rank !== LATER) || (inRelease && !pack.startsWith(`${current.key}.`))) {
    errors.push(`Package ${pack} is under ${current.key}.`);
  }
  for (const id of idsIn(row[2], true)) {
    const p = phases.get(id);
    if (!p) { errors.push(`Package ${pack} names ${id}, which is not a phase.`); continue; }
    if (p.status === "✅" || p.pointsTo.length > 0) continue; // done, or done where its target is done
    const before = placed.get(id);
    if (before) { errors.push(`${id} is in two packages (${before.pack} and ${pack}).`); continue; }
    placed.set(id, { rank: current.rank, pack });
    current.ids.push(id);
  }
}

/** Where a phase is done: DONE, a release number, or LATER. A pointer phase goes where its targets go. */
const seen = new Set<string>();
function rankOf(id: string): number {
  const p = phases.get(id);
  if (!p) return LATER;
  if (p.status === "✅") return DONE;
  if (p.pointsTo.length > 0) {
    if (seen.has(id)) return LATER;
    seen.add(id);
    const r = Math.max(...p.pointsTo.map(rankOf));
    seen.delete(id);
    return r;
  }
  return placed.get(id)?.rank ?? LATER;
}
const label = (rank: number): string => (rank === LATER ? "Later" : rank === DONE ? "done" : `R${rank}`);

for (const p of phases.values()) {
  if (p.status === "✅" || p.pointsTo.length > 0) {
    for (const t of p.pointsTo) if (!phases.has(t)) errors.push(`${p.id} points to ${t}, which is not a phase.`);
    continue;
  }
  const at = placed.get(p.id);
  if (!at) { errors.push(`${p.id} (${p.title}) is ${p.status} and is in no package.`); continue; }
  if (p.status === "⏸" && at.rank !== LATER) errors.push(`${p.id} is deferred (⏸) but is in ${label(at.rank)}.`);
  if (at.rank === LATER) continue;
  for (const d of p.needs) {
    if (!phases.has(d)) { errors.push(`${p.id} needs ${d}, which is not a phase.`); continue; }
    const r = rankOf(d);
    if (r > at.rank) errors.push(`${p.id} is in ${label(at.rank)} but needs ${d}, which is in ${label(r)}.`);
  }
}

// --- report --------------------------------------------------------------------------------------------------------

const count = (ids: string[], s: string): number => ids.filter((id) => phases.get(id)!.status === s).length;
const releases = groups.filter((g) => g.rank !== LATER).sort((a, b) => a.rank - b.rank);
const active = releases.find((g) => g.ids.length > 0);
const all = [...phases.values()];
const real = all.filter((p) => p.pointsTo.length === 0);
console.log(
  `Catalogue: ${all.length} phases, ${all.length - real.length} of them pointers. ` +
    `Of the other ${real.length}: ✅ ${real.filter((p) => p.status === "✅").length}, ` +
    `in a release ${releases.reduce((n, g) => n + g.ids.length, 0)}, ` +
    `Later ${groups.filter((g) => g.rank === LATER).reduce((n, g) => n + g.ids.length, 0)}.`,
);
for (const g of releases) {
  const open = g.ids.length;
  const mark = open === 0 ? "✅ gate work only" : g === active ? "◀ active" : "";
  console.log(
    `  ${g.key.padEnd(3)} ${g.name.padEnd(34)} open ${String(open).padStart(3)}  ` +
      `(🚧 ${String(count(g.ids, "🚧")).padStart(2)}, 📋 ${String(count(g.ids, "📋")).padStart(2)})  ${mark}`,
  );
}
if (active) {
  const early = releases
    .filter((g) => g.rank > active.rank)
    .reduce((n, g) => n + count(g.ids, "🚧"), 0);
  if (early > 0) console.log(`  ${early} phase(s) of later releases are already 🚧: frozen until their release is active (Law 21).`);
}

if (errors.length) {
  console.error(errors.map((e) => `  ✖ ${e}`).join("\n"));
  console.error(`Release plan: ${errors.length} problem(s).`);
  process.exit(1);
}
console.log("Release plan checks passed.");
