### Phase 50 (Agent bridge: local MCP server v0): Claude can operate the editor, with the user approving each change

A stdio MCP server (`npm run mcp`) pairs with an open editor tab over a WebSocket on 127.0.0.1 and runs the editor's own commands. Decision record 0014.

#### Added
- `bin/lazylayout-mcp`: the MCP server (tools `pair`, `list_commands`, `run_command`, `get_selection`, `get_layers`, `get_document`, `export_site`; resources for the MDM JSON Schema and property paths) and the loopback WebSocket bridge with an `Origin` allow-list.
- `src/core/agent/`: the bridge protocol, the `AgentHost` (one-time pairing code, five-attempt lock, approval queue, "approve automatically" switch, change log) and its wiring to the command registry, document and export.
- "Pair with Claude…" (File menu, command `agent.pair`): the code, connection state, pending changes with Approve and Reject, and the log.
- Every command in the registry is listed with its JSON Schema and whether it applies now, and can be run with its arguments checked. Each change is one undo step named "Claude: <command>".
- `ws` and `@types/ws` (MIT) in `package.json`.

#### Not done
- A ghost-diff preview of a change (the user approves the command and its arguments), `render_frame` to PNG, an MDM patch tool, and publishing `lazylayout-mcp` to npm. See decision 0014 §2.
