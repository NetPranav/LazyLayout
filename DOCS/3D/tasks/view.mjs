// Turns agy's stream-json lines (stdin) into readable text: what it says, which tools it calls, which files it edits.
import { createInterface } from "node:readline";
const clip = (s, n = 1500) => (s.length > n ? s.slice(0, n) + ` … (+${s.length - n} chars)` : s);
const walk = (o, depth = 0) => {
  if (o == null || depth > 6) return;
  if (typeof o === "string") return;
  if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
  const t = o.type ?? o.kind ?? "";
  const name = o.name ?? o.tool ?? o.tool_name;
  const input = o.input ?? o.args ?? o.arguments ?? o.parameters;
  if (name && input) {
    const path = input.file_path ?? input.path ?? input.TargetFile ?? input.AbsolutePath;
    console.log(`\n\x1b[36m▶ ${name}\x1b[0m ${path ?? ""}`);
    const body = input.content ?? input.new_string ?? input.CodeContent ?? input.command ?? input.CommandLine;
    if (typeof body === "string") console.log(clip(body));
    return;
  }
  const text = (typeof o.text === "string" && o.text) || (typeof o.thinking === "string" && o.thinking) || (typeof o.thought === "string" && o.thought);
  if (text) { console.log(`\n${/think|thought/i.test(t) || o.thinking || o.thought ? "\x1b[2m💭 " : ""}${text}\x1b[0m`); return; }
  for (const v of Object.values(o)) walk(v, depth + 1);
};
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  try { walk(JSON.parse(line)); } catch { console.log(line); }
}
