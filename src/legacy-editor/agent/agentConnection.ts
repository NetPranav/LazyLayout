"use client";

/**
 * The editor tab's side of the agent bridge (ROADMAP Phase 50): one WebSocket to the local MCP server on 127.0.0.1,
 * kept up while someone has "Pair with Claude" open, and one `AgentHost` that answers everything it asks.
 */

import { create } from "zustand";
import { AgentHost } from "@/core/agent/agentHost";
import { editorHostDeps } from "@/core/agent/editorDeps";
import { BRIDGE_VERSION, DEFAULT_BRIDGE_PORT, parseBridgeRequest } from "@/core/agent/protocol";
import { useAgentUiStore } from "@/core/store/useAgentUiStore";

export type LinkStatus = "off" | "connecting" | "connected";

export const useAgentLinkStore = create<{ status: LinkStatus }>(() => ({ status: "off" }));

let host: AgentHost | null = null;
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let wanted = false;
let port = DEFAULT_BRIDGE_PORT;

/** The one host for this tab. Created on first use, with a fresh pairing code. */
export function getAgentHost(): AgentHost {
  if (!host) {
    host = new AgentHost(editorHostDeps());
    // a change that needs approval brings the panel back, so it can't wait unseen
    host.subscribe(() => {
      if (host!.getState().pending.length > 0) useAgentUiStore.getState().open();
    });
  }
  return host;
}

function connect() {
  if (!wanted || socket) return;
  useAgentLinkStore.setState({ status: "connecting" });
  let ws: WebSocket;
  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
  } catch {
    retry = setTimeout(connect, 2000);
    return;
  }
  socket = ws;
  ws.onopen = () => {
    useAgentLinkStore.setState({ status: "connected" });
    ws.send(JSON.stringify({ type: "hello", version: BRIDGE_VERSION }));
  };
  ws.onmessage = async (event) => {
    const req = parseBridgeRequest(String(event.data));
    if (!req) return;
    const res = await getAgentHost().handle(req);
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(res));
  };
  ws.onclose = () => {
    socket = null;
    getAgentHost().disconnected();
    useAgentLinkStore.setState({ status: wanted ? "connecting" : "off" });
    if (wanted) retry = setTimeout(connect, 2000);
  };
  ws.onerror = () => ws.close();
}

/** Starts looking for the MCP server and keeps looking until `stopAgentLink`. */
export function startAgentLink(onPort?: number): void {
  // a test can name another port (`window.__LL_AGENT_PORT__`), so browsers that run side by side don't share one
  const forced = (window as unknown as { __LL_AGENT_PORT__?: number }).__LL_AGENT_PORT__;
  port = onPort ?? forced ?? DEFAULT_BRIDGE_PORT;
  wanted = true;
  getAgentHost();
  connect();
}

export function stopAgentLink(): void {
  wanted = false;
  if (retry) clearTimeout(retry);
  retry = null;
  socket?.close();
  getAgentHost().disconnected();
  useAgentLinkStore.setState({ status: "off" });
}
