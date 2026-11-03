/**
 * ============================================================================
 * THE BRIDGE SERVER (ROADMAP Phase 50, decision record 0014)
 * ============================================================================
 * A WebSocket server on 127.0.0.1 that one editor tab connects to. It
 *
 * - listens on the loopback address only;
 * - refuses a connection whose `Origin` isn't on the allow-list (and one without an `Origin`, which a browser always sends);
 * - keeps one tab: a new one replaces the old;
 * - lets nothing but `pair` through until the tab has accepted a code, so an unpaired connection can't read or change anything.
 * ============================================================================
 */

import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_ALLOWED_ORIGINS, DEFAULT_BRIDGE_PORT, parseTabMessage, type BridgeMethod, type BridgeResponse } from "../../src/core/agent/protocol";
import type { Bridge } from "./mcpServer";

export interface BridgeOptions {
  port?: number;
  host?: string;
  allowedOrigins?: readonly string[];
  /** Longer than the editor's approval wait, so the user's "no answer" arrives as the editor's own error. */
  requestTimeoutMs?: number;
  log?: (line: string) => void;
}

export interface RunningBridge extends Bridge {
  port: number;
  close(): Promise<void>;
}

type Waiting = { resolve: (r: BridgeResponse) => void; timer: ReturnType<typeof setTimeout> };

const failure = (id: number, code: "not-paired" | "failed" | "timeout", message: string): BridgeResponse => ({ type: "response", id, error: { code, message } });

export function startBridge(options: BridgeOptions = {}): Promise<RunningBridge> {
  const host = options.host ?? "127.0.0.1";
  const allowed = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS);
  const timeoutMs = options.requestTimeoutMs ?? 130_000;
  const log = options.log ?? (() => {});
  const wss = new WebSocketServer({
    host,
    port: options.port ?? DEFAULT_BRIDGE_PORT,
    maxPayload: 32 * 1024 * 1024,
    verifyClient: (info, done) => {
      const origin = info.origin;
      if (!origin || !allowed.has(origin)) {
        log(`refused a connection from origin ${origin || "(none)"}`);
        done(false, 403, "Origin not allowed");
        return;
      }
      done(true);
    },
  });

  let tab: WebSocket | null = null;
  let paired = false;
  let nextId = 1;
  const waiting = new Map<number, Waiting>();
  const pendingPair = new Set<number>();

  const failAll = (message: string) => {
    for (const [id, w] of waiting) {
      clearTimeout(w.timer);
      w.resolve(failure(id, "failed", message));
    }
    waiting.clear();
  };

  wss.on("connection", (socket) => {
    if (tab && tab !== socket) {
      failAll("Another editor tab took over.");
      tab.close(4000, "replaced");
    }
    tab = socket;
    paired = false;
    log("an editor tab connected");
    socket.on("message", (data) => {
      const msg = parseTabMessage(data.toString());
      if (!msg || msg.type !== "response") return;
      const w = waiting.get(msg.id);
      if (!w) return;
      waiting.delete(msg.id);
      clearTimeout(w.timer);
      // the tab accepted a code: from now on the server passes the other requests through
      if (pendingPair.delete(msg.id) && !msg.error && (msg.result as { paired?: boolean } | undefined)?.paired === true) paired = true;
      w.resolve(msg);
    });
    socket.on("close", () => {
      if (tab === socket) {
        tab = null;
        paired = false;
        failAll("The editor tab closed.");
        log("the editor tab closed");
      }
    });
  });

  const bridge: RunningBridge = {
    port: 0,
    isConnected: () => tab !== null && tab.readyState === 1,
    request(method: BridgeMethod, params: Record<string, unknown>) {
      const id = nextId++;
      if (!tab || tab.readyState !== 1) return Promise.resolve(failure(id, "failed", "No editor tab is connected."));
      if (method !== "pair" && !paired) return Promise.resolve(failure(id, "not-paired", "This editor isn't paired. Ask the user for the code shown in the editor and call `pair`."));
      if (method === "pair") pendingPair.add(id);
      const socket = tab;
      return new Promise<BridgeResponse>((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          pendingPair.delete(id);
          resolve(failure(id, "timeout", "The editor didn't answer in time."));
        }, timeoutMs);
        waiting.set(id, { resolve, timer });
        socket.send(JSON.stringify({ type: "request", id, method, params }));
      });
    },
    close: () =>
      new Promise<void>((resolve) => {
        failAll("The bridge closed.");
        for (const c of wss.clients) c.terminate();
        wss.close(() => resolve());
      }),
  };

  return new Promise((resolve, reject) => {
    wss.once("error", reject);
    wss.once("listening", () => {
      const addr = wss.address();
      bridge.port = typeof addr === "object" && addr ? addr.port : (options.port ?? DEFAULT_BRIDGE_PORT);
      log(`bridge listening on ws://${host}:${bridge.port}`);
      resolve(bridge);
    });
  });
}
