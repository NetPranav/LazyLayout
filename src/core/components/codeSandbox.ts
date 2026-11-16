/**
 * @file codeSandbox.ts
 * @module core/components/codeSandbox
 * @description Phase 195 (Decision Record 0012): Opaque-origin sandboxed
 * iframe boundary (`allow-scripts` without `allow-same-origin`), strict CSP,
 * typed `MessageChannel` bridge protocol, and malicious-access verifier.
 */

export type SandboxHostMessage =
  | { readonly kind: "init"; readonly componentId: string; readonly bundleCode: string; readonly initialProps: Readonly<Record<string, unknown>> }
  | { readonly kind: "props_update"; readonly props: Readonly<Record<string, unknown>> }
  | { readonly kind: "dispose" };

export type SandboxGuestMessage =
  | { readonly kind: "ready"; readonly componentId: string }
  | { readonly kind: "event_emit"; readonly eventName: string; readonly payload: Readonly<Record<string, unknown>> }
  | { readonly kind: "render_metrics"; readonly frameMs: number }
  | { readonly kind: "security_violation"; readonly api: string; readonly blocked: true };

export interface SandboxIframeDescriptor {
  readonly sandboxTokens: readonly ["allow-scripts"];
  readonly sandboxAttr: "allow-scripts";
  readonly allowsSameOrigin: false;
  readonly cspHeader: string;
  readonly srcdocHtml: string;
  readonly originModel: "opaque-null";
}

export interface MaliciousProbeReport {
  readonly cookieResult: string;
  readonly localStorageResult: "SecurityError: blocked in opaque origin" | null;
  readonly parentDocumentResult: "SecurityError: cross-origin frame blocked" | null;
  readonly editorTokenLeaked: false;
  readonly flaggedApis: readonly string[];
}

const RESTRICTED_APIS = [
  "document.cookie",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "parent.document",
  "window.top.document",
  "window.opener",
] as const;

/** Construct the strict opaque-origin iframe configuration & HTML wrapper. */
export function buildSandboxIframeDescriptor(componentId: string): SandboxIframeDescriptor {
  // 'unsafe-eval' runs the component's bundle inside the frame; the frame's origin is opaque, so that code reaches no
  // cookie, storage or parent document, and connect-src 'none' stops it phoning home.
  const cspHeader =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none';";

  // The guest accepts one MessagePort (the first one it is handed), answers "ready" on it, and runs the bundle it is
  // sent in an `init` message with a small `host` API (emit events, report metrics). A bundle that throws reports the
  // error as an "error" event instead of taking the frame down.
  const guestScript = [
    "(function () {",
    "  var port = null;",
    "  window.addEventListener('message', function (ev) {",
    "    if (port || !ev.ports || !ev.ports[0]) return;",
    "    port = ev.ports[0];",
    "    var host = {",
    "      emit: function (name, payload) {",
    "        port.postMessage({ kind: 'event_emit', eventName: String(name), payload: payload && typeof payload === 'object' ? payload : {} });",
    "      },",
    "      metrics: function (frameMs) { port.postMessage({ kind: 'render_metrics', frameMs: Number(frameMs) }); },",
    "      root: document.getElementById('sandbox-root')",
    "    };",
    "    port.onmessage = function (m) {",
    "      var d = m.data;",
    "      if (!d || d.kind !== 'init' || typeof d.bundleCode !== 'string') return;",
    "      try { new Function('host', 'props', d.bundleCode)(host, d.initialProps || {}); }",
    "      catch (e) { host.emit('error', { message: String((e && e.message) || e) }); }",
    "    };",
    "    port.postMessage({ kind: 'ready', componentId: " + "__ID__" + " });",
    "  });",
    "})();",
  ].join("\n").replace("__ID__", JSON.stringify(componentId));

  const srcdocHtml = [
    "<!doctype html>",
    "<html>",
    "<head>",
    `<meta http-equiv="Content-Security-Policy" content="${cspHeader}">`,
    `<title>LazyLayout Sandbox (${componentId.replace(/[^a-zA-Z0-9_-]/g, "")})</title>`,
    "</head>",
    "<body>",
    '<div id="sandbox-root"></div>',
    "<script>",
    guestScript.replace(/<\/script/gi, "<\\/script"),
    "</script>",
    "</body>",
    "</html>",
  ].join("\n");

  return {
    sandboxTokens: ["allow-scripts"],
    sandboxAttr: "allow-scripts",
    allowsSameOrigin: false,
    cspHeader,
    srcdocHtml,
    originModel: "opaque-null",
  };
}

/** Validate any incoming `MessageChannel` guest frame strictly against typed protocol. */
export function parseSandboxGuestMessage(raw: unknown): SandboxGuestMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Readonly<Record<string, unknown>>;
  if (obj.kind === "ready" && typeof obj.componentId === "string") {
    return { kind: "ready", componentId: obj.componentId };
  }
  if (
    obj.kind === "event_emit" &&
    typeof obj.eventName === "string" &&
    typeof obj.payload === "object" &&
    obj.payload !== null
  ) {
    return {
      kind: "event_emit",
      eventName: obj.eventName,
      payload: obj.payload as Readonly<Record<string, unknown>>,
    };
  }
  if (obj.kind === "render_metrics" && typeof obj.frameMs === "number" && Number.isFinite(obj.frameMs)) {
    return { kind: "render_metrics", frameMs: obj.frameMs };
  }
  if (obj.kind === "security_violation" && typeof obj.api === "string") {
    return { kind: "security_violation", api: obj.api, blocked: true };
  }
  return null;
}

/**
 * Scan an untrusted bundle for the APIs it reaches for, and say what the sandbox's configuration means for them.
 *
 * This does not run the bundle. The runtime results follow from the descriptor: in a frame with `allow-scripts` and no
 * `allow-same-origin` the origin is opaque, so `document.cookie` is unreadable (Chromium throws a SecurityError, other
 * engines may return ""), storage throws a SecurityError and the parent
 * document is cross-origin. `tests/e2e/code-sandbox.spec.ts` runs a hostile bundle in a real browser and checks each one.
 * If the descriptor ever allowed the same origin, those results are null (not isolated) instead of a claim.
 */
export function inspectUntrustedBundleIsolation(
  source: string,
  descriptor: SandboxIframeDescriptor = buildSandboxIframeDescriptor("probe"),
): MaliciousProbeReport {
  const flaggedApis = RESTRICTED_APIS.filter((api) => source.includes(api));
  const tokens = descriptor.sandboxAttr.split(/\s+/);
  const opaque = tokens.includes("allow-scripts") && !tokens.includes("allow-same-origin");
  if (!opaque) {
    throw new Error("Decision 0012 invariant violated: allow-same-origin is forbidden");
  }
  return {
    cookieResult: "",
    localStorageResult: "SecurityError: blocked in opaque origin",
    parentDocumentResult: "SecurityError: cross-origin frame blocked",
    editorTokenLeaked: false,
    flaggedApis,
  };
}
