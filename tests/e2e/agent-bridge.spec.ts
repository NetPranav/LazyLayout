/**
 * ROADMAP Phase 50 gate, in a real browser: the editor pairs with a local MCP bridge by a code it shows, nothing works
 * before that, and a change Claude asks for waits for a click on Approve (or Reject), is one undo step, and is logged.
 * The bridge here is the real `bin/lazylayout-mcp` WebSocket server running in the test; the editor is the real app.
 */
import { test, expect, type Page } from "@playwright/test";
import { startBridge, type RunningBridge } from "../../bin/lazylayout-mcp/bridgeServer";
import { focusApp, openEditor, openFileMenu } from "./support/editor";

const MOD = process.platform === "darwin" ? "Meta" : "Control";
let bridge: RunningBridge;

test.beforeEach(async () => {
  bridge = await startBridge({ port: 0, allowedOrigins: ["http://localhost:3000"] });
});
test.afterEach(async () => {
  await bridge.close();
});

async function layerNames(ids: string[]) {
  const r = await bridge.request("get_layers", { ids });
  return (r.result as { layers: { id: string; name: string }[] }).layers.map((l) => l.name);
}

async function open(page: Page) {
  await page.addInitScript((port) => {
    (window as unknown as { __LL_AGENT_PORT__: number }).__LL_AGENT_PORT__ = port;
  }, bridge.port);
  await openEditor(page);
  await page.getByRole("button", { name: "Mount Showcase Demo" }).click();
  await page.waitForTimeout(500);
  await openFileMenu(page);
  await page.getByRole("menuitem", { name: /Pair with Claude/ }).click();
  return page.getByRole("dialog", { name: "Pair with Claude" });
}

test("Phase 50: pairing by the code in the editor, then an approved change is one undo step", async ({ page }) => {
  const dialog = await open(page);
  await expect(dialog.getByText("Connected. Tell Claude the code below.")).toBeVisible({ timeout: 15_000 });
  const code = (await dialog.getByLabel("Pairing code").textContent())!.trim();
  expect(code).toMatch(/^\d{8}$/);

  // nothing works before a code is accepted
  const early = await bridge.request("get_selection", {});
  expect(early.error?.code).toBe("not-paired");
  const wrong = await bridge.request("pair", { code: code === "00000000" ? "11111111" : "00000000" });
  expect(wrong.error?.code).toBe("bad-code");
  const paired = await bridge.request("pair", { code });
  expect(paired.error).toBeUndefined();
  await expect(dialog.getByText("Paired with Claude")).toBeVisible();

  // read what is there
  const all = (await bridge.request("get_layers", {})).result as { layers: { id: string; name: string; archetype: string }[] };
  expect(all.layers.length).toBeGreaterThan(2);
  const target = all.layers.find((l) => l.archetype !== "container") ?? all.layers[1];
  const before = (await layerNames([target.id]))[0];
  const listed = (await bridge.request("list_commands", { query: "layer.setName" })).result as { id: string }[];
  expect(listed.map((c) => c.id)).toContain("layer.setName");

  // a change waits for Approve
  const asked = bridge.request("run_command", { id: "layer.setName", args: { id: target.id, name: "Named by Claude" } });
  await expect(dialog.getByText("Waiting for you")).toBeVisible();
  expect((await layerNames([target.id]))[0], "nothing changed while it waited").toBe(before);
  await dialog.getByRole("button", { name: "Approve" }).click();
  expect((await asked).error).toBeUndefined();
  expect((await layerNames([target.id]))[0]).toBe("Named by Claude");
  await expect(dialog.getByText("What Claude changed")).toBeVisible();

  // one undo step takes it back
  await focusApp(page);
  await page.keyboard.press(`${MOD}+z`);
  await expect.poll(async () => (await layerNames([target.id]))[0]).toBe(before);

  // Reject changes nothing
  const refused = bridge.request("run_command", { id: "layer.setName", args: { id: target.id, name: "Never" } });
  await dialog.getByRole("button", { name: "Reject" }).click();
  expect((await refused).error?.code).toBe("rejected");
  expect((await layerNames([target.id]))[0]).toBe(before);
});

test("Phase 50: Claude can't reach its own approval switch", async ({ page }) => {
  const dialog = await open(page);
  await expect(dialog.getByText("Connected. Tell Claude the code below.")).toBeVisible({ timeout: 15_000 });
  const code = (await dialog.getByLabel("Pairing code").textContent())!.trim();
  await bridge.request("pair", { code });
  const r = await bridge.request("run_command", { id: "agent.pair" });
  expect(r.error?.code).toBe("invalid-params");
  await expect(dialog.getByRole("checkbox", { name: /Approve changes automatically/ })).not.toBeChecked();
});
