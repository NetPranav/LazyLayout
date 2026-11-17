#!/usr/bin/env node
/**
 * Summarise a .cpuprofile from `npm run perf:profile`: self time by source file and by function, and inclusive time of
 * our own functions, resolved through the production source maps.
 *
 *   LL_PROFILE_MAPS=1 npm run build && npm run start
 *   PROFILE_DIR=out npm run perf:profile
 *   node scripts/analyze-cpuprofile.mjs out/play.cpuprofile [topN]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { SourceMapConsumer } = require("source-map-js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
const topN = Number(process.argv[3] ?? 20);
if (!file) {
  console.error("usage: node scripts/analyze-cpuprofile.mjs <profile.cpuprofile> [topN]");
  process.exit(2);
}
const prof = JSON.parse(fs.readFileSync(file, "utf8"));

const consumers = new Map();
function resolveFrame(cf) {
  if (!cf.url) return cf.functionName || "(native)";
  let c = consumers.get(cf.url);
  if (c === undefined) {
    c = null;
    const m = cf.url.match(/\/_next\/(static\/.+\.js)/);
    if (m) {
      const js = path.join(root, ".next", m[1]);
      if (fs.existsSync(js)) {
        const ref = (fs.readFileSync(js, "utf8").slice(-300).match(/sourceMappingURL=([^\s]+)/) || [])[1];
        const mapPath = ref ? path.join(path.dirname(js), ref) : `${js}.map`;
        if (fs.existsSync(mapPath)) c = new SourceMapConsumer(JSON.parse(fs.readFileSync(mapPath, "utf8")));
      }
    }
    consumers.set(cf.url, c);
  }
  if (!c) return cf.functionName || "(anon)";
  const p = c.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber });
  return p.source ? `${p.name || cf.functionName || "(anon)"} @${p.source.replace(/^.*?(src\/|node_modules\/)/, "$1")}:${p.line}` : cf.functionName;
}

const byId = new Map(prof.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of prof.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
const counts = new Map();
for (const s of prof.samples) counts.set(s, (counts.get(s) || 0) + 1);
const msPer = (prof.endTime - prof.startTime) / 1000 / Math.max(1, prof.samples.length);

const self = new Map();
const inclusive = new Map();
for (const [id, n] of counts) {
  const name = resolveFrame(byId.get(id).callFrame);
  self.set(name, (self.get(name) || 0) + n);
  const seen = new Set();
  for (let p = id; p !== undefined; p = parent.get(p)) {
    const nm = resolveFrame(byId.get(p).callFrame);
    if (nm.includes("@src/") && !seen.has(nm)) {
      seen.add(nm);
      inclusive.set(nm, (inclusive.get(nm) || 0) + n);
    }
  }
}
const show = (title, map) => {
  console.log(`\n-- ${title}`);
  for (const [k, v] of [...map].sort((a, b) => b[1] - a[1]).slice(0, topN)) console.log(`${(v * msPer).toFixed(0).padStart(7)} ms  ${k}`);
};
console.log(`${path.basename(file)}: ${((prof.endTime - prof.startTime) / 1000).toFixed(0)} ms, ${prof.samples.length} samples`);
show("self time", self);
show("inclusive time of src/ functions", inclusive);
