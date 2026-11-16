import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSandboxIframeDescriptor,
  inspectUntrustedBundleIsolation,
  parseSandboxGuestMessage,
} from "../codeSandbox";

describe("Phase 195: Sandbox boundaries for untrusted code (Decision 0012)", () => {
  it("enforces opaque origin allow-scripts without allow-same-origin and strict CSP", () => {
    const desc = buildSandboxIframeDescriptor("user-widget-1");
    assert.equal(desc.sandboxAttr, "allow-scripts");
    assert.equal(desc.allowsSameOrigin, false);
    assert.equal(desc.originModel, "opaque-null");
    assert.ok(!desc.sandboxAttr.includes("allow-same-origin"));
    assert.ok(desc.cspHeader.includes("connect-src 'none'"));
  });

  it("blocks malicious fixture reads of document.cookie, localStorage, and parent.document", () => {
    const malicious = `
      export function Evil() {
        const c = document.cookie;
        const t = window.localStorage.getItem("auth_token");
        const p = parent.document.body.innerHTML;
        return null;
      }
    `;
    const report = inspectUntrustedBundleIsolation(malicious);
    assert.equal(report.cookieResult, "unreadable");
    assert.equal(report.localStorageResult, "SecurityError: blocked in opaque origin");
    assert.equal(report.parentDocumentResult, "SecurityError: cross-origin frame blocked");
    assert.equal(report.editorTokenLeaked, false);
    assert.ok(report.flaggedApis.includes("document.cookie"));
    assert.ok(report.flaggedApis.includes("localStorage"));
    assert.ok(report.flaggedApis.includes("parent.document"));
  });

  it("validates typed MessageChannel payloads and rejects malformed messages", () => {
    assert.deepEqual(parseSandboxGuestMessage({ kind: "ready", componentId: "cmp1" }), {
      kind: "ready",
      componentId: "cmp1",
    });
    assert.equal(parseSandboxGuestMessage({ kind: "arbitrary_eval" }), null);
    assert.equal(parseSandboxGuestMessage("raw_string"), null);
  });
});
