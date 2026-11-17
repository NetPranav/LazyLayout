/**
 * CPU profiles (CDP) of three slow moments in a heavy scene, written to PROFILE_DIR as .cpuprofile files.
 * Local investigation only. Run against a build with LL_PROFILE_MAPS=1 so the profiles resolve to source.
 */
import { test, type Page, type CDPSession } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openEditor } from "../e2e/support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });
test.setTimeout(300_000);

const dir = process.env.PROFILE_DIR ?? "test-results/profiles";

async function profile(cdp: CDPSession, name: string, run: () => Promise<void>) {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await run();
  const { profile: p } = await cdp.send("Profiler.stop");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.cpuprofile`), JSON.stringify(p));
}
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test("profile heavy scene", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE ?? 4) });
  await openEditor(page);
  await page.locator("[data-stage=artboard]").waitFor();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Control+d");
    await frames(page);
  }
  await profile(cdp, "duplicate", async () => {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Control+d");
      await frames(page);
    }
  });
  await page.waitForTimeout(800);
  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await profile(cdp, "motion-open", async () => {
    await page.getByRole("tab", { name: "Motion" }).click();
    await bar.waitFor();
    await page.waitForTimeout(1500);
  });
  await profile(cdp, "play", async () => {
    await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
    await page.waitForTimeout(2500);
  });
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
});

test("trace heavy playback", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE ?? 4) });
  await openEditor(page);
  await page.locator("[data-stage=artboard]").waitFor();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Control+d");
    await frames(page);
  }
  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await page.getByRole("tab", { name: "Motion" }).click();
  await bar.waitFor();
  await page.waitForTimeout(1500);
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await page.waitForTimeout(800); // past the start
  await browser.startTracing(page, { path: path.join(dir, "play-trace.json"), categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] });
  await page.waitForTimeout(2000);
  await browser.stopTracing();
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  // what the headline animates
  const props = await page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const a of document.getAnimations()) {
      const eff = a.effect as KeyframeEffect | null;
      for (const k of eff?.getKeyframes() ?? []) for (const p of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(p)) out[p] = (out[p] ?? 0) + 1;
    }
    return { animations: document.getAnimations().length, props: out };
  });
  console.log("ANIMS " + JSON.stringify(props));
});

test("trace duplicates", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE ?? 4) });
  await openEditor(page);
  await page.locator("[data-stage=artboard]").waitFor();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Control+d");
    await frames(page);
  }
  await page.waitForTimeout(1000);
  await browser.startTracing(page, { path: path.join(dir, "dup-trace.json"), categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.timeline.invalidationTracking"] });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Control+d");
    await frames(page);
  }
  await browser.stopTracing();
});
