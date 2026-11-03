#!/usr/bin/env -S npx tsx
/**
 * lazylayout-mcp: the stdio MCP server an AI client (Claude Desktop, Claude Code, any MCP client) starts to operate
 * a LazyLayout editor tab. ROADMAP Phase 50, decision record 0014.
 *
 *   npm run mcp
 *
 * Environment:
 *   LAZYLAYOUT_BRIDGE_PORT      the WebSocket port on 127.0.0.1 (default 7117)
 *   LAZYLAYOUT_ALLOWED_ORIGINS  comma-separated pages allowed to connect (default http://localhost:3000,http://127.0.0.1:3000)
 *
 * stdout carries the protocol and nothing else; messages for people go to stderr.
 */

import { DEFAULT_ALLOWED_ORIGINS, DEFAULT_BRIDGE_PORT } from "../src/core/agent/protocol";
import { startBridge } from "./lazylayout-mcp/bridgeServer";
import { McpServer, serveStdio } from "./lazylayout-mcp/mcpServer";

async function main(): Promise<void> {
  const port = Number(process.env.LAZYLAYOUT_BRIDGE_PORT) || DEFAULT_BRIDGE_PORT;
  const origins = process.env.LAZYLAYOUT_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [...DEFAULT_ALLOWED_ORIGINS];
  const bridge = await startBridge({ port, allowedOrigins: origins, log: (line) => process.stderr.write(`[lazylayout-mcp] ${line}\n`) });
  await serveStdio(new McpServer(bridge), process.stdin, process.stdout);
  await bridge.close();
}

main().catch((error: unknown) => {
  process.stderr.write(`[lazylayout-mcp] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
