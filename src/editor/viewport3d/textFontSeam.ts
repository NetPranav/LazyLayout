/**
 * ============================================================================
 * 3D TEXT FONT SEAM & TEST LOADER (Phase 3D-026, Task B3-W3-addtext)
 * ============================================================================
 * Installs an injectable `FontBufferFetcher` into `fontCache`.
 * When `window.__LL_TEST_FONT__` (base64 Geist TTF) is set before test execution,
 * this seam decodes it into an ArrayBuffer and pre-populates `fontCache` for
 * both "Geist" and "default", completely bypassing remote network font requests.
 * ============================================================================
 */

import {
  setFontBufferFetcher,
  registerFontBuffer,
  getCachedFont,
  type FontBufferFetcher,
} from "@/core/3d/text/fontCache";

/**
 * Converts a base64 encoded string into a raw ArrayBuffer.
 * Works seamlessly across Node.js and browser environments.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // 1. Node.js Buffer fast-path
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    const ab = new ArrayBuffer(buf.byteLength);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.byteLength; i++) {
      view[i] = buf[i];
    }
    return ab;
  }

  // 2. Browser standard atob
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Custom font buffer fetcher for `fontCache`.
 * Prioritizes `window.__LL_TEST_FONT__` if set in tests or test harnesses.
 */
export const fetchFontBuffer: FontBufferFetcher = async (url: string): Promise<ArrayBuffer> => {
  // `globalThis` is `window` in the browser and the Node global in unit tests
  const seam = (globalThis as unknown as { __LL_TEST_FONT__?: string }).__LL_TEST_FONT__;
  if (seam) {
    return base64ToArrayBuffer(seam);
  }

  // Fallback to standard fetch when window.__LL_TEST_FONT__ is not provided
  if (typeof fetch !== "undefined") {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch font at ${url}: ${res.statusText}`);
    }
    return await res.arrayBuffer();
  }

  throw new Error("No network fetch available and no test font buffer found.");
};

/**
 * Installs the custom font fetcher and synchronizes any pre-existing
 * `window.__LL_TEST_FONT__` into the cache.
 */
export function installTestFontSeam(): void {
  setFontBufferFetcher(fetchFontBuffer);

  {
    const win = globalThis as unknown as { __LL_TEST_FONT__?: string };
    if (win.__LL_TEST_FONT__) {
      try {
        const buf = base64ToArrayBuffer(win.__LL_TEST_FONT__);
        if (!getCachedFont("Geist")) {
          registerFontBuffer("Geist", buf);
        }
        if (!getCachedFont("default")) {
          registerFontBuffer("default", buf);
        }
      } catch (err) {
        console.warn("[3D textFontSeam] Failed to decode test font:", err);
      }
    }
  }
}

/**
 * Helper to ensure the active font family is in cache (sync or async).
 */
export async function ensureFontLoaded(family = "Geist"): Promise<void> {
  installTestFontSeam();
  if (getCachedFont(family)) return;

  {
    const win = globalThis as unknown as { __LL_TEST_FONT__?: string };
    if (win.__LL_TEST_FONT__) {
      const buf = base64ToArrayBuffer(win.__LL_TEST_FONT__);
      registerFontBuffer(family, buf);
      registerFontBuffer("default", buf);
      return;
    }
  }
}

// Auto-install on module load
installTestFontSeam();
