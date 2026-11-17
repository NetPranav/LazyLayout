import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

const MOD = process.platform === "darwin" ? "Meta" : "Control";
test.use({ viewport: { width: 1280, height: 800 } });

async function getDoc(page: Page) {
  return page.evaluate(() => {
    const api = (window as unknown as { __LL_DOC__?: { get: () => unknown } }).__LL_DOC__;
    return api?.get() as {
      layers: Record<string, { id: string; name: string; parentId: string | null; properties: Record<string, unknown> }>;
      clips: Record<string, { id: string; layerId: string; name: string; easing: string; tracks: Array<{ property: string; keyframes: unknown[] }> }>;
      states: Record<string, { id: string; layerId: string; name: string }>;
    };
  });
}

test("portable copy/paste across separate windows and Markdown text preserves properties, effects, and animations", async ({ browser, browserName }) => {
  const ctxA = await browser.newContext(browserName === "chromium" ? { permissions: ["clipboard-read", "clipboard-write"] } : {});
  const ctxB = await browser.newContext(browserName === "chromium" ? { permissions: ["clipboard-read", "clipboard-write"] } : {});
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await pageB.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });

  await Promise.all([openEditor(pageA), openEditor(pageB)]);

  const sourceId = await pageA.evaluate(() => {
    const api = (window as unknown as {
      __LL_DOC__: {
        commands: {
          addLayer: (input: Record<string, unknown>) => string;
          addClip: (layerId: string, clip: Record<string, unknown>, label?: string) => string;
          addState: (layerId: string, name: string, props?: Record<string, unknown>) => string;
        };
        get: () => { layers: Record<string, { id: string; parentId: string | null }> };
      };
    }).__LL_DOC__;
    const doc = api.get();
    const frameId = Object.values(doc.layers).find((l) => l.parentId === null)!.id;
    const layerId = api.commands.addLayer({
      archetype: "rectangle",
      parentId: frameId,
      name: "Portable CTA",
      properties: {
        positioning: "absolute",
        "frame.x": 64,
        "frame.y": 72,
        "frame.width": 200,
        "frame.height": 56,
        "shape.cornerRadius": 14,
        "paint.fills": JSON.stringify([{ type: "solid", color: "#6366f1" }]),
        "paint.shadows": JSON.stringify([{ kind: "drop", x: 0, y: 10, blur: 20, spread: 0, color: "#00000055" }]),
        "paint.effects": JSON.stringify([{ type: "noise", mode: "mono", grain: "fine", density: 0.25, color: "#ffffff", visible: true }]),
      },
    });
    api.commands.addClip(
      layerId,
      {
        id: "",
        name: "Pop In",
        type: "entrance",
        trigger: "mount",
        duration: 0.5,
        easing: "spring(bounce: 0.3, time: 0.5)",
        enabled: true,
        tracks: [
          {
            id: "tr_scale",
            property: "transform.scale",
            keyframes: [
              { id: "k1", time: 0, value: 0.8 },
              { id: "k2", time: 0.5, value: 1 },
            ],
          },
        ],
      },
      "Add Pop In",
    );
    api.commands.addState(layerId, "hover", { "transform.scale": 1.05 });
    return layerId;
  });

  // Select the layer in the left Layers panel and verify Context Menu Paste options are enabled
  const layerRow = pageA.locator(".ll-shell-left").getByText("Portable CTA").first();
  await expect(layerRow).toBeVisible();
  await layerRow.click();
  await layerRow.click({ button: "right" });
  const pasteMenuItem = pageA.getByRole("menuitem", { name: /^Paste/ }).first();
  await expect(pasteMenuItem).toBeVisible();
  await expect(pasteMenuItem).toBeEnabled();
  await pageA.keyboard.press("Escape");

  // Trigger real Ctrl+C keyboard shortcut (without hovering canvas!) and read system clipboard / mirror
  await pageA.keyboard.press(`${MOD}+c`);
  await expect.poll(() => pageA.evaluate(() => localStorage.getItem("lazylayout:clipboard") ?? "")).toContain("lazylayout:clip:1\n");
  const copiedText = await pageA.evaluate(async () => {
    try {
      const sys = await navigator.clipboard.readText();
      if (sys) return sys;
    } catch {
      // fallback
    }
    return localStorage.getItem("lazylayout:clipboard") ?? "";
  });
  expect(copiedText.startsWith("lazylayout:clip:1\n")).toBe(true);

  // Switch to completely separate Window B (isolated context & localStorage) WITHOUT hovering canvas first
  await pageB.bringToFront();
  const initialCountB = Object.keys((await getDoc(pageB)).layers).length;

  // Paste via real Ctrl+V keyboard shortcut in Window B!
  await pageB.evaluate(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback to paste event if permission unavailable
    }
  }, copiedText);
  await pageB.keyboard.press(`${MOD}+v`);

  await expect.poll(async () => Object.keys((await getDoc(pageB)).layers).length, { timeout: 5_000 }).toBe(initialCountB + 1);
  const docB = await getDoc(pageB);
  const pastedB = Object.values(docB.layers).find((l) => l.name === "Portable CTA")!;
  expect(pastedB).toBeTruthy();
  expect(pastedB.id).not.toBe(sourceId);
  expect(pastedB.properties["shape.cornerRadius"]).toBe(14);
  expect(String(pastedB.properties["paint.shadows"])).toContain("#00000055");
  expect(String(pastedB.properties["paint.effects"])).toContain("noise");
  const clipsB = Object.values(docB.clips).filter((c) => c.layerId === pastedB.id);
  expect(clipsB.length).toBe(1);
  expect(clipsB[0].name).toBe("Pop In");
  expect(clipsB[0].easing).toBe("spring(bounce: 0.3, time: 0.5)");
  expect(clipsB[0].tracks[0].keyframes.length).toBe(2);
  expect(Object.values(docB.states).filter((s) => s.layerId === pastedB.id).length).toBe(1);

  // Save copied text inside a Markdown (.md) document, copy from Markdown, and paste via Ctrl+V into a third clean window
  const ctxC = await browser.newContext(browserName === "chromium" ? { permissions: ["clipboard-read", "clipboard-write"] } : {});
  const pageC = await ctxC.newPage();
  await pageC.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await openEditor(pageC);

  const markdownSaved = `# Saved LazyLayout Design\r\n\r\nUse this button across projects:\r\n\r\n\`\`\`lazylayout\r\n${copiedText}\r\n\`\`\`\r\n\r\n_Saved in Markdown_\r\n`;
  const initialCountC = Object.keys((await getDoc(pageC)).layers).length;

  await pageC.evaluate(async (md) => {
    await navigator.clipboard.writeText(md);
  }, markdownSaved);
  await pageC.bringToFront();
  await pageC.keyboard.press(`${MOD}+v`);

  await expect.poll(async () => Object.keys((await getDoc(pageC)).layers).length, { timeout: 5_000 }).toBe(initialCountC + 1);
  const docC = await getDoc(pageC);
  const pastedC = Object.values(docC.layers).find((l) => l.name === "Portable CTA")!;
  expect(pastedC).toBeTruthy();
  expect(pastedC.properties["shape.cornerRadius"]).toBe(14);
  expect(String(pastedC.properties["paint.effects"])).toContain("noise");
  expect(Object.values(docC.clips).filter((c) => c.layerId === pastedC.id).length).toBe(1);
  expect(Object.values(docC.states).filter((s) => s.layerId === pastedC.id).length).toBe(1);

  // Switch to Motion tab in Window C and confirm the pasted animation track appears in Timeline
  await pageC.getByRole("tab", { name: "Motion" }).click();
  await expect(pageC.locator(".ll-shell-bottom").getByTestId("timeline-lane-name").filter({ hasText: "Portable CTA" })).toBeVisible();

  await Promise.all([ctxA.close(), ctxB.close(), ctxC.close()]);
});
