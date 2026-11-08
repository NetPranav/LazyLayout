export type FontCategory = "All" | "Sans" | "Serif" | "Mono" | "Display";

export const FONT_CATEGORIES: readonly FontCategory[] = [
  "All",
  "Sans",
  "Serif",
  "Mono",
  "Display",
];

export interface FontEntry {
  name: string;
  group: "proj" | "sys" | "lib";
  category: "Sans" | "Serif" | "Mono" | "Display";
  meta: string;
}

export const KNOWN_CATEGORIES: Record<string, "Sans" | "Serif" | "Mono" | "Display"> = {
  // Sans
  Geist: "Sans",
  Inter: "Sans",
  Roboto: "Sans",
  "Open Sans": "Sans",
  Lato: "Sans",
  Montserrat: "Sans",
  Poppins: "Sans",
  "Source Sans 3": "Sans",
  "Noto Sans": "Sans",
  "Work Sans": "Sans",
  "DM Sans": "Sans",
  Manrope: "Sans",
  "Space Grotesk": "Sans",
  Nunito: "Sans",
  Raleway: "Sans",
  Rubik: "Sans",
  "Fira Sans": "Sans",
  "IBM Plex Sans": "Sans",
  Barlow: "Sans",
  Karla: "Sans",
  Cabin: "Sans",
  Quicksand: "Sans",
  "Josefin Sans": "Sans",
  Archivo: "Sans",
  "System UI": "Sans",
  Helvetica: "Sans",

  // Serif
  "Playfair Display": "Serif",
  Merriweather: "Serif",
  Lora: "Serif",
  "Libre Baskerville": "Serif",
  "Cormorant Garamond": "Serif",
  Georgia: "Serif",
  "PT Serif": "Serif",
  "EB Garamond": "Serif",
  Cinzel: "Serif",
  "Bodoni Moda": "Serif",

  // Mono
  "IBM Plex Mono": "Mono",
  "JetBrains Mono": "Mono",
  "Space Mono": "Mono",
  Menlo: "Mono",
  "Fira Code": "Mono",
  "Source Code Pro": "Mono",
  "Roboto Mono": "Mono",

  // Display
  "DM Serif Display": "Display",
  "Bebas Neue": "Display",
  Oswald: "Display",
  Righteous: "Display",
  Abril: "Display",
  Syne: "Display",
};

const SYSTEM_STACKS: Record<string, string> = {
  "System UI": 'system-ui, -apple-system, "Segoe UI", sans-serif',
  Helvetica: "Helvetica, Arial, sans-serif",
  Georgia: "Georgia, serif",
  Menlo: "Menlo, Consolas, monospace",
};

const CATEGORY_FALLBACKS: Record<string, string> = {
  Sans: "system-ui, sans-serif",
  Serif: "Georgia, serif",
  Mono: "ui-monospace, Menlo, monospace",
  Display: "Impact, sans-serif",
};

export function getFontCategory(name: string): "Sans" | "Serif" | "Mono" | "Display" {
  return KNOWN_CATEGORIES[name] ?? "Sans";
}

export function fontStack(name: string): string {
  if (SYSTEM_STACKS[name]) return SYSTEM_STACKS[name];
  const cat = getFontCategory(name);
  const fallback = CATEGORY_FALLBACKS[cat] ?? "sans-serif";
  const safeName = /^[A-Za-z0-9-]+$/.test(name) ? name : `"${name}"`;
  return `${safeName}, ${fallback}`;
}

export interface MatchSlice {
  text: string;
  isMatch: boolean;
}

/**
 * Fuzzy or substring match highlighting. Returns slices with `isMatch` flag or null if no match.
 */
export function matchHighlight(name: string, query: string): MatchSlice[] | null {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text: name, isMatch: false }];

  const ln = name.toLowerCase();
  const subIdx = ln.indexOf(q);
  if (subIdx !== -1) {
    const slices: MatchSlice[] = [];
    if (subIdx > 0) slices.push({ text: name.slice(0, subIdx), isMatch: false });
    slices.push({ text: name.slice(subIdx, subIdx + q.length), isMatch: true });
    if (subIdx + q.length < name.length) {
      slices.push({ text: name.slice(subIdx + q.length), isMatch: false });
    }
    return slices;
  }

  // Subsequence match
  let qIdx = 0;
  const matchIndices: number[] = [];
  for (let i = 0; i < ln.length && qIdx < q.length; i++) {
    if (ln[i] === q[qIdx]) {
      matchIndices.push(i);
      qIdx++;
    }
  }

  if (qIdx !== q.length) return null;

  const slices: MatchSlice[] = [];
  let lastIdx = 0;
  for (const idx of matchIndices) {
    if (idx > lastIdx) {
      slices.push({ text: name.slice(lastIdx, idx), isMatch: false });
    }
    slices.push({ text: name.slice(idx, idx + 1), isMatch: true });
    lastIdx = idx + 1;
  }
  if (lastIdx < name.length) {
    slices.push({ text: name.slice(lastIdx), isMatch: false });
  }
  return slices;
}

export const DEFAULT_PROJECT_FONTS: readonly FontEntry[] = [
  { name: "Geist", group: "proj", category: "Sans", meta: "9 weights" },
  { name: "Inter", group: "proj", category: "Sans", meta: "9 weights" },
];

export const SYSTEM_FONTS: readonly FontEntry[] = [
  { name: "System UI", group: "sys", category: "Sans", meta: "System" },
  { name: "Helvetica", group: "sys", category: "Sans", meta: "System" },
  { name: "Georgia", group: "sys", category: "Serif", meta: "System" },
  { name: "Menlo", group: "sys", category: "Mono", meta: "System" },
];

export const LIBRARY_FONTS: readonly FontEntry[] = [
  { name: "Roboto", group: "lib", category: "Sans", meta: "Sans" },
  { name: "Montserrat", group: "lib", category: "Sans", meta: "Sans" },
  { name: "Poppins", group: "lib", category: "Sans", meta: "Sans" },
  { name: "DM Sans", group: "lib", category: "Sans", meta: "Sans" },
  { name: "Space Grotesk", group: "lib", category: "Sans", meta: "Sans" },
  { name: "Playfair Display", group: "lib", category: "Serif", meta: "Serif" },
  { name: "Merriweather", group: "lib", category: "Serif", meta: "Serif" },
  { name: "Lora", group: "lib", category: "Serif", meta: "Serif" },
  { name: "Cormorant Garamond", group: "lib", category: "Serif", meta: "Serif" },
  { name: "Space Mono", group: "lib", category: "Mono", meta: "Mono" },
  { name: "IBM Plex Mono", group: "lib", category: "Mono", meta: "Mono" },
  { name: "JetBrains Mono", group: "lib", category: "Mono", meta: "Mono" },
  { name: "Bebas Neue", group: "lib", category: "Display", meta: "Display" },
  { name: "DM Serif Display", group: "lib", category: "Display", meta: "Display" },
  { name: "Oswald", group: "lib", category: "Display", meta: "Display" },
];
