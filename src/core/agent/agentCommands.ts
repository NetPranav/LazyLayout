/**
 * The agent bridge's own command (ROADMAP Phase 50). It only opens the panel where a person pairs with Claude and
 * approves changes. Commands whose id starts with `agent.` are never runnable through the bridge (`AgentHost`), so an
 * agent can't open, change or switch off its own approval gate.
 */

import { defineCommand } from "../commands";
import { useAgentUiStore } from "../store/useAgentUiStore";

export function registerAgentCommands(): () => void {
  return defineCommand({ id: "agent.pair", title: "Pair with Claude...", category: "File", run: () => useAgentUiStore.getState().open() });
}
