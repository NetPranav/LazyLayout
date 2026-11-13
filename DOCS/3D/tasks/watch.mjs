// Live view of agy's work. Run in a second terminal:  node DOCS/3D/tasks/watch.mjs
// Shows each tool call with its arguments: files read, files written (with the code), commands run, and its replies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const phases = fs.readdirSync(dir).filter((f) => f.endsWith(".agy.jsonl")).map((f) => f.replace(".agy.jsonl", "")).sort();
const offsets = {};
const shown = new Set();
const C = { dim: "\x1b[2m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", off: "\x1b[0m", bold: "\x1b[1m" };
const clip = (s, n = 2500) => (s.length > n ? s.slice(0, n) + `\n${C.dim}… (+${s.length - n} chars)${C.off}` : s);
function show(phase, o) {
  if (o.event === "init") return console.log(`\n${C.bold}${C.green}════════ ${phase} started ════════${C.off}`);
  const s = o.step_update;
  if (!s) {
    const txt = o.result ?? o.final ?? o.message ?? o.text;
    if (typeof txt === "string") console.log(`\n${C.green}${txt}${C.off}`);
    return;
  }
  const key = `${phase}:${s.step_index}`;
  if (s.step_type === "tool") {
    if (shown.has(key)) return;
    shown.add(key);
    const p = s.tool_info?.parameters ?? {};
    const file = p.TargetFile ?? p.Path ?? p.AbsolutePath ?? p.File ?? p.DirectoryPath ?? "";
    console.log(`\n${C.cyan}▶ ${s.tool_info?.name}${C.off} ${file}`);
    const body = p.CodeContent ?? p.ReplacementContent ?? p.CommandLine ?? p.Query ?? p.Pattern ?? p.Description;
    if (typeof body === "string") console.log(clip(body));
    if (Array.isArray(p.ReplacementChunks)) for (const c of p.ReplacementChunks) console.log(`${C.yellow}- ${clip(String(c.TargetContent ?? ""), 400).replace(/\n/g, "\n- ")}${C.off}\n${C.green}+ ${clip(String(c.ReplacementContent ?? ""), 1200).replace(/\n/g, "\n+ ")}${C.off}`);
  } else if (s.step_type === "agent_response" && s.state === "DONE") {
    const u = s.usage;
    console.log(`${C.dim}💭 thinking step (${u?.thinking_tokens ?? 0} thinking tokens, ${s.duration_seconds?.toFixed?.(1) ?? "?"}s)${C.off}`);
    const t = s.response ?? s.text ?? s.content ?? s.agent_response;
    if (typeof t === "string") console.log(t);
  }
}
function poll() {
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".agy.jsonl") && !phases.includes(f.replace(".agy.jsonl", ""))) phases.push(f.replace(".agy.jsonl", ""));
  for (const ph of phases) {
    const f = path.join(dir, `${ph}.agy.jsonl`);
    if (!fs.existsSync(f)) continue;
    const size = fs.statSync(f).size;
    const from = offsets[ph] ?? 0;
    if (size <= from) continue;
    const buf = Buffer.alloc(size - from);
    const fd = fs.openSync(f, "r");
    fs.readSync(fd, buf, 0, buf.length, from);
    fs.closeSync(fd);
    const text = buf.toString("utf8");
    const end = text.lastIndexOf("\n");
    if (end < 0) continue;
    offsets[ph] = from + Buffer.byteLength(text.slice(0, end + 1));
    for (const line of text.slice(0, end).split("\n")) {
      if (!line.trim()) continue;
      try { show(ph, JSON.parse(line)); } catch { console.log(line); }
    }
  }
}
const noteOff = {};
function notes() {
  for (const ph of phases) {
    const f = path.join(dir, `${ph}.notes.md`);
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    const from = noteOff[ph] ?? 0;
    if (text.length <= from) continue;
    noteOff[ph] = text.length;
    console.log(`\n${C.yellow}📝 agy's notes (${ph}):${C.off}\n${text.slice(from).trim()}`);
  }
}
setInterval(notes, 900);
console.log("Watching agy… (Ctrl+C to stop)");
setInterval(poll, 700);
poll();
