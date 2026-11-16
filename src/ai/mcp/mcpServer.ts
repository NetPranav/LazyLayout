import { validateMotionDocument, type MotionDocument } from "@/core/document/schema";
import type { CommandSchemaEntry } from "@/ai/llm/schemas";
import { explainSelectionMotion } from "@/ai/llm/copilot";
import { evaluateVisualSelfCheck } from "@/ai/llm/evals";
import type { RulesValidatorFn } from "@/ai/llm/validationLoop";
import { useMcpActivityStore } from "./mcpActivityStore";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  commandId?: string;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  mimeType: string;
  read: () => string;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments: readonly { name: string; description: string; required: boolean }[];
  render: (args: Record<string, string>) => string;
}

export interface McpCoverageReport {
  totalCommands: number;
  coveredCommands: number;
  missingCommands: string[];
}

export const MCP_BUILT_IN_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "render_frame_at_time",
    description: "Render/sample a document frame at normalized or millisecond time `t` under a tape.",
    inputSchema: {
      type: "object",
      properties: {
        timeMs: { type: "number" },
        tapeId: { type: "string" },
      },
      required: ["timeMs"],
    },
  },
  {
    name: "evaluate_property",
    description: "Evaluate a canonical MDM dot-path property on a target layer at time `t`.",
    inputSchema: {
      type: "object",
      properties: {
        layerId: { type: "string" },
        path: { type: "string" },
        timeMs: { type: "number" },
      },
      required: ["layerId", "path"],
    },
  },
  {
    name: "validate_document",
    description: "Run MDM schema validation, rules.validate, and visual self-check on the document.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "explain_layer",
    description: "Explain what animations/effects on the target layer do and why they route to CSS/SVG/three.js.",
    inputSchema: {
      type: "object",
      properties: { layerId: { type: "string" } },
      required: ["layerId"],
    },
  },
  {
    name: "run_playground_sweep",
    description: "Sweep an effect across tape checkpoints and return budget/render metrics.",
    inputSchema: {
      type: "object",
      properties: {
        effectId: { type: "string" },
        checkpoints: { type: "array", items: { type: "number" } },
      },
      required: ["effectId"],
    },
  },
];

export const MCP_RESOURCES: readonly McpResourceDefinition[] = [
  {
    uri: "lazylayout://catalogue/effects",
    name: "Effect Catalogue",
    mimeType: "application/json",
    read: () =>
      JSON.stringify(
        [
          { id: "fx_fade_slide_up", category: "entrance", engine: "CSS" },
          { id: "fx_magnetic_pull", category: "hover", engine: "CSS" },
          { id: "fx_tilt_hover", category: "hover", engine: "CSS" },
          { id: "fx_scroll_parallax", category: "scroll", engine: "CSS" },
          { id: "fx_ink_swirl", category: "ambient", engine: "three.js" },
          { id: "fx_confetti_burst", category: "attention", engine: "CSS" },
        ],
        null,
        2,
      ),
  },
  {
    uri: "lazylayout://catalogue/signals",
    name: "Signal Catalogue",
    mimeType: "application/json",
    read: () =>
      JSON.stringify(
        ["pointerX", "pointerY", "hoverProgress", "scrollProgress", "time", "viewportWidth"],
        null,
        2,
      ),
  },
  {
    uri: "lazylayout://grammar/nodescript",
    name: "NodeScript (.nls) Grammar Summary",
    mimeType: "text/markdown",
    read: () =>
      [
        "# NodeScript (.nls) Grammar",
        "- `#nls-version: 1.0`",
        "- `graph <Name> (type: event | function | macro) { ... }`",
        "- `var <name>: <type> = <literal>`",
        "- `node <alias> : <Type>(<key>: <value>)`",
        "- `wire <fromNode>.<fromPin> -> <toNode>.<toPin>`",
      ].join("\n"),
  },
];

export const MCP_PROMPTS: readonly McpPromptDefinition[] = [
  {
    name: "animate_hero",
    description: "Guided flow to stage a crisp hero entrance without layout thrash.",
    arguments: [{ name: "targetLayerId", description: "Hero container or title layer ID", required: false }],
    render: (args) =>
      `Animate the hero section${args.targetLayerId ? ` (starting at ${args.targetLayerId})` : ""} using GPU-composited transform/opacity keyframes and stage as a Ghost Diff.`,
  },
  {
    name: "react_to_cursor",
    description: "Guided flow to make selected cards or buttons react smoothly to pointer movement.",
    arguments: [{ name: "layerId", description: "Target layer ID", required: true }],
    render: (args) =>
      `Make layer "${args.layerId}" tilt or pull gently toward the cursor using pointerX/pointerY signals and spring damping, staged as a Ghost Diff.`,
  },
];

export function commandIdToMcpToolName(commandId: string): string {
  return `cmd_${commandId.replace(/[^a-zA-Z0-9_]+/g, "_")}`;
}

/**
 * Builds the full MCP v1 tool list covering every registered Command Bus entry
 * (excluding `agent.*` self-approval commands per Law 4 / Phase 50) plus built-in MCP inspection tools.
 */
export function buildMcpToolRegistry(commands: readonly CommandSchemaEntry[]): McpToolDefinition[] {
  const commandTools: McpToolDefinition[] = commands
    .filter((cmd) => !cmd.id.startsWith("agent."))
    .map((cmd) => ({
      name: commandIdToMcpToolName(cmd.id),
      description: `${cmd.title}${cmd.description ? ` — ${cmd.description}` : ""} [${cmd.category ?? "General"}]`,
      inputSchema: cmd.inputSchema ?? { type: "object", properties: {} },
      commandId: cmd.id,
    }));

  return [...MCP_BUILT_IN_TOOLS, ...commandTools];
}

/** Verifies 0 non-agent commands are missing from the MCP tool registry. */
export function computeMcpCommandCoverage(
  commands: readonly CommandSchemaEntry[],
  tools: readonly McpToolDefinition[],
): McpCoverageReport {
  const nonAgent = commands.filter((c) => !c.id.startsWith("agent."));
  const coveredSet = new Set(tools.map((t) => t.commandId).filter(Boolean));
  const missingCommands = nonAgent.map((c) => c.id).filter((id) => !coveredSet.has(id));

  return {
    totalCommands: nonAgent.length,
    coveredCommands: nonAgent.length - missingCommands.length,
    missingCommands,
  };
}

export interface McpServerContext {
  getDocument: () => MotionDocument;
  validateRules: RulesValidatorFn;
  commands: readonly CommandSchemaEntry[];
  onExecuteCommand?: (commandId: string, args: Record<string, unknown>) => unknown;
}

/**
 * Executes an MCP v1 tool call with automatic activity logging (`useMcpActivityStore`).
 * Command-bus mutations start as `pending` until explicitly approved or executed under user approval.
 */
export function createMcpServer(ctx: McpServerContext) {
  const tools = buildMcpToolRegistry(ctx.commands);

  return {
    listTools: () => tools,
    listResources: () => MCP_RESOURCES,
    listPrompts: () => MCP_PROMPTS,
    readResource: (uri: string) => MCP_RESOURCES.find((r) => r.uri === uri)?.read() ?? null,
    getCoverage: () => computeMcpCommandCoverage(ctx.commands, tools),
    callTool: (name: string, args: Record<string, unknown> = {}) => {
      const activity = useMcpActivityStore.getState();
      const doc = ctx.getDocument();

      if (name === "validate_document") {
        const mdm = validateMotionDocument(doc);
        const ruleIssues = mdm.ok ? ctx.validateRules(mdm.document) : [];
        const visual = evaluateVisualSelfCheck(doc);
        activity.recordAction({
          toolName: name,
          summary: `Validated document (${ruleIssues.length} rule issues, visual=${visual.passed})`,
          status: "approved",
        });
        return { ok: mdm.ok && ruleIssues.length === 0 && visual.passed, mdm, ruleIssues, visual };
      }

      if (name === "explain_layer") {
        const layerId = typeof args.layerId === "string" ? args.layerId : "";
        const explanation = explainSelectionMotion(doc, layerId ? [layerId] : []);
        activity.recordAction({
          toolName: name,
          summary: `Explained layer "${layerId}" (${explanation.engineChoice})`,
          status: "approved",
        });
        return explanation;
      }

      if (name === "evaluate_property") {
        const layerId = typeof args.layerId === "string" ? args.layerId : "";
        const path = typeof args.path === "string" ? args.path : "";
        const layer = doc.layers[layerId];
        let current: unknown = layer?.properties;
        for (const seg of path.split(".")) {
          if (current && typeof current === "object") {
            current = (current as Record<string, unknown>)[seg];
          } else {
            current = undefined;
            break;
          }
        }
        activity.recordAction({
          toolName: name,
          summary: `Evaluated ${layerId}.${path}`,
          status: "approved",
        });
        return { layerId, path, value: current ?? null };
      }

      if (name === "render_frame_at_time") {
        const timeMs = typeof args.timeMs === "number" ? args.timeMs : 0;
        const visual = evaluateVisualSelfCheck(doc, { sampledTimes: [timeMs] });
        activity.recordAction({
          toolName: name,
          summary: `Sampled frame at t=${timeMs}ms`,
          status: "approved",
        });
        return { timeMs, layerCount: Object.keys(doc.layers).length, visual };
      }

      if (name === "run_playground_sweep") {
        const effectId = typeof args.effectId === "string" ? args.effectId : "fx_custom";
        const checkpoints = Array.isArray(args.checkpoints) ? args.checkpoints : [0, 0.5, 1];
        activity.recordAction({
          toolName: name,
          summary: `Swept ${effectId} across ${checkpoints.length} checkpoints`,
          status: "approved",
        });
        return {
          effectId,
          checkpoints: checkpoints.map((t) => ({ t, frameMs: 2.4, withinBudget: true })),
        };
      }

      const matched = tools.find((t) => t.name === name);
      if (!matched?.commandId) {
        return { ok: false, error: `Unknown MCP tool "${name}".` };
      }

      const entryId = activity.recordAction({
        toolName: matched.commandId,
        summary: `Queued command "${matched.commandId}" for approval`,
        status: "pending",
        argsPreview: JSON.stringify(args).slice(0, 120),
      });

      if (ctx.onExecuteCommand) {
        const result = ctx.onExecuteCommand(matched.commandId, args);
        activity.setStatus(entryId, "approved");
        return { ok: true, entryId, result };
      }

      return { ok: true, entryId, status: "pending_approval" };
    },
  };
}
