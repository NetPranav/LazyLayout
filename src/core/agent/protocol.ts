/**
 * ============================================================================
 * AGENT BRIDGE PROTOCOL (ROADMAP Phase 50, decision record 0014)
 * ============================================================================
 * The messages between the local MCP server (`bin/lazylayout-mcp.ts`, a stdio MCP server an AI client starts) and the
 * editor tab it is paired with. They travel as JSON over a WebSocket on 127.0.0.1. The server asks, the tab answers:
 * every request has an `id`, and exactly one response carries the same `id`.
 *
 * Nothing here imports the editor, so the server and the tests can use it too.
 * ============================================================================
 */

export const BRIDGE_VERSION = 1;
export const DEFAULT_BRIDGE_PORT = 7117;
/** The pages that may open the bridge. The server refuses any other `Origin`, and a request without one. */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = ["http://localhost:3000", "http://127.0.0.1:3000"];

/** What the server can ask the tab to do. `pair` is the only one allowed before the tab has accepted a code. */
export const BRIDGE_METHODS = ["pair", "list_commands", "run_command", "get_selection", "get_layers", "get_document", "get_resource", "export_site"] as const;
export type BridgeMethod = (typeof BRIDGE_METHODS)[number];

export interface BridgeRequest {
  type: "request";
  id: number;
  method: BridgeMethod;
  params: Record<string, unknown>;
}

export type BridgeErrorCode = "not-paired" | "bad-code" | "locked" | "unknown-method" | "invalid-params" | "rejected" | "timeout" | "failed";

export interface BridgeResponse {
  type: "response";
  id: number;
  result?: unknown;
  error?: { code: BridgeErrorCode; message: string };
}

/** The tab says hello once the socket opens. */
export interface BridgeHello {
  type: "hello";
  version: number;
}

export type TabMessage = BridgeResponse | BridgeHello;

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads one JSON message from a socket; null when it isn't one of ours. */
export function parseTabMessage(raw: string): TabMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  if (v.type === "hello" && typeof v.version === "number") return { type: "hello", version: v.version };
  if (v.type === "response" && typeof v.id === "number") {
    const error = isObject(v.error) && typeof v.error.code === "string" && typeof v.error.message === "string" ? { code: v.error.code as BridgeErrorCode, message: v.error.message } : undefined;
    return { type: "response", id: v.id, ...(error ? { error } : { result: v.result }) };
  }
  return null;
}

export function parseBridgeRequest(raw: string): BridgeRequest | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(v) || v.type !== "request" || typeof v.id !== "number" || typeof v.method !== "string") return null;
  return { type: "request", id: v.id, method: v.method as BridgeMethod, params: isObject(v.params) ? v.params : {} };
}
