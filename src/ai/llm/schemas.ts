import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { z, type ZodType } from "zod";
import type { Command } from "@/core/commands/types";
import { getMotionDocumentJsonSchema } from "@/core/document/schema";

export const CommandSchemaEntrySchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  category: z.string().max(60).optional(),
  description: z.string().max(300).optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});

export type CommandSchemaEntry = z.infer<typeof CommandSchemaEntrySchema>;

/** Deterministic baseline Phase 13 commands for server-only contexts without a live client bus. */
export const DEFAULT_PHASE13_COMMAND_CATALOG: readonly CommandSchemaEntry[] = [
  {
    id: "edit.redo",
    title: "Redo",
    category: "Edit",
    description: "Redo the last undone document transaction.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "edit.undo",
    title: "Undo",
    category: "Edit",
    description: "Undo the last document transaction.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "file.save",
    title: "Save Project",
    category: "File",
    description: "Flush and save the current LazyLayout project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "view.fit",
    title: "Zoom to Fit",
    category: "View",
    description: "Fit the active composition in the viewport.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

let cachedMdmSchema: Record<string, unknown> | null = null;

/** Cached MDM v2 draft-2020-12 JSON Schema sourced from `src/core/document/schema.ts`. */
export function getCachedMdmJsonSchema(): Record<string, unknown> {
  if (!cachedMdmSchema) {
    cachedMdmSchema = getMotionDocumentJsonSchema();
  }
  return cachedMdmSchema;
}

/** Extracts top-level property keys & required fields from the canonical MDM JSON Schema. */
export function getMdmSchemaOverview(): {
  topLevelKeys: string[];
  requiredKeys: string[];
  schemaDraft: string;
} {
  const schema = getCachedMdmJsonSchema();
  const props =
    schema.properties && typeof schema.properties === "object"
      ? Object.keys(schema.properties as Record<string, unknown>).sort()
      : [];
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string").sort()
    : [];
  return {
    topLevelKeys: props,
    requiredKeys: required,
    schemaDraft: typeof schema.$schema === "string" ? schema.$schema : "https://json-schema.org/draft/2020-12/schema",
  };
}

/** Converts a Zod schema into a plain JSON Schema object matching Phase 50's converter. */
export function zodToInputJsonSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!schema) return undefined;
  try {
    const jsonSchema = z.toJSONSchema(schema as ZodType, {
      unrepresentable: "any",
      io: "input",
      target: "draft-2020-12",
    });
    if (jsonSchema && typeof jsonSchema === "object" && !Array.isArray(jsonSchema)) {
      return jsonSchema as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Deterministically serializes live Phase 13 `Command` descriptors into schema entries sorted by `id`. */
export function serializeCommandsToSchemas(
  commands: readonly Pick<Command, "id" | "title" | "category" | "description" | "args">[],
): CommandSchemaEntry[] {
  const byId = new Map<string, CommandSchemaEntry>();
  for (const cmd of commands) {
    if (!cmd.id) continue;
    const inputSchema = zodToInputJsonSchema(cmd.args) ?? {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    byId.set(cmd.id, {
      id: cmd.id,
      title: cmd.title,
      ...(cmd.category ? { category: cmd.category } : {}),
      ...(cmd.description ? { description: cmd.description } : {}),
      inputSchema,
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Recursively normalizes an object JSON Schema node to satisfy Anthropic
 * `strict: true` rules (`additionalProperties: false` on every object schema).
 */
export function toStrictObjectSchema(schema: Record<string, unknown>): Tool.InputSchema {
  const normalizeNode = (node: unknown): unknown => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const record = node as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      if (k === "$schema") continue;
      if (k === "properties" && v && typeof v === "object" && !Array.isArray(v)) {
        const nextProps: Record<string, unknown> = {};
        for (const [propKey, propVal] of Object.entries(v as Record<string, unknown>)) {
          nextProps[propKey] = normalizeNode(propVal);
        }
        copy[k] = nextProps;
      } else if (k === "items") {
        copy[k] = Array.isArray(v) ? v.map(normalizeNode) : normalizeNode(v);
      } else if ((k === "anyOf" || k === "oneOf" || k === "allOf") && Array.isArray(v)) {
        copy[k] = v.map(normalizeNode);
      } else {
        copy[k] = v;
      }
    }
    if (copy.type === "object" || "properties" in copy) {
      copy.type = "object";
      if (!("properties" in copy)) copy.properties = {};
      copy.additionalProperties = false;
    }
    return copy;
  };

  const normalized = normalizeNode(schema) as Record<string, unknown>;
  if (normalized.type !== "object") {
    return { type: "object", properties: {}, additionalProperties: false };
  }
  return normalized as unknown as Tool.InputSchema;
}

/** Resolves a stable sorted command schema list, falling back to baseline Phase 13 commands. */
export function resolveCommandCatalog(
  commandSchemas?: readonly CommandSchemaEntry[],
): CommandSchemaEntry[] {
  const source = commandSchemas && commandSchemas.length > 0 ? commandSchemas : DEFAULT_PHASE13_COMMAND_CATALOG;
  const deduped = new Map<string, CommandSchemaEntry>();
  for (const entry of source) {
    deduped.set(entry.id, entry);
  }
  return [...deduped.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Sanitizes a command id into a valid Anthropic tool name (`^[a-zA-Z0-9_-]{1,64}$`). */
export function commandIdToToolName(commandId: string): string {
  const sanitized = commandId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `cmd_${sanitized}`.slice(0, 64);
}

/**
 * Builds strict Anthropic `Tool` definitions constrained by the MDM JSON Schema
 * and Phase 13 command schemas, with prompt caching on the final tool.
 */
export function buildStrictLlmTools(commandSchemas?: readonly CommandSchemaEntry[]): Tool[] {
  const mdmOverview = getMdmSchemaOverview();
  const catalog = resolveCommandCatalog(commandSchemas);
  const commandIds = catalog.map((c) => c.id);
  const rootPointerPattern = `^/(${mdmOverview.topLevelKeys.join("|")})(/.*)?$`;

  const tools: Tool[] = [
    {
      name: "answer_about_document",
      description:
        "Answer a question about the open MotionDocument using grounded layer IDs, property paths, timelines, or diagnostics.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          answer: { type: "string", description: "Clear explanation grounded in the active MotionDocument." },
          referencedLayerIds: {
            type: "array",
            items: { type: "string" },
            description: "IDs of referenced layers or scenes.",
          },
          referencedPropertyPaths: {
            type: "array",
            items: { type: "string" },
            description: "Canonical MDM property paths mentioned (e.g. transform.x, opacity).",
          },
        },
        required: ["answer", "referencedLayerIds", "referencedPropertyPaths"],
      },
    },
    {
      name: "propose_mdm_patches",
      description:
        "Propose RFC 6902 JSON Patch edits against the canonical MotionDocument (Law 4: user approves before applying).",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string", description: "Short description of the proposed edit." },
          patches: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                op: { type: "string", enum: ["add", "remove", "replace", "move", "copy", "test"] },
                path: {
                  type: "string",
                  pattern: rootPointerPattern,
                  description: `JSON Pointer targeting one of: ${mdmOverview.topLevelKeys.join(", ")}`,
                },
                from: { type: "string", description: "Source JSON Pointer for move/copy." },
                valueJson: {
                  type: "string",
                  description: "JSON-serialized value for add/replace/test matching MDM schema types.",
                },
              },
              required: ["op", "path"],
            },
          },
        },
        required: ["summary", "patches"],
      },
    },
    {
      name: "propose_nodescript_graph",
      description:
        "Propose an interactive logic or reactive graph in NodeScript (.nls) DSL format only (never raw JSON blobs).",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          graphName: { type: "string", description: "PascalCase graph identifier." },
          graphType: { type: "string", enum: ["event", "function", "macro"] },
          source: {
            type: "string",
            description: "Valid .nls NodeScript source starting with `#nls-version:` or `graph`.",
          },
          summary: { type: "string", description: "Concise summary of the graph behavior." },
        },
        required: ["graphName", "graphType", "source", "summary"],
      },
    },
    {
      name: "invoke_editor_command",
      description:
        "Propose executing a registered Phase 13 editor command matching its Zod input JSON Schema (Law 4 approval required).",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          commandId: {
            type: "string",
            enum: commandIds,
            description: "Exact Phase 13 command id from the command catalog.",
          },
          argsJson: {
            type: "string",
            description: "JSON-encoded object matching the command's JSON Schema from the prompt catalog.",
          },
          rationale: { type: "string", description: "Why this command helps the user request." },
        },
        required: ["commandId", "argsJson", "rationale"],
      },
    },
  ];

  // Mark final tool as cache breakpoint so tools + static system prefix cache cleanly on repeated calls.
  tools[tools.length - 1] = {
    ...tools[tools.length - 1],
    cache_control: { type: "ephemeral" },
  };

  return tools;
}

/**
 * Generates individual strict Anthropic `Tool` definitions for Phase 13 commands
 * that expose JSON-Schema inputs, preserving schema fidelity.
 */
export function buildPerCommandStrictTools(commandSchemas: readonly CommandSchemaEntry[]): Tool[] {
  return resolveCommandCatalog(commandSchemas).map((entry) => ({
    name: commandIdToToolName(entry.id),
    description: `${entry.title}${entry.description ? `: ${entry.description}` : ""} (Phase 13 command ${entry.id})`,
    strict: true,
    input_schema: toStrictObjectSchema(
      entry.inputSchema ?? { type: "object", properties: {}, additionalProperties: false },
    ),
  }));
}
