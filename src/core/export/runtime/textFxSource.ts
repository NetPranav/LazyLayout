/** The text-motion function for the exported page (Design track D12): the same maths as `core/text/textFx.ts`, in plain script, kept equal by a parity test. */
export const TEXT_FX_SOURCE = String.raw`
var FX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*+=?";
function fxHash(a, b, c) {
  var h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function fxParts(s) { return typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), function (x) { return x.segment; }) : Array.from(s); }
function fxText(cfg, progress) {
  var p = isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1, text = cfg.text, mode = cfg.mode;
  if (mode === "off" || p >= 1 && mode !== "typewriter" && mode !== "countup" && mode !== "rotate") return text;
  if (mode === "scramble") {
    var g = fxParts(text), settled = Math.floor(p * g.length + 1e-9), round = Math.floor(p * 30 * 2);
    return g.map(function (ch, i) { return i < settled || /\s/.test(ch) ? ch : FX_CHARS[Math.floor(fxHash(cfg.seed || 0, i, round) * FX_CHARS.length)]; }).join("");
  }
  if (mode === "typewriter") { var t = fxParts(text), shown = Math.floor(p * t.length + 1e-9); return t.slice(0, shown).join("") + (cfg.caret && p < 1 ? "▏" : ""); }
  if (mode === "rotate") { var w = (cfg.words || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); return w.length ? w[Math.min(w.length - 1, Math.floor(p * w.length))] : text; }
  var m = /-?\d[\d,]*(?:\.\d+)?/.exec(text); if (!m) return text;
  var target = Number(m[0].replace(/,/g, "")); if (!isFinite(target)) return text;
  var dec = cfg.decimals !== undefined && cfg.decimals !== null ? Math.min(8, Math.max(0, Math.round(cfg.decimals))) : (m[0].split(".")[1] || "").length;
  var f = new Intl.NumberFormat(cfg.locale || "en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[0].indexOf(",") >= 0 });
  return text.slice(0, m.index) + f.format(target * p) + text.slice(m.index + m[0].length);
}
`;
