import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  getMdmSchemaOverview,
  resolveCommandCatalog,
  type CommandSchemaEntry,
} from "./schemas";
import type { AiChatMessageInput, AiDocumentContext } from "./types";

const STATIC_ARCHITECTURE_PREFIX = [
  "You are the LazyLayout Studio AI assistant embedded inside a deterministic web & motion design studio.",
  "",
  "Architectural Laws you must follow strictly:",
  "1. One Document (Law 2): All design, animation, state, and interaction data lives in the canonical MotionDocument (MDM v2).",
  "2. No Silent Writes (Law 4): Every document edit MUST be proposed via `propose_mdm_patches` (RFC 6902 JSON Patch) or `invoke_editor_command` so the user approves before applying.",
  "3. NodeScript Format: Every logic/interaction/blueprint graph MUST be authored as `.nls` NodeScript text via `propose_nodescript_graph` (syntax: `#nls-version: 1.0`, `graph <Name> (type: event|function|macro) { node ..., wire ..., var ... }`), NEVER as raw JSON blueprint dumps.",
  "4. Canonical Property Paths: Reference properties using MDM dot-paths (e.g. `transform.x`, `transform.y`, `appearance.opacity`, `appearance.background.color`, `typography.fontSize`).",
  "5. Grounded Answers: When answering questions about the document, reference exact layer IDs, types, hierarchy, timeline counts, and inspected values supplied in the runtime document context. If a detail is absent from the context, state that clearly instead of guessing.",
  "6. Library Effects & Engine Routing: Prefer curated library effects (`doc.effects` / `fx_*`) and GPU-composited CSS/WAAPI transforms or opacity when they fit, and briefly state your engine choice (`CSS`, `SVG`, or `three.js`) in plain language.",
].join("\n");

const NODESCRIPT_GRAMMAR_SUMMARY = [
  "NodeScript (.nls) DSL grammar summary (no semicolons):",
  "- Optional header comment: `#nls-version: 1.0`",
  "- Root graph block: `graph <PascalCaseName> (type: event | function | macro) { ... }`",
  "- Variables: `var <name>: <number|string|boolean|object|array> = <literal>`",
  "- Nodes: `node <alias> : <RegistryNodeType>(<key>: <value>, ...)`",
  "- Wires: `wire <fromNode>.<fromPin> -> <toNode>.<toPin>` (ALWAYS use ASCII `->`, never `—`; BOTH endpoints MUST include `.<pin>`, e.g. `wire buttonX.value -> offsetX.b`).",
].join("\n");

/**
 * Builds the deterministic, cacheable system prompt prefix (`cache_control: { type: "ephemeral" }`)
 * containing architectural rules, MDM JSON Schema overview, `.nls` grammar, and Phase 13 command schemas.
 * Keeping every string deterministic ensures cache hits across repeated requests.
 */
export function buildStableSystemPrefix(
  commandSchemas?: readonly CommandSchemaEntry[],
): TextBlockParam[] {
  const mdm = getMdmSchemaOverview();
  const catalog = resolveCommandCatalog(commandSchemas);

  const mdmSummary = [
    `MDM JSON Schema (${mdm.schemaDraft}):`,
    `- Top-level collections: ${mdm.topLevelKeys.join(", ")}`,
    `- Required root fields: ${mdm.requiredKeys.join(", ")}`,
  ].join("\n");

  const commandCatalogLines = catalog.map((cmd) => {
    const schemaSummary = cmd.inputSchema ? JSON.stringify(cmd.inputSchema) : "{}";
    const meta = [cmd.category, cmd.description].filter(Boolean).join(" — ");
    return `- ${cmd.id} (${cmd.title})${meta ? `: ${meta}` : ""} | args schema: ${schemaSummary}`;
  });

  const stablePrefixText = [
    STATIC_ARCHITECTURE_PREFIX,
    "",
    mdmSummary,
    "",
    NODESCRIPT_GRAMMAR_SUMMARY,
    "",
    "Phase 13 Command Bus Catalog (sorted by id):",
    ...commandCatalogLines,
  ].join("\n");

  return [
    {
      type: "text",
      text: stablePrefixText,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/** Deterministic 64-bit FNV-1a dual-lane hex fingerprint of the cacheable system prefix blocks. */
export function computePrefixHash(blocks: readonly TextBlockParam[]): string {
  const payload = JSON.stringify(blocks);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i += 1) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function formatDocumentContextText(ctx: AiDocumentContext): string {
  return `<lazylayout_document_context>\n${JSON.stringify(ctx)}\n</lazylayout_document_context>`;
}

function formatDocumentContextBlock(ctx: AiDocumentContext): TextBlockParam {
  return {
    type: "text",
    text: formatDocumentContextText(ctx),
  };
}

/**
 * Converts chat messages + dynamic document snapshot + optional vision frames
 * into Anthropic `MessageParam[]` while keeping volatile context out of the system prefix.
 */
export function buildAnthropicMessages(
  messages: readonly AiChatMessageInput[],
  documentContext?: AiDocumentContext,
): MessageParam[] {
  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();

  return messages.map((msg, idx) => {
    if (msg.role === "assistant") {
      return {
        role: "assistant",
        content: msg.content,
      };
    }

    const blocks: ContentBlockParam[] = [];
    if (documentContext && idx === lastUserIndex) {
      blocks.push(formatDocumentContextBlock(documentContext));
    }

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (att.label) {
          blocks.push({ type: "text", text: `[Image: ${att.label}]` });
        }
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.mediaType,
            data: att.base64Data,
          },
        });
      }
    }

    blocks.push({ type: "text", text: msg.content });
    return {
      role: "user",
      content: blocks,
    };
  });
}
