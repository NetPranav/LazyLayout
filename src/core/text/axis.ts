/** Variable-font axis animation (Design track D12): `font-variation-settings` from the layer's own settings and one animated axis. */
export function variationSettings(read: (path: string) => unknown): string | null {
  const own = typeof read("typography.fontVariations") === "string" ? (read("typography.fontVariations") as string).trim() : "";
  const tag = typeof read("text.axis") === "string" ? (read("text.axis") as string).trim() : "";
  const value = read("text.axisValue");
  if (!/^[A-Za-z0-9]{4}$/.test(tag) || typeof value !== "number" || !Number.isFinite(value)) return own || null;
  const kept = own.split(",").map((s) => s.trim()).filter((s) => s !== "" && !s.startsWith(`"${tag}"`) && !s.startsWith(`'${tag}'`));
  return [...kept, `"${tag}" ${+value.toFixed(3)}`].join(", ");
}

/** Gradient sheen (Design track D12): a band of light crossing the text, from 0 (left of it) to 1 (right of it); null when off (a value below 0 or none). */
export function sheenBackground(read: (path: string) => unknown): string | null {
  const v = read("text.sheen");
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  const base = typeof read("typography.color") === "string" ? (read("typography.color") as string) : "#0f172a";
  const light = typeof read("text.sheenColor") === "string" && read("text.sheenColor") !== "" ? (read("text.sheenColor") as string) : "#ffffff";
  const at = -20 + Math.min(1, v) * 140; // from just off the left edge to just off the right
  const f = (n: number) => `${+n.toFixed(2)}%`;
  return `linear-gradient(105deg, ${base} 0%, ${base} ${f(at - 15)}, ${light} ${f(at)}, ${base} ${f(at + 15)}, ${base} 100%)`;
}
