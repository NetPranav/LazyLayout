export interface FramePresetItem {
  name: string;
  width: number;
  height: number;
}

export interface FramePresetGroup {
  group: string;
  items: FramePresetItem[];
}

export const FRAME_PRESET_GROUPS: readonly FramePresetGroup[] = [
  {
    group: "Desktop",
    items: [
      { name: "Desktop", width: 1440, height: 900 },
      { name: "MacBook Air", width: 1280, height: 832 },
      { name: 'MacBook Pro 14"', width: 1512, height: 982 },
      { name: "Large", width: 1920, height: 1080 },
    ],
  },
  {
    group: "Tablet",
    items: [
      { name: "iPad mini", width: 744, height: 1133 },
      { name: 'iPad Pro 11"', width: 834, height: 1194 },
      { name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
      { name: "Surface Pro", width: 912, height: 1368 },
    ],
  },
  {
    group: "Phone",
    items: [
      { name: "iPhone 16", width: 393, height: 852 },
      { name: "iPhone 16 Pro Max", width: 440, height: 956 },
      { name: "iPhone SE", width: 375, height: 667 },
      { name: "Android", width: 360, height: 800 },
      { name: "Pixel 9", width: 412, height: 915 },
    ],
  },
  {
    group: "Watch",
    items: [{ name: "Apple Watch 45mm", width: 198, height: 242 }],
  },
  {
    group: "Social",
    items: [
      { name: "Instagram post", width: 1080, height: 1080 },
      { name: "Story", width: 1080, height: 1920 },
      { name: "X post", width: 1600, height: 900 },
      { name: "LinkedIn banner", width: 1584, height: 396 },
      { name: "YouTube thumbnail", width: 1280, height: 720 },
    ],
  },
  {
    group: "Print",
    items: [
      { name: "A4", width: 595, height: 842 },
      { name: "Letter", width: 612, height: 792 },
    ],
  },
  {
    group: "Presentation",
    items: [
      { name: "16:9", width: 1920, height: 1080 },
      { name: "4:3", width: 1024, height: 768 },
    ],
  },
];

export function computeProportionalGlyph(
  w: number,
  h: number,
  maxDim = 18
): { width: number; height: number } {
  const m = Math.max(w, h);
  if (m <= 0) return { width: 3, height: 3 };
  const a = Math.max(3, Math.round((maxDim * w) / m));
  const b = Math.max(3, Math.round((maxDim * h) / m));
  return { width: a, height: b };
}

export function applyOrientation(
  w: number,
  h: number,
  orientation: "p" | "l" | ""
): [number, number] {
  if (orientation === "p" && w > h) return [h, w];
  if (orientation === "l" && h > w) return [h, w];
  return [w, h];
}
