/**
 * ============================================================================
 * THE MCP SERVER (ROADMAP Phase 50, decision record 0014)
 * ============================================================================
 * Speaks the Model Context Protocol on stdio (newline-delimited JSON-RPC 2.0) and answers it by asking the paired
 * editor tab through a `Bridge`. It keeps no document and runs no command itself: the tab does, behind its pairing
 * code and its approval gate (`src/core/agent/agentHost.ts`).
 *
 * Tools: `pair`, `list_commands`, `run_command`, `get_selection`, `get_layers`, `get_document`, `export_site`.
 * Resources: the MDM JSON Schema and the property paths. A few tools stand in for the command registry's several
 * hundred commands, which would swamp a client as one tool each: `list_commands` gives every command with its
 * JSON Schema, and `run_command` runs any of them.
 *
 * Written by hand over JSON-RPC (a few hundred lines) rather than the MCP SDK, to keep the dependency list short.
 * ============================================================================
 */

import type { BridgeMethod, BridgeResponse } from "../../src/core/agent/protocol";

/** How the server asks the editor tab. */
export interface Bridge {
  isConnected(): boolean;
  request(method: BridgeMethod, params: Record<string, unknown>): Promise<BridgeResponse>;
}

export const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
const SERVER_INFO = { name: "lazylayout-mcp", version: "0.1.0" };

export interface RpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}
export interface RpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

export const TOOLS: { name: string; method: BridgeMethod; description: string; inputSchema: unknown; write?: boolean }[] = [
  { name: "pair", method: "pair", description: "Pair with the open editor. The user reads an 8-digit code in the editor (File > Pair with Claude) and tells you; nothing else works before this.", inputSchema: obj({ code: { type: "string" } }, ["code"]) },
  { name: "list_commands", method: "list_commands", description: "Every command the editor can run, with its argument JSON Schema. Filter by text or category.", inputSchema: obj({ query: { type: "string" }, category: { type: "string" } }) },
  { name: "run_command", method: "run_command", write: true, description: "Run one editor command by id with arguments that match its schema. The change waits for the user to approve it in the editor (unless they switched on approving automatically), and is one undo step.", inputSchema: obj({ id: { type: "string" }, args: {} }, ["id"]) },
  { name: "get_selection", method: "get_selection", description: "The ids of the selected layers.", inputSchema: obj({}) },
  { name: "get_layers", method: "get_layers", description: "Some layers with all their properties (pass `ids`), or a list of every layer's id, name, kind and place in the tree.", inputSchema: obj({ ids: { type: "array", items: { type: "string" } } }) },
  { name: "get_document", method: "get_document", description: "A summary of the document, or all of it with `full: true`.", inputSchema: obj({ full: { type: "boolean" } }) },
  { name: "export_site", method: "export_site", description: "Export the pages as files in memory: plain HTML, Vite + React or Next.js.", inputSchema: obj({ target: { type: "string", enum: ["html", "vite", "next"] }, styling: { type: "string", enum: ["css", "modules", "tailwind"] } }, ["target"]) },
];

const RESOURCES = [
  { uri: "lazylayout://schema", name: "Motion Document JSON Schema", mimeType: "application/json" },
  { uri: "lazylayout://properties", name: "Property paths", mimeType: "application/json" },
];

const text = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const errorText = (message: string) => ({ ...text(message), isError: true });

export class McpServer {
  constructor(private bridge: Bridge) {}

  /** Answers one JSON-RPC message; null for a notification (which gets no answer). */
  async handle(msg: RpcRequest): Promise<RpcResponse | null> {
    const id = msg.id ?? null;
    const reply = (result: unknown): RpcResponse | null => (msg.id === undefined ? null : { jsonrpc: "2.0", id, result });
    const refuse = (code: number, message: string): RpcResponse | null => (msg.id === undefined ? null : { jsonrpc: "2.0", id, error: { code, message } });
    switch (msg.method) {
      case "initialize": {
        const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
        const protocolVersion = (SUPPORTED_PROTOCOLS as readonly string[]).includes(asked) ? asked : SUPPORTED_PROTOCOLS[0];
        return reply({ protocolVersion, capabilities: { tools: {}, resources: {} }, serverInfo: SERVER_INFO, instructions: "Start with `pair`: ask the user for the code shown in the editor. Then `list_commands` and `run_command`; changes wait for the user's approval." });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case "tools/call":
        return reply(await this.callTool(String(msg.params?.name ?? ""), (msg.params?.arguments as Record<string, unknown> | undefined) ?? {}));
      case "resources/list":
        return reply({ resources: RESOURCES });
      case "resources/read": {
        const uri = String(msg.params?.uri ?? "");
        const out = await this.ask("get_resource", { uri });
        if ("error" in out) return refuse(-32602, out.error);
        return reply({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(out.result, null, 2) }] });
      }
      default:
        if (msg.method.startsWith("notifications/")) return null;
        return refuse(-32601, `Method not found: ${msg.method}`);
    }
  }

  private async callTool(name: string, args: Record<string, unknown>) {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return errorText(`There is no tool \`${name}\`.`);
    const out = await this.ask(tool.method, args);
    return "error" in out ? errorText(out.error) : text(out.result);
  }

  private async ask(method: BridgeMethod, params: Record<string, unknown>): Promise<{ result: unknown } | { error: string }> {
    if (!this.bridge.isConnected()) return { error: "No editor is connected. Open the editor (http://localhost:3000/editor), choose File > Pair with Claude, and try again." };
    const r = await this.bridge.request(method, params);
    return r.error ? { error: `${r.error.code}: ${r.error.message}` } : { result: r.result ?? null };
  }
}

/** Reads newline-delimited JSON-RPC from `input` and writes the answers to `output`. Resolves when `input` ends. */
export function serveStdio(server: McpServer, input: NodeJS.ReadableStream, output: { write(s: string): unknown }): Promise<void> {
  return new Promise((resolve) => {
    let buffer = "";
    const work = new Set<Promise<void>>();
    const line = (raw: string) => {
      if (!raw.trim()) return;
      const job = (async () => {
        let msg: RpcRequest;
        try {
          msg = JSON.parse(raw) as RpcRequest;
        } catch {
          output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
          return;
        }
        const res = await server.handle(msg);
        if (res) output.write(JSON.stringify(res) + "\n");
      })().finally(() => work.delete(job));
      work.add(job);
    };
    input.setEncoding?.("utf8");
    input.on("data", (chunk: string | Buffer) => {
      buffer += chunk.toString();
      let i: number;
      while ((i = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
      }
    });
    input.on("end", () => {
      line(buffer);
      void Promise.all(work).then(() => resolve());
    });
  });
}

