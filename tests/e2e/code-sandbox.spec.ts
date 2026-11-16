/**
 * Phase 195 (Decision 0012): the code-component sandbox, checked in a real browser.
 *
 * The page that hosts the frame has a cookie and a token in localStorage. A hostile bundle runs inside the sandbox
 * frame built by `buildSandboxIframeDescriptor` and tries to read both, the parent document and the network. Each must
 * fail, and the token must never reach the frame. A normal bundle must still run and talk to the host.
 */
import { test, expect, type Page } from "@playwright/test";
import { buildSandboxIframeDescriptor } from "../../src/core/components/codeSandbox";

const HOST = "https://host.test/";
const TOKEN = "secret-editor-token-1234";

async function hostPage(page: Page): Promise<void> {
  await page.route(`${HOST}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Host page</title><body></body>" }),
  );
  await page.goto(HOST);
  await page.evaluate((token) => {
    document.cookie = `session=${token}; path=/`;
    localStorage.setItem("auth_token", token);
  }, TOKEN);
}

/** Mount the sandbox frame, send `bundle` in an init message and collect what the guest posts back. */
async function runInSandbox(page: Page, bundle: string): Promise<{ kind: string; eventName?: string; payload?: Record<string, string> }[]> {
  const { srcdocHtml, sandboxAttr } = buildSandboxIframeDescriptor("probe");
  return page.evaluate(
    ({ srcdocHtml, sandboxAttr, bundle }) =>
      new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", sandboxAttr);
        frame.srcdoc = srcdocHtml;
        const got: unknown[] = [];
        frame.addEventListener("load", () => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (m) => {
            got.push(m.data);
            if (m.data?.kind === "ready") channel.port1.postMessage({ kind: "init", componentId: "probe", bundleCode: bundle, initialProps: {} });
            if (m.data?.kind === "event_emit" && m.data.eventName === "done") resolve(got as never);
          };
          frame.contentWindow!.postMessage({ kind: "connect" }, "*", [channel.port2]);
        });
        document.body.appendChild(frame);
        setTimeout(() => resolve(got as never), 5000);
      }),
    { srcdocHtml, sandboxAttr, bundle },
  );
}

test("a hostile bundle can't read the host's cookie, storage, document or network", async ({ page }) => {
  await hostPage(page);
  const events = await runInSandbox(
    page,
    `
    var r = {};
    try { r.cookie = String(document.cookie); } catch (e) { r.cookie = "ERR:" + e.name; }
    try { r.storage = String(localStorage.getItem("auth_token")); } catch (e) { r.storage = "ERR:" + e.name; }
    try { r.parent = String(parent.document.cookie); } catch (e) { r.parent = "ERR:" + e.name; }
    try { r.top = String(window.top.localStorage.getItem("auth_token")); } catch (e) { r.top = "ERR:" + e.name; }
    host.emit("probe", r);
    fetch("${HOST}steal").then(function () { host.emit("fetch", { result: "sent" }); host.emit("done", {}); },
                               function (e) { host.emit("fetch", { result: "ERR:" + e.name }); host.emit("done", {}); });
    `,
  );
  const probe = events.find((e) => e.eventName === "probe")?.payload;
  const fetched = events.find((e) => e.eventName === "fetch")?.payload;
  expect(probe, JSON.stringify(events)).toBeTruthy();
  // Chromium throws a SecurityError; other engines may return "". Either way the host's cookie is out of reach.
  expect(["", "ERR:SecurityError"]).toContain(probe!.cookie);
  expect(probe!.storage).toBe("ERR:SecurityError");
  expect(probe!.parent).toBe("ERR:SecurityError");
  expect(probe!.top).toBe("ERR:SecurityError");
  expect(fetched?.result).toMatch(/^ERR:/);
  expect(JSON.stringify(events)).not.toContain(TOKEN);
});

test("a normal bundle runs in the sandbox and sends events to the host", async ({ page }) => {
  await hostPage(page);
  const events = await runInSandbox(page, `host.root.textContent = "hi " + (props.name || "there"); host.emit("rendered", { text: host.root.textContent }); host.emit("done", {});`);
  expect(events[0]).toMatchObject({ kind: "ready", componentId: "probe" });
  expect(events.find((e) => e.eventName === "rendered")?.payload).toEqual({ text: "hi there" });
});

test("a bundle that throws reports an error instead of breaking the frame", async ({ page }) => {
  await hostPage(page);
  const events = await runInSandbox(page, `setTimeout(function () { host.emit("done", {}); }, 0); throw new Error("boom");`);
  expect(events.find((e) => e.eventName === "error")?.payload).toEqual({ message: "boom" });
});
