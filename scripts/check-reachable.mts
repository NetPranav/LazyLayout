/**
 * `npm run check:reachable`: new code must be reachable from the product, not only from its own tests.
 *
 * Walks the static imports (`import ... from`, `export ... from`, `import()`) from every real entry point:
 * the app routes under `src/app/**` (page, layout, route), the `bin/` CLIs, and the export-runtime build script.
 * Lab routes (`/editor/*-lab`, the render gallery) count as reachable too, but are listed separately.
 *
 * Every non-test `.ts`/`.tsx` file under `src/` that no entry point reaches is "unwired". Code that was unwired on
 * 2026-11-17 (review of Lanes C-G) is recorded in `scripts/reachability-baseline.json`: the designer is building
 * the panels for it, so it is allowed to stay unwired for now. The check fails only when a file that is NOT in the
 * baseline is unwired, i.e. a new module only its tests can see. When a baselined module gets wired in, it is
 * reported so it can be dropped from the baseline (`--update` rewrites the baseline to the current state).
 *
 * Why: in the Lanes C-G review, 48 new modules were reachable only from their tests and 67 only from lab pages,
 * while their phases were marked as built.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "src");
const baselinePath = path.join(root, "scripts", "reachability-baseline.json");
const norm = (p: string) => p.split(path.sep).join("/");
const rel = (p: string) => norm(path.relative(root, p));

const all: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") walk(p);
    } else if (/\.(ts|tsx|mts)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      all.push(norm(p));
    }
  }
})(src);

const exts = ["", ".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];
function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = norm(path.join(src, spec.slice(2)));
  else if (spec.startsWith(".")) base = norm(path.resolve(path.dirname(from), spec.replace(/\.js$/, "")));
  else return null;
  for (const e of exts) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return norm(path.resolve(p));
  }
  return null;
}

const importRe = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;
const deps = new Map<string, Set<string>>();
function depsOf(file: string): Set<string> {
  const cached = deps.get(file);
  if (cached) return cached;
  const out = new Set<string>();
  for (const m of fs.readFileSync(file, "utf8").matchAll(importRe)) {
    const r = resolve(file, m[1] ?? m[2] ?? m[3] ?? "");
    if (r) out.add(r);
  }
  deps.set(file, out);
  return out;
}

const routes = all.filter((f) => /\/src\/app\/.*(page|layout|route)\.tsx?$/.test(f));
const isLab = (f: string) =>
  /\/src\/app\/editor\/(canvas-lab|components-lab|gpu-lab|interactive-lab|render-gallery|rig-lab|scene3d-lab|stage-lab|surface-lab)\//.test(f);
const prodEntries = routes.filter((f) => !isLab(f));
const labEntries = routes.filter(isLab);
for (const dir of ["bin", "scripts"]) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const f = norm(path.join(root, dir, name));
    if (!fs.statSync(f).isFile() || !/\.(ts|mts)$/.test(name)) continue;
    if (dir === "scripts" && !/build-export-runtime/.test(name)) continue;
    prodEntries.push(f);
  }
}

function closure(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const d of depsOf(f)) stack.push(d);
  }
  return seen;
}
const prod = closure(prodEntries);
const lab = closure(labEntries);

const unwired = all.filter((f) => !prod.has(f) && !lab.has(f)).map(rel).sort();
const labOnly = all.filter((f) => !prod.has(f) && lab.has(f)).map(rel).sort();

if (process.argv.includes("--update")) {
  fs.writeFileSync(baselinePath, JSON.stringify({ note: "Source files no entry point reached on the date of the last --update (some kept on purpose while their panels are designed). See scripts/check-reachable.mts.", unwired }, null, 2) + "\n");
  console.log(`[check-reachable] baseline written: ${unwired.length} unwired file(s).`);
  process.exit(0);
}

const baseline = new Set<string>(
  fs.existsSync(baselinePath) ? (JSON.parse(fs.readFileSync(baselinePath, "utf8")) as { unwired: string[] }).unwired : [],
);
const fresh = unwired.filter((f) => !baseline.has(f));
const nowWired = [...baseline].filter((f) => fs.existsSync(path.join(root, f)) && !unwired.includes(f));

console.log(
  `[check-reachable] ${all.length} source file(s): ${all.filter((f) => prod.has(f)).length} reach the product, ${labOnly.length} only a lab page, ${unwired.length} nothing (${baseline.size} baselined).`,
);
if (nowWired.length > 0) {
  console.log(`[check-reachable] now wired, drop from the baseline (npm run check:reachable -- --update):`);
  for (const f of nowWired) console.log(`  + ${f}`);
}
if (fresh.length > 0) {
  console.error(`[check-reachable] FAIL: ${fresh.length} new file(s) reachable only from tests (or nothing):`);
  for (const f of fresh) console.error(`  - ${f}`);
  console.error(`Wire each into a route, the export or a CLI, or delete it.`);
  process.exit(1);
}
console.log("[check-reachable] OK: no new unwired files.");
