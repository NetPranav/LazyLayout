/**
 * ROADMAP Phase 54 — "a transport bar (play, pause, timecode, loop) that
 * controls the whole studio". New UI: the transport lives in the Motion
 * timeline header (toolbar "Timeline header").
 */
import { test, expect } from "@playwright/test";
import { openEditor, openSequencer, EDITOR_URL } from "./support/editor";

test("Phase 54: the transport bar plays, steps frames and cycles the loop mode", async ({ page }) => {
  await openEditor(page, EDITOR_URL);
  await openSequencer(page);
  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  const timecode = bar.getByRole("button", { name: "Playhead time" });
  await expect(bar).toBeVisible();
  // The new editor opens with the playhead mid-composition; start from frame 0.
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  await expect(timecode).toContainText("00:00.00");

  await bar.getByRole("button", { name: "Step forward (Right)" }).click();
  await expect(timecode).toContainText("00:00.01");

  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();
  await expect.poll(async () => (await timecode.textContent()) ?? "", { timeout: 3000 }).not.toMatch(/^00:00\.0[01]/);
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Play (Space)", exact: true })).toBeVisible();

  await bar.getByRole("button", { name: "Go to start (Home)" }).click();
  await expect(timecode).toContainText("00:00.00");

  await bar.getByRole("button", { name: "Loop: Off" }).click();
  await expect(bar.getByRole("button", { name: "Loop: Loop" })).toBeVisible();
  await bar.getByRole("button", { name: "Loop: Loop" }).click();
  await expect(bar.getByRole("button", { name: "Loop: Ping-pong" })).toBeVisible();
});
