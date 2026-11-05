# Decision 0014: Phase 50 — The agent bridge: a local MCP server paired with an open editor tab

**Status: written 2026-11-03; reviewed in its pull request.** **Owner:** ROADMAP Phase 50. **Law:** 4 (no silent AI writes), 20 (the agent can do what the UI can).

An AI client (Claude Desktop, Claude Code, any MCP client) should be able to operate the editor the way a person does, through the commands on the command bus, without ever changing the document behind the user's back.

## 1. The decision

**A stdio MCP server (`npm run mcp`, `bin/lazylayout-mcp.ts`) asks one paired editor tab, over a WebSocket on `127.0.0.1`, to do everything. The tab decides.**

- **The server holds no document and runs no command.** It turns MCP requests into bridge messages (`src/core/agent/protocol.ts`) and the tab's answers back into MCP results. The tab's `AgentHost` (`src/core/agent/agentHost.ts`) does the work, so the agent has no power the UI doesn't have (Law 20).
- **Pairing.** The tab shows an 8-digit one-time code (File > Pair with Claude). Until the server has relayed a code the tab accepted, it passes nothing but `pair`, and the tab refuses everything else too. A code lasts 5 minutes; five wrong codes lock pairing until the user makes a new one. Codes are compared in constant time. The pairing ends when the socket closes.
- **Network.** The server listens on `127.0.0.1` only. It refuses a WebSocket whose `Origin` isn't on the allow-list (default `http://localhost:3000` and `http://127.0.0.1:3000`, `LAZYLAYOUT_ALLOWED_ORIGINS` to change), and refuses one with no `Origin`, which any browser sends. One tab at a time: a new connection replaces the old.
- **Tools.** `pair`, `list_commands`, `run_command`, `get_selection`, `get_layers`, `get_document`, `export_site`. Resources: the MDM JSON Schema and the property paths. All 188+ commands are reachable: `list_commands` lists each with its argument JSON Schema (generated from its zod schema, `z.toJSONSchema`) and whether it applies right now, and `run_command` runs one with the arguments checked against that schema. One tool per command was rejected: several hundred tools swamp a client's context and its tool picker.
- **Writes wait for a person (Law 4).** A `run_command` call becomes a pending change in the panel (title, command id, arguments); Approve runs it, Reject refuses it, and none waits longer than two minutes. "Approve changes automatically this session" runs them at once. Both ways each change is **one undo step named "Claude: <command title>"** and goes into a log.
- **The agent can't touch its own gate.** `run_command` refuses any command whose id starts with `agent.` (only `agent.pair`, which opens the panel, exists).
- **No SDK.** MCP is newline-delimited JSON-RPC 2.0; the server is a few hundred lines over `node:stream`. The only new runtime dependency is `ws` (MIT) for the server's WebSocket, because Node has no built-in WebSocket server. See `LICENSES.md`.

## 2. What it does not do yet

- **No ghost diff.** The user approves a description of the change (command and arguments), not a picture of its result on the canvas. A visual diff needs the ghost-layer renderer that arrives with the AI phases.
- **No `render_frame` to PNG.** There is no DOM-to-image renderer in the editor yet; `export_site` returns the site's files instead. Left to a later phase.
- **Commands with a `when` clause** (for instance "with the canvas focused") fail with `unavailable` and a hint when the user's focus is elsewhere. `list_commands` shows `available`. Most commands that take arguments have no such clause.
- **No MDM patch tool.** `layer.setProps` and the other typed commands cover writes; a patch tool belongs with the AI phases.
- **Not published to npm.** `npx lazylayout-mcp` needs a package; for now run `npm run mcp` in the repo, or point the MCP client at `npx tsx bin/lazylayout-mcp.ts`.

## 3. How it is checked

`src/core/agent/__tests__/agentBridge.test.ts` starts the real WebSocket server, plays the tab with the real `AgentHost` on the real command registry, and drives it as an MCP client: unpaired calls and wrong origins refused, wrong and expired codes, approval and rejection, one undo step per change, 20 commands run end to end, arguments checked, `agent.*` refused, and every command in the registry listed (the coverage check). It needs to bind a local port.
