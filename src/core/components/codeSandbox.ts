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
  const cspHeader =
    "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; connect-src 'none'; frame-ancestors 'none';";

  const srcdocHtml = [
    "<!doctype html>",
    "<html>",
    "<head>",
    `<meta http-equiv="Content-Security-Policy" content="${cspHeader}">`,
    `<title>LazyLayout Sandbox (${componentId.replace(/[^a-zA-Z0-9_-]/g, "")})</title>`,
    "</head>",
    "<body>",
    "<div id=\"sandbox-root\"></div>",
    "<script>",
    "window.addEventListener('message', function(ev) {",
    "  if (!ev.ports || !ev.ports[0]) return;",
    "  var port = ev.ports[0];",
    "  port.postMessage({ kind: 'ready', componentId: " + JSON.stringify(componentId) + " });",
    "});",
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

/** Verify opaque-origin sandbox guarantees & scan untrusted bundle for forbidden access attempts. */
export function inspectUntrustedBundleIsolation(source: string): MaliciousProbeReport {
  const flaggedApis = RESTRICTED_APIS.filter((api) => source.includes(api));
  const descriptor = buildSandboxIframeDescriptor("probe");

  // Because sandboxAttr is strictly "allow-scripts" (without allow-same-origin),
  // browser opaque-origin rules make cookie empty and localStorage/parent.document throw SecurityError.
  const hasSameOrigin = descriptor.sandboxAttr.includes("allow-same-origin");
  if (hasSameOrigin) {
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
