/**
 * ROADMAP_3D 3D-004: golden images for GPU output.
 *
 *   await expectGolden(page.locator("canvas"), "surface-rest");
 *
 * Compares the picture with `tests/golden/<name>.png` using `src/core/gpu/compare.ts` (SSIM plus a neighbourhood
 * error that forgives a 1 px shift). The goldens are made by the same headless Chromium that CI runs (software GL).
 * - A missing golden is written (and the test passes with a note), so a new test starts by running once.
 * - `GOLDEN_UPDATE=1 npx playwright test …` approves a changed golden: review the diff in the PR (the changed .png).
 * - A failure writes `<name>.actual.png` and `<name>.diff.png` (red where it differs) to the test's output folder and
 *   attaches both to the report.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compare, type CompareOptions } from "../../src/core/gpu/compare";

const GOLDEN_DIR = resolve(__dirname, "../golden");

export async function expectGolden(target: Locator | Page, name: string, options: Partial<CompareOptions> & { clip?: { x: number; y: number; width: number; height: number } } = {}): Promise<void> {
  const { clip, ...compareOptions } = options;
  const shot = await (target as Page).screenshot({ ...(clip ? { clip } : {}), animations: "disabled" } as never).catch(() => null);
  const buffer = shot ?? (await (target as Locator).screenshot({ animations: "disabled" }));
  const actual = PNG.sync.read(buffer);
  const file = join(GOLDEN_DIR, `${name}.png`);
  if (!existsSync(file) || process.env.GOLDEN_UPDATE === "1") {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PNG.sync.write(actual));
    test.info().annotations.push({ type: "golden", description: `${name}: written` });
    return;
  }
  const golden = PNG.sync.read(readFileSync(file));
  const result = compare({ width: actual.width, height: actual.height, data: actual.data }, { width: golden.width, height: golden.height, data: golden.data }, compareOptions);
  if (!result.pass) {
    const out = test.info().outputPath(`${name.replace(/\//g, "_")}`);
    const diff = new PNG({ width: result.diff.width, height: result.diff.height });
    diff.data = Buffer.from(result.diff.data);
    writeFileSync(`${out}.actual.png`, PNG.sync.write(actual));
    writeFileSync(`${out}.diff.png`, PNG.sync.write(diff));
    await test.info().attach(`${name} actual`, { path: `${out}.actual.png`, contentType: "image/png" });
    await test.info().attach(`${name} diff`, { path: `${out}.diff.png`, contentType: "image/png" });
  }
  expect(result.pass, `${name}: ${(result.badFraction * 100).toFixed(2)}% of pixels differ, SSIM ${result.ssim.toFixed(3)}, largest error ${result.maxError}`).toBe(true);
}
