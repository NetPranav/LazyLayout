"use client";

/**
 * "Pair with Claude" (ROADMAP Phase 50): the one-time code to tell Claude, whether an MCP server is connected, the
 * changes Claude is waiting to make (approve or reject each), the switch to approve automatically, and a log of what
 * it changed. A change that needs approval brings this panel back if it was closed.
 */

import React, { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { getAgentHost, startAgentLink, stopAgentLink, useAgentLinkStore } from "@/legacy-editor/agent/agentConnection";
import { useAgentUiStore } from "@/core/store/useAgentUiStore";

const card: React.CSSProperties = { position: "fixed", right: 16, bottom: 16, zIndex: 1000, width: 360, maxHeight: "70vh", overflow: "auto", background: "var(--panel-bg, #1f1f23)", color: "var(--text, #f2f2f2)", border: "1px solid var(--border, #3a3a40)", borderRadius: 8, padding: 12, fontSize: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" };
const row: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center" };
const btn: React.CSSProperties = { padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border, #3a3a40)", background: "transparent", color: "inherit", cursor: "pointer" };

export const AgentDialog: React.FC = () => {
  const isOpen = useAgentUiStore((s) => s.isOpen);
  const link = useAgentLinkStore((s) => s.status);
  const host = getAgentHost();
  const state = useSyncExternalStore(host.subscribe, host.getState, host.getState);

  useEffect(() => {
    if (!isOpen) return undefined;
    startAgentLink();
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;
  const close = () => useAgentUiStore.getState().close();
  const status = state.paired ? "Paired with Claude" : link === "connected" ? "Connected. Tell Claude the code below." : link === "connecting" ? "Waiting for the Claude server (run `npm run mcp` or add it to your MCP client)…" : "Not connected";
  return (
    <div role="dialog" aria-label="Pair with Claude" style={card}>
      <div style={{ ...row, justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Pair with Claude</strong>
        <button type="button" aria-label="Close" style={{ ...btn, border: "none" }} onClick={close}>
          <X size={14} />
        </button>
      </div>
      <p style={{ margin: "0 0 8px" }} aria-live="polite">{status}</p>
      {!state.paired && (
        <div style={{ marginBottom: 8 }}>
          <div aria-label="Pairing code" style={{ fontFamily: "monospace", fontSize: 24, letterSpacing: 4, textAlign: "center", padding: 8, border: "1px dashed var(--border, #3a3a40)", borderRadius: 6 }}>{state.locked ? "locked" : state.code}</div>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>{state.locked ? "Too many wrong codes. Make a new one." : "Claude asks for this code. It works once and expires in 5 minutes."}</p>
        </div>
      )}
      <div style={{ ...row, marginBottom: 8 }}>
        <button type="button" style={btn} onClick={() => host.newCode()}>New code</button>
        <button type="button" style={btn} onClick={() => { stopAgentLink(); close(); }}>Disconnect</button>
      </div>
      <label style={{ ...row, marginBottom: 8 }}>
        <input type="checkbox" checked={state.autoApprove} onChange={(e) => host.setAutoApprove(e.target.checked)} />
        Approve changes automatically this session
      </label>
      {state.pending.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <strong>Waiting for you</strong>
          {state.pending.map((p) => (
            <div key={p.id} style={{ border: "1px solid var(--border, #3a3a40)", borderRadius: 6, padding: 6, margin: "6px 0" }}>
              <div>{p.title} <code style={{ opacity: 0.6 }}>{p.commandId}</code></div>
              <pre style={{ margin: "4px 0", whiteSpace: "pre-wrap", maxHeight: 90, overflow: "auto", opacity: 0.8 }}>{JSON.stringify(p.args, null, 1)}</pre>
              <div style={row}>
                <button type="button" style={btn} onClick={() => void host.approve(p.id)}>Approve</button>
                <button type="button" style={btn} onClick={() => host.reject(p.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {state.log.length > 0 && (
        <div>
          <strong>What Claude changed</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
            {state.log.slice(-15).reverse().map((e, i) => (
              <li key={`${e.at}-${i}`}>{e.title} <span style={{ opacity: 0.6 }}>({e.how}{e.message ? `: ${e.message}` : ""})</span></li>
            ))}
          </ul>
          <p style={{ margin: "4px 0 0", opacity: 0.7 }}>Each is one undo step (Ctrl+Z).</p>
        </div>
      )}
    </div>
  );
};
