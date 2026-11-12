/**
 * ============================================================================
 * 3D FONT LOADER & CACHE (Phase 3D-026)
 * ============================================================================
 * Loads and caches OpenType fonts by family and weight.
 * Supports injectable font buffer fetchers for isolated test environments.
 * ============================================================================
 */

import { parseFont, type Font } from "./font";

export type FontBufferFetcher = (url: string) => Promise<ArrayBuffer>;

let customFetcher: FontBufferFetcher | null = null;
const fontCache = new Map<string, Font>();
const pendingLoads = new Map<string, Promise<Font>>();

/**
 * Sets an injectable font buffer fetcher (e.g. for mock or test environments).
 */
export function setFontBufferFetcher(fetcher: FontBufferFetcher | null): void {
  customFetcher = fetcher;
}

/**
 * Pre-registers a parsed Font in the cache.
 */
export function registerFont(family: string, font: Font, weight = "400"): void {
  const key = `${family.toLowerCase()}_${weight}`;
  fontCache.set(key, font);
}

/**
 * Pre-registers an ArrayBuffer in the cache, parsing it into a Font.
 */
export function registerFontBuffer(
  family: string,
  buffer: ArrayBuffer,
  weight = "400"
): Font {
  const font = parseFont(buffer);
  registerFont(family, font, weight);
  return font;
}

/**
 * Retrieves a cached font synchronously if already loaded.
 */
export function getCachedFont(family: string, weight = "400"): Font | undefined {
  const key = `${family.toLowerCase()}_${weight}`;
  return fontCache.get(key) ?? fontCache.get("default");
}

/**
 * Clears the font cache.
 */
export function clearFontCache(): void {
  fontCache.clear();
  pendingLoads.clear();
}

/**
 * Loads a font by family and weight, using an injectable fetcher or Google Fonts API.
 */
export async function loadFontFor(
  family: string,
  weight: number | string = "400"
): Promise<Font> {
  const wStr = String(weight);
  const key = `${family.toLowerCase()}_${wStr}`;

  const cached = fontCache.get(key);
  if (cached) return cached;

  const pending = pendingLoads.get(key);
  if (pending) return pending;

  const promise = (async () => {
    let buffer: ArrayBuffer;

    if (customFetcher) {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${wStr}`;
      buffer = await customFetcher(url);
    } else if (typeof fetch !== "undefined") {
      // Fetch CSS with legacy User-Agent to request TTF instead of WOFF2
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${wStr}`;
      const cssResp = await fetch(cssUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko",
        },
      });
      const cssText = await cssResp.text();
      const match = /url\((https:\/\/[^)]+\.ttf)\)/.exec(cssText);
      const ttfUrl = match ? match[1] : null;

      if (!ttfUrl) {
        throw new Error(`Could not find TTF font url for family "${family}" in Google Fonts.`);
      }

      const fontResp = await fetch(ttfUrl);
      buffer = await fontResp.arrayBuffer();
    } else {
      throw new Error(`Cannot load font "${family}" without a network fetcher.`);
    }

    const font = parseFont(buffer);
    fontCache.set(key, font);
    pendingLoads.delete(key);
    return font;
  })();

  pendingLoads.set(key, promise);
  return promise;
}
