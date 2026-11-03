/**
 * ============================================================================
 * THE AGENT HOST (ROADMAP Phase 50, decision record 0014, Law 4 and Law 20)
 * ============================================================================
 * What the editor does when the paired MCP server asks for something:
 *
 * - Pairing. The tab shows a one-time code; the server may ask for anything only after a request carried that code.
 *   Five wrong codes lock pairing until the tab makes a new code. A code lasts five minutes.
 * - Reads (`get_*`, `list_commands`, `export_site`) answer at once.
 * - Writes (`run_command`) wait for the user to approve them, or run straight away while "approve automatically" is on.
 *   Either way a change is one undo step named after the command, and it goes into the log.
 * - Every command in the registry can be listed and run, with its arguments checked against its own schema.
 *
 * The editor's functions are passed in, so this file has no React and no stores and a test can run it.
 * ============================================================================
 */

import type { Command, CommandOutcome } from "../commands/types";
import type { MotionDocument } from "../document/schema";
import { BRIDGE_METHODS, type BridgeErrorCode, type BridgeRequest, type BridgeResponse } from "./protocol";

export interface HostDeps {
  commands(): Command[];
  runCommand(id: string, args: unknown): CommandOutcome;
  /** Whether the command applies right now (its `when` clause: the canvas focused, something selected). */
  isAvailable(command: Command): boolean;
  getDocument(): MotionDocument;
  getSelection(): string[];
  /** Runs `fn` as one undo step with this label. */
  undoStep<T>(label: string, fn: () => T): T;
  exportSite(options: { target: "html" | "vite" | "next"; styling: "css" | "modules" | "tailwind" }): Promise<{ files: { path: string; text: string }[]; warnings: string[] }>;
  /** A JSON Schema for a zod schema; null when it can't be written as one. */
  toJsonSchema(schema: unknown): unknown | null;
  /** The MDM JSON Schema and the property paths, for the `get_resource` tool. */
  resources(): Record<string, unknown>;
  now(): number;
  /** Eight random digits; a test passes a fixed one. */
  makeCode(): string;
}

export interface PendingChange {
  id: number;
  commandId: string;
  title: string;
  args: unknown;
  askedAt: number;
}

export interface LoggedChange {
  at: number;
  commandId: string;
  title: string;
  args: unknown;
  how: "approved" | "automatic" | "rejected" | "failed";
  message?: string;
}

export interface HostState {
  code: string;
  codeExpiresAt: number;
  paired: boolean;
  locked: boolean;
  autoApprove: boolean;
  pending: PendingChange[];
  log: LoggedChange[];
}

export const CODE_LIFETIME_MS = 5 * 60_000;
export const MAX_WRONG_CODES = 5;
export const APPROVAL_TIMEOUT_MS = 2 * 60_000;
const MAX_LOG = 200;
const MAX_LAYERS_LISTED = 500;

type Waiter = { resolve: (r: BridgeResponse) => void; timer: ReturnType<typeof setTimeout> | null; change: PendingChange };

const ok = (id: number, result: unknown): BridgeResponse => ({ type: "response", id, result });
const fail = (id: number, code: BridgeErrorCode, message: string): BridgeResponse => ({ type: "response", id, error: { code, message } });

/** Compares two strings in time that doesn't depend on where they differ. */
function sameCode(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export class AgentHost {
  private state: HostState;
  private wrong = 0;
  private waiters = new Map<number, Waiter>();
  private nextPending = 1;
  private listeners = new Set<() => void>();

  constructor(private deps: HostDeps) {
    this.state = { code: deps.makeCode(), codeExpiresAt: deps.now() + CODE_LIFETIME_MS, paired: false, locked: false, autoApprove: false, pending: [], log: [] };
  }

  // ---- state for the panel ------------------------------------------------

  getState = (): HostState => this.state;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<HostState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** A new code; ends any pairing and refuses what is waiting. */
  newCode(): void {
    this.wrong = 0;
    this.rejectAll("The pairing was reset.");
    this.set({ code: this.deps.makeCode(), codeExpiresAt: this.deps.now() + CODE_LIFETIME_MS, paired: false, locked: false });
  }

  /** The socket closed: nobody is paired any more. */
  disconnected(): void {
    this.rejectAll("The connection closed.");
    this.set({ paired: false });
  }

  setAutoApprove(on: boolean): void {
    this.set({ autoApprove: on });
    if (on) for (const c of [...this.state.pending]) void this.approve(c.id);
  }

  // ---- the user's side of a pending change --------------------------------

  async approve(pendingId: number): Promise<void> {
    const w = this.waiters.get(pendingId);
    if (!w) return;
    this.settle(pendingId);
    w.resolve(this.execute(w.change.id, w.change, this.state.autoApprove ? "automatic" : "approved"));
  }

  reject(pendingId: number, message = "The user rejected this change."): void {
    const w = this.waiters.get(pendingId);
    if (!w) return;
    this.settle(pendingId);
    this.record({ at: this.deps.now(), commandId: w.change.commandId, title: w.change.title, args: w.change.args, how: "rejected", message });
    w.resolve(fail(w.change.id, "rejected", message));
  }

  private rejectAll(message: string) {
    for (const id of [...this.waiters.keys()]) this.reject(id, message);
  }

  private settle(pendingId: number) {
    const w = this.waiters.get(pendingId);
    if (w?.timer) clearTimeout(w.timer);
    this.waiters.delete(pendingId);
    this.set({ pending: this.state.pending.filter((p) => p.id !== pendingId) });
  }

  private record(entry: LoggedChange) {
    this.set({ log: [...this.state.log, entry].slice(-MAX_LOG) });
  }

  // ---- the server's requests ----------------------------------------------

  async handle(req: BridgeRequest): Promise<BridgeResponse> {
    if (!(BRIDGE_METHODS as readonly string[]).includes(req.method)) return fail(req.id, "unknown-method", `There is no method \`${String(req.method)}\`.`);
    if (req.method === "pair") return this.pair(req);
    if (!this.state.paired) return fail(req.id, "not-paired", "This editor isn't paired. Ask the user for the pairing code shown in the editor and call `pair`.");
    try {
      switch (req.method) {
        case "list_commands":
          return ok(req.id, this.listCommands(req.params));
        case "run_command":
          return this.runCommand(req);
        case "get_selection":
          return ok(req.id, { ids: this.deps.getSelection() });
        case "get_layers":
          return ok(req.id, this.getLayers(req.params));
        case "get_document":
          return ok(req.id, this.getDocument(req.params));
        case "get_resource":
          return this.getResource(req);
        case "export_site":
          return await this.exportSite(req);
      }
    } catch (error) {
      return fail(req.id, "failed", error instanceof Error ? error.message : String(error));
    }
    return fail(req.id, "unknown-method", "Unknown method.");
  }

  private pair(req: BridgeRequest): BridgeResponse {
    const code = typeof req.params.code === "string" ? req.params.code.trim() : "";
    if (this.state.locked) return fail(req.id, "locked", "Too many wrong codes. The user must make a new code in the editor.");
    if (this.deps.now() > this.state.codeExpiresAt) return fail(req.id, "bad-code", "The code has expired. The user must make a new one in the editor.");
    if (!sameCode(code, this.state.code)) {
      this.wrong += 1;
      if (this.wrong >= MAX_WRONG_CODES) {
        this.set({ locked: true });
        return fail(req.id, "locked", "Too many wrong codes. The user must make a new code in the editor.");
      }
      return fail(req.id, "bad-code", "That code is wrong.");
    }
    this.wrong = 0;
    this.set({ paired: true });
    return ok(req.id, { paired: true });
  }

  private listCommands(params: Record<string, unknown>) {
    const query = typeof params.query === "string" ? params.query.toLowerCase() : "";
    const category = typeof params.category === "string" ? params.category.toLowerCase() : "";
    return this.deps
      .commands()
      .filter((c) => (!category || (c.category ?? "").toLowerCase() === category) && (!query || `${c.id} ${c.title} ${c.description ?? ""}`.toLowerCase().includes(query)))
      .map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category ?? null,
        description: c.description ?? null,
        args: c.args ? this.deps.toJsonSchema(c.args) : null,
        available: this.deps.isAvailable(c),
      }));
  }

  private runCommand(req: BridgeRequest): Promise<BridgeResponse> | BridgeResponse {
    const commandId = req.params.id;
    if (typeof commandId !== "string") return fail(req.id, "invalid-params", "`id` must be the id of a command.");
    if (commandId.startsWith("agent.")) return fail(req.id, "invalid-params", "Commands that control the agent bridge can't be run through it.");
    const command = this.deps.commands().find((c) => c.id === commandId);
    if (!command) return fail(req.id, "invalid-params", `There is no command \`${commandId}\`.`);
    const change: PendingChange = { id: req.id, commandId, title: command.title, args: req.params.args ?? null, askedAt: this.deps.now() };
    if (this.state.autoApprove) return this.execute(req.id, change, "automatic");
    return new Promise<BridgeResponse>((resolve) => {
      const pendingId = this.nextPending++;
      const queued = { ...change, id: pendingId };
      const timer = setTimeout(() => this.reject(pendingId, "Nobody approved this change in time."), APPROVAL_TIMEOUT_MS);
      this.waiters.set(pendingId, {
        resolve: (r) => resolve({ ...r, id: req.id }),
        timer,
        change: { ...queued, id: req.id },
      });
      this.set({ pending: [...this.state.pending, queued] });
    });
  }

  /** Runs a change as one undo step and logs it. */
  private execute(responseId: number, change: PendingChange, how: "approved" | "automatic"): BridgeResponse {
    let outcome: CommandOutcome;
    try {
      outcome = this.deps.undoStep(`Claude: ${change.title}`, () => this.deps.runCommand(change.commandId, change.args ?? undefined));
    } catch (error) {
      outcome = { ok: false, reason: "threw", message: error instanceof Error ? error.message : String(error) };
    }
    if (outcome.ok) {
      this.record({ at: this.deps.now(), commandId: change.commandId, title: change.title, args: change.args, how });
      return ok(responseId, { ok: true, result: outcome.result ?? null });
    }
    const hint = outcome.reason === "unavailable" ? " (it only applies in some places, such as with the canvas focused or something selected; `list_commands` shows `available`)" : "";
    const message = `${outcome.reason}${outcome.message ? `: ${outcome.message}` : ""}${hint}`;
    this.record({ at: this.deps.now(), commandId: change.commandId, title: change.title, args: change.args, how: "failed", message });
    return fail(responseId, outcome.reason === "invalid-args" ? "invalid-params" : "failed", message);
  }

  private getLayers(params: Record<string, unknown>) {
    const layers = this.deps.getDocument().layers;
    const ids = Array.isArray(params.ids) ? params.ids.filter((i): i is string => typeof i === "string") : null;
    if (ids) return { layers: ids.map((id) => layers[id]).filter(Boolean) };
    const all = Object.values(layers);
    return {
      total: all.length,
      truncated: all.length > MAX_LAYERS_LISTED,
      layers: all.slice(0, MAX_LAYERS_LISTED).map((l) => ({ id: l.id, name: l.name ?? null, archetype: l.archetype, parentId: l.parentId, children: l.children })),
    };
  }

  private getDocument(params: Record<string, unknown>) {
    const doc = this.deps.getDocument();
    if (params.full === true) return doc;
    return {
      schemaVersion: doc.schemaVersion,
      layerCount: Object.keys(doc.layers).length,
      compositions: Object.keys(doc.compositions),
      designComponents: Object.keys(doc.designComponents ?? {}),
      assets: Object.keys(doc.assets ?? {}).length,
      note: "Pass `full: true` for the whole document, or use get_layers for some layers.",
    };
  }

  private getResource(req: BridgeRequest): BridgeResponse {
    const uri = req.params.uri;
    const all = this.deps.resources();
    if (typeof uri !== "string") return ok(req.id, { uris: Object.keys(all) });
    if (!(uri in all)) return fail(req.id, "invalid-params", `There is no resource \`${uri}\`. Known: ${Object.keys(all).join(", ")}.`);
    return ok(req.id, all[uri]);
  }

  private async exportSite(req: BridgeRequest): Promise<BridgeResponse> {
    const target = req.params.target;
    const styling = req.params.styling ?? "css";
    if (target !== "html" && target !== "vite" && target !== "next") return fail(req.id, "invalid-params", "`target` must be html, vite or next.");
    if (styling !== "css" && styling !== "modules" && styling !== "tailwind") return fail(req.id, "invalid-params", "`styling` must be css, modules or tailwind.");
    const out = await this.deps.exportSite({ target, styling });
    return ok(req.id, out);
  }
}

