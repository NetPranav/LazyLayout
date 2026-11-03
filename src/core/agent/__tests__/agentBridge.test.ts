/**
 * ROADMAP Phase 50: the agent bridge, end to end. A real WebSocket server on 127.0.0.1, an editor tab played by a
 * WebSocket client that answers with the real `AgentHost` on the real command registry, and an MCP client talking
 * JSON-RPC over in-memory streams. Checks the gate: unpaired and wrong-origin connections get nothing; changes wait
 * for approval; a change is one undo step; 20 commands run end to end; and no command in the registry is missing from MCP.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { WebSocket } from "ws";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getAllCommands, setFocusScope } from "../../commands";
import { registerEditingCommands } from "../../editing/editCommands";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { AgentHost, MAX_WRONG_CODES, CODE_LIFETIME_MS } from "../agentHost";
import { editorHostDeps } from "../editorDeps";
import { parseBridgeRequest } from "../protocol";
import { startBridge, type RunningBridge } from "../../../../bin/lazylayout-mcp/bridgeServer";
import { McpServer, serveStdio, TOOLS } from "../../../../bin/lazylayout-mcp/mcpServer";

(globalThis as unknown as { window: unknown }).window = { addEventListener() {}, removeEventListener() {}, document: { addEventListener() {}, removeEventListener() {} } };

const ORIGIN = "http://localhost:3000";
const CODE = "12345678";

const rect = (id: string, y: number): Layer =>
  createLayer({ id, archetype: "rectangle", parentId: "pg", name: id, properties: { positioning: "absolute", "frame.x": 10, "frame.y": y, "frame.width": 100, "frame.height": 40, "svg.fill": "#ff0000", "svg.stroke": "#0000ff", "svg.strokeWidth": 4 } }) as Layer;

const freshDocument = () =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["r1", "r2", "r3", "r4"], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 800, "frame.height": 600 } }) as Layer,
      rect("r1", 0),
      rect("r2", 60),
      rect("r3", 120),
      rect("r4", 180),
    ]),
  );

const L = () => getDocument().layers;

/** An MCP client over in-memory streams. */
function mcpClient(server: McpServer) {
  const input = new PassThrough();
  const output = new PassThrough();
  const waiting = new Map<number, (m: Record<string, unknown>) => void>();
  let buffer = "";
  output.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let i: number;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buffer.slice(0, i)) as Record<string, unknown>;
      buffer = buffer.slice(i + 1);
      waiting.get(msg.id as number)?.(msg);
    }
  });
  void serveStdio(server, input, { write: (s) => output.write(s) });
  let id = 0;
  const call = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const n = ++id;
      waiting.set(n, resolve);
      input.write(JSON.stringify({ jsonrpc: "2.0", id: n, method, params }) + "\n");
    });
  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await call("tools/call", { name, arguments: args })).result as { isError?: boolean; content: { text: string }[] };
    const text = res.content[0].text;
    let json: unknown = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* plain text */
    }
    return { isError: res.isError === true, text, json };
  };
  return { call, tool, close: () => input.end() };
}

describe("Phase 50: the agent bridge", () => {
  let bridge: RunningBridge;
  let host: AgentHost;
  let tab: WebSocket;
  let client: ReturnType<typeof mcpClient>;
  let userApproves = true;
  let off: () => void;
  let offCommands: () => void;
  let now = 1_000_000;

  const makeHost = () => new AgentHost({ ...editorHostDeps(), now: () => now, makeCode: () => CODE });

  /** The person at the editor: approves what is waiting (or rejects it) the moment it appears. */
  const watchPending = () =>
    host.subscribe(() => {
      for (const p of host.getState().pending) queueMicrotask(() => (userApproves ? void host.approve(p.id) : host.reject(p.id)));
    });

  before(async () => {
    offCommands = registerEditingCommands();
    bridge = await startBridge({ port: 0, allowedOrigins: [ORIGIN], requestTimeoutMs: 5000 });
    client = mcpClient(new McpServer(bridge));
    host = makeHost();
    tab = new WebSocket(`ws://127.0.0.1:${bridge.port}`, { origin: ORIGIN });
    tab.on("message", async (data) => {
      const req = parseBridgeRequest(data.toString());
      if (req) tab.send(JSON.stringify(await host.handle(req)));
    });
    await new Promise<void>((resolve, reject) => {
      tab.once("open", () => resolve());
      tab.once("error", reject);
    });
    off = watchPending();
  });

  after(async () => {
    off();
    host.newCode();
    client.close();
    tab.close();
    await bridge.close();
    offCommands();
  });

  beforeEach(() => {
    freshDocument();
    useSelectionStore.getState().clearSelection();
    userApproves = true;
    host.setAutoApprove(false);
  });

  it("refuses everything before a code has been accepted, and changes nothing", async () => {
    const before = JSON.stringify(getDocument());
    for (const [name, args] of [["get_document", {}], ["get_layers", {}], ["list_commands", {}], ["run_command", { id: "layer.setLocked", args: { ids: ["r1"], locked: true } }], ["export_site", { target: "html" }]] as const) {
      const r = await client.tool(name, args as Record<string, unknown>);
      assert.equal(r.isError, true, name);
      assert.match(r.text, /not-paired/, name);
    }
    assert.equal(JSON.stringify(getDocument()), before);
    assert.equal(host.getState().log.length, 0);
  });

  it("a wrong code is refused; five wrong codes lock pairing, even for the right code, until a new code is made", async () => {
    const wrong = await client.tool("pair", { code: "00000000" });
    assert.equal(wrong.isError, true);
    assert.match(wrong.text, /bad-code/);
    for (let i = 0; i < MAX_WRONG_CODES; i++) await client.tool("pair", { code: "00000000" });
    const locked = await client.tool("pair", { code: CODE });
    assert.match(locked.text, /locked/);
    host.newCode();
    const again = await client.tool("pair", { code: CODE });
    assert.equal(again.isError, false);
    assert.equal(host.getState().paired, true);
  });

  it("a code expires after five minutes", async () => {
    host.newCode();
    now += CODE_LIFETIME_MS + 1;
    const late = await client.tool("pair", { code: CODE });
    assert.match(late.text, /expired/);
    host.newCode();
    assert.equal((await client.tool("pair", { code: CODE })).isError, false);
  });

  it("refuses a page that isn't on the allow-list, and a connection with no origin", async () => {
    for (const origin of ["http://evil.example", undefined]) {
      const refused = await new Promise<string>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}`, origin ? { origin } : {});
        ws.once("open", () => {
          ws.close();
          resolve("opened");
        });
        ws.once("error", (e) => resolve(String(e.message)));
      });
      assert.match(refused, /403/, String(origin));
    }
    assert.equal(bridge.isConnected(), true, "the paired tab is still the one connected");
  });

  it("lists every command in the registry with its argument schema, and none is missing (coverage)", async () => {
    const r = await client.tool("list_commands");
    const listed = r.json as { id: string; args: unknown }[];
    const registry = getAllCommands();
    assert.ok(registry.length > 150, `${registry.length} commands`);
    assert.deepEqual(new Set(listed.map((c) => c.id)), new Set(registry.map((c) => c.id)), "every command is listed, and only those");
    for (const c of registry) {
      const item = listed.find((l) => l.id === c.id)!;
      if (c.args) assert.ok(item.args && typeof item.args === "object", `${c.id} has a JSON Schema`);
      else assert.equal(item.args, null, c.id);
    }
    assert.ok(listed.every((c) => typeof (c as { available?: unknown }).available === "boolean"), "each says whether it applies right now");
    assert.ok(TOOLS.every((t) => /^[a-z_]+$/.test(t.name)));
  });

  it("serves the MDM JSON Schema and the property paths as resources", async () => {
    const list = (await client.call("resources/list")).result as { resources: { uri: string }[] };
    assert.deepEqual(list.resources.map((x) => x.uri).sort(), ["lazylayout://properties", "lazylayout://schema"]);
    const schema = (await client.call("resources/read", { uri: "lazylayout://schema" })).result as { contents: { text: string }[] };
    assert.ok(JSON.parse(schema.contents[0].text), "valid JSON");
    const props = (await client.call("resources/read", { uri: "lazylayout://properties" })).result as { contents: { text: string }[] };
    assert.ok((JSON.parse(props.contents[0].text) as string[]).includes("frame.width"));
  });

  it("reads the document, the layers and the selection", async () => {
    useSelectionStore.getState().selectMultiple(["r2"], "element");
    assert.deepEqual((await client.tool("get_selection")).json, { ids: ["r2"] });
    const some = (await client.tool("get_layers", { ids: ["r1"] })).json as { layers: Layer[] };
    assert.equal(some.layers[0].properties["frame.y"], 0);
    const all = (await client.tool("get_layers")).json as { total: number; layers: { id: string }[] };
    assert.equal(all.total, 5);
    assert.equal(((await client.tool("get_document")).json as { layerCount: number }).layerCount, 5);
  });

  it("a change waits for approval, and rejecting it changes nothing", async () => {
    userApproves = false;
    const r = await client.tool("run_command", { id: "layer.setLocked", args: { ids: ["r1"], locked: true } });
    assert.equal(r.isError, true);
    assert.match(r.text, /rejected/);
    assert.notEqual(L().r1.locked, true);
    assert.equal(host.getState().log.at(-1)?.how, "rejected");
    assert.equal(host.getState().pending.length, 0);
  });

  it("a change that is not approved yet does not run", async () => {
    const quiet = new AgentHost({ ...editorHostDeps(), makeCode: () => CODE });
    quiet.handle({ type: "request", id: 1, method: "pair", params: { code: CODE } });
    await new Promise((r) => setTimeout(r, 0));
    const waiting = quiet.handle({ type: "request", id: 2, method: "run_command", params: { id: "layer.setLocked", args: { ids: ["r1"], locked: true } } });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(quiet.getState().pending.length, 1);
    assert.notEqual(L().r1.locked, true, "nothing ran while it waited");
    quiet.reject(quiet.getState().pending[0].id);
    assert.equal((await waiting).error?.code, "rejected");
  });

  it("an approved change is one undo step named after the command", async () => {
    const r = await client.tool("run_command", { id: "layer.setLocked", args: { ids: ["r1", "r2"], locked: true } });
    assert.equal(r.isError, false, r.text);
    assert.equal(L().r1.locked, true);
    assert.equal(L().r2.locked, true);
    assert.equal(host.getState().log.at(-1)?.how, "approved");
    historyCommands.undo();
    assert.notEqual(L().r1.locked, true, "one undo takes back both layers");
    assert.notEqual(L().r2.locked, true);
  });

  it("approving automatically still logs every change and keeps each as its own undo step", async () => {
    host.setAutoApprove(true);
    const logged = host.getState().log.length;
    await client.tool("run_command", { id: "layer.setOpacity", args: { ids: ["r1"], opacity: 0.5 } });
    await client.tool("run_command", { id: "layer.setLocked", args: { ids: ["r3"], locked: true } });
    assert.equal(host.getState().log.length, logged + 2);
    assert.ok(host.getState().log.slice(-2).every((e) => e.how === "automatic"));
    historyCommands.undo();
    assert.notEqual(L().r3.locked, true, "the last change is undone alone");
    assert.equal(L().r1.properties["appearance.opacity"], 0.5, "the one before stays");
  });

  it("refuses arguments that don't match the command's schema, and an unknown command", async () => {
    const bad = await client.tool("run_command", { id: "layer.setOpacity", args: { ids: "r1", opacity: "much" } });
    assert.equal(bad.isError, true);
    assert.match(bad.text, /invalid-params/);
    const unknown = await client.tool("run_command", { id: "no.such.command" });
    assert.match(unknown.text, /invalid-params/);
    assert.equal(L().r1.properties["appearance.opacity"], undefined);
  });

  it("can't be used to open, change or switch off its own approval gate", async () => {
    const r = await client.tool("run_command", { id: "agent.pair" });
    assert.equal(r.isError, true);
    assert.match(r.text, /control the agent bridge/);
    assert.ok(getAllCommands().some((c) => c.id === "agent.pair"), "the command exists for people");
  });

  it("says why a command that doesn't apply right now didn't run", async () => {
    setFocusScope(null as never);
    const r = await client.tool("run_command", { id: "layer.toggleLock" });
    assert.equal(r.isError, true);
    assert.match(r.text, /unavailable.*canvas focused/);
  });

  it("exports the pages as files", async () => {
    const r = await client.tool("export_site", { target: "html" });
    assert.equal(r.isError, false, r.text);
    const out = r.json as { files: { path: string; text: string }[] };
    assert.ok(out.files.some((f) => f.path.endsWith("index.html")));
    assert.equal((await client.tool("export_site", { target: "ftp" })).isError, true);
  });

  it("drives 20 commands end to end through MCP, each one approved and each one an undo step", async () => {
    const run = async (id: string, args?: Record<string, unknown>) => {
      const r = await client.tool("run_command", { id, ...(args ? { args } : {}) });
      assert.equal(r.isError, false, `${id}: ${r.text}`);
    };
    const before = host.getState().log.length;
    setFocusScope("canvas"); // the user is working on the canvas; some commands only apply there
    useSelectionStore.getState().selectMultiple(["r1", "r2", "r3"], "element");
    await run("layer.setName", { id: "r1", name: "Hero" });
    await run("layer.setOpacity", { ids: ["r1"], opacity: 0.8 });
    await run("layer.setFill", { ids: ["r1"], color: "#00ff00" });
    await run("layer.setStroke", { ids: ["r2"], color: "#111111", width: 6 });
    await run("layer.setRadius", { ids: ["r2"], radius: 12 });
    await run("layer.setFrame", { ids: ["r3"], x: 40, y: 300, width: 160, height: 60 });
    await run("layer.setProps", { ids: ["r4"], props: { "frame.width": 222 } });
    await run("layer.setLocked", { ids: ["r4"], locked: true });
    await run("layer.setVisible", { ids: ["r4"], visible: false });
    await run("layer.toggleLock");
    await run("layer.unlockAll");
    await run("layer.showAll");
    await run("layer.bringForward");
    await run("layer.sendBackward");
    await run("layer.bringToFront");
    await run("layer.sendToBack");
    await run("align.left");
    await run("distribute.vertical");
    await run("layer.tidy");
    await run("vector.outlineStroke", { ids: ["r2"] });
    assert.equal(host.getState().log.length - before, 20);
    assert.equal(L().r1.name, "Hero");
    assert.equal(L().r4.properties["frame.width"], 222);
    assert.ok(Object.values(L()).some((l) => l.name === "r2 outline"), "Outline Stroke made its layer");
    historyCommands.undo();
    assert.ok(!Object.values(L()).some((l) => l.name === "r2 outline"), "the last command is one undo step");
  });
});
