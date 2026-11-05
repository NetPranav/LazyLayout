/**
 * ROADMAP Phase 56 gate: "during playback the timeline panel makes <= 10 React
 * commits per second; canvas and timeline agree within 1 frame (Playwright)."
 *
 * The Sequencer no longer has a clock of its own: its play button, ruler, lane
 * clicks and playhead all act on the one transport, and its needle is painted
 * by a frame-scheduler task rather than React state.
 */
import { test, expect } from "@playwright/test";
import { openEditor, openSequencer, EDITOR_URL } from "./support/editor";

const FPS = 60;

const sequencerTime = async (page: import("@playwright/test").Page) => {
  const timeAttr = await page.getByTestId("timeline-playhead-layer").getAttribute("data-time");
  return Number(timeAttr) / FPS;
};

const barTime = async (page: import("@playwright/test").Page) => {
  const text =
    (await page
      .getByRole("toolbar", { name: "Timeline header" })
      .getByRole("button", { name: "Playhead time" })
      .textContent())?.trim() ?? "";
  const match = text.match(/^(\d\d):(\d\d)\.(\d\d)/);
  if (match) {
    const [, mm, ss, ff] = match;
    return Number(mm) * 60 + Number(ss) + Number(ff) / FPS;
  }
  const frames = Number(text);
  if (!Number.isNaN(frames)) return frames / FPS;
  return NaN;
};

async function seekTimeline(page: import("@playwright/test").Page, seconds: number) {
  const ruler = page.getByTestId("timeline-ruler");
  const pps = Number(await ruler.getAttribute("data-pps"));
  const t0 = Number(await ruler.getAttribute("data-t0"));
  const fps = Number(await ruler.getAttribute("data-fps")) || FPS;
  const f = Math.round(seconds * fps);
  const x = 24 + (f / fps - t0) * pps;
  await ruler.click({ position: { x, y: 8 } });
}

test("App bug: TimelinePanel playback has no subframe accumulator and setPlayhead rounds to integer, losing time during rAF ticks", async ({ page }) => {
  await openEditor(page, EDITOR_URL);
  await openSequencer(page);
  const bar = page.getByRole("toolbar", { name: "Timeline header" });

  await seekTimeline(page, 0.5);
  await expect.poll(() => sequencerTime(page)).toBeCloseTo(0.5, 2);
  await expect.poll(() => barTime(page)).toBeCloseTo(0.5, 1);

  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(2000);
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await page.waitForTimeout(250);
  await page.waitForTimeout(250);

  await expect.poll(async () => Math.abs((await barTime(page)) - (await sequencerTime(page)))).toBeLessThanOrEqual(1 / FPS + 1e-9);
  const fromSequencer = await sequencerTime(page);
  expect(fromSequencer, "the head moved while playing").toBeGreaterThan(0.9);
  expect(Math.abs((await barTime(page)) - fromSequencer), "timeline and transport bar differ by under a frame").toBeLessThanOrEqual(1 / FPS + 1e-9);
});

test("Phase 56: playing re-renders the timeline at most 10 times a second", async ({ page }) => {
  await openEditor(page, EDITOR_URL);
  await openSequencer(page);
  const bar = page.getByRole("toolbar", { name: "Timeline header" });

  // React commits show up as child-list / text changes; the needle and its title are written directly and do not count.
  await page.evaluate(() => {
    const region = document.querySelector('[aria-label="Motion Timeline"]')!;
    const w = window as unknown as { __commits: number };
    w.__commits = 0;
    new MutationObserver((records) => {
      if (records.some((r) => r.type === "childList" || r.type === "characterData")) w.__commits++;
    }).observe(region, { subtree: true, childList: true, characterData: true });
  });

  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await page.waitForTimeout(300); // the Play -> Pause button swap is a one-off commit, not per-frame cost
  await page.evaluate(() => ((window as unknown as { __commits: number }).__commits = 0));
  const started = Date.now();
  await page.waitForTimeout(2000);
  const seconds = (Date.now() - started) / 1000;
  const commits = await page.evaluate(() => (window as unknown as { __commits: number }).__commits);
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();

  // 10 Hz readout: one commit per 100 ms, plus at most one on the window edge.
  expect(commits, `${commits} DOM-changing commits in ${seconds.toFixed(1)} s`).toBeLessThanOrEqual(Math.ceil(10 * seconds) + 1);
});
