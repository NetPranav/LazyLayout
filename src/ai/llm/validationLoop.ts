import type { RuleDiagnostic } from "@/core/rules/types";
import { validateMotionDocument, type MotionDocument } from "@/core/document/schema";
import { NodeScriptParser } from "@/core/nodescript/Parser";
import { buildNodeScriptFromIntent, validateNodeScriptGraph } from "./offlineProvider";
import {
  MdmJsonPatchSchema,
  NodeScriptGraphProposalSchema,
  type AiChatMessageInput,
  type LlmChatRequest,
  type LlmProvider,
  type LlmStreamEvent,
  type MdmJsonPatch,
  type NodeScriptGraphProposal,
} from "./types";

export interface ValidationIssue {
  stage: "schema" | "rules" | "nodescript" | "empty";
  code: string;
  message: string;
  suggestion?: string;
}

export interface TurnValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  candidateDocument?: MotionDocument;
  patches?: MdmJsonPatch[];
  nodeScript?: NodeScriptGraphProposal;
  text: string;
}

export interface ValidatedLlmTurnResult {
  accepted: boolean;
  attempts: 1 | 2;
  repaired: boolean;
  text: string;
  candidateDocument?: MotionDocument;
  patches?: MdmJsonPatch[];
  nodeScript?: NodeScriptGraphProposal;
  diagnostics: ValidationIssue[];
  rejectionReason?: string;
  events: LlmStreamEvent[];
}

export type RulesValidatorFn = (doc: MotionDocument) => RuleDiagnostic[];

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function decodePointer(pointer: string): string[] {
  if (!pointer || pointer === "/") return [];
  return pointer
    .slice(1)
    .split("/")
    .map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function getAtPath(root: unknown, segments: string[]): unknown {
  let cursor: unknown = root;
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    if (Array.isArray(cursor)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx)) return undefined;
      cursor = cursor[idx];
    } else {
      cursor = (cursor as Record<string, unknown>)[seg];
    }
  }
  return cursor;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Pure RFC 6902 patch applier producing a cloned candidate `MotionDocument`
 * without mutating the active store (Law 4).
 */
export function applyMdmJsonPatches(
  baseDoc: MotionDocument,
  patches: readonly MdmJsonPatch[],
): { ok: true; document: MotionDocument } | { ok: false; error: string } {
  const clone = deepClone(baseDoc) as Record<string, unknown>;

  for (let idx = 0; idx < patches.length; idx += 1) {
    const patch = patches[idx];
    const segments = decodePointer(patch.path);
    if (segments.length === 0) {
      return { ok: false, error: `Patch #${idx}: cannot replace root document directly.` };
    }
    if (segments.some((s) => FORBIDDEN_KEYS.has(s))) {
      return { ok: false, error: `Patch #${idx}: forbidden key in path "${patch.path}".` };
    }

    const parentSegs = segments.slice(0, -1);
    const leafKey = segments[segments.length - 1];
    let parent: unknown = clone;
    for (const seg of parentSegs) {
      if (!parent || typeof parent !== "object") {
        return { ok: false, error: `Patch #${idx}: non-object container on path "${patch.path}".` };
      }
      const record = parent as Record<string, unknown>;
      if (!(seg in record) || record[seg] === undefined) {
        record[seg] = {};
      }
      parent = record[seg];
    }

    if (!parent || typeof parent !== "object") {
      return { ok: false, error: `Patch #${idx}: missing target parent for "${patch.path}".` };
    }

    if (Array.isArray(parent)) {
      if (patch.op === "add") {
        if (leafKey === "-") parent.push(deepClone(patch.value));
        else parent.splice(Number(leafKey), 0, deepClone(patch.value));
      } else if (patch.op === "replace") {
        parent[Number(leafKey)] = deepClone(patch.value);
      } else if (patch.op === "remove") {
        parent.splice(Number(leafKey), 1);
      }
    } else {
      const target = parent as Record<string, unknown>;
      if (patch.op === "add" || patch.op === "replace") {
        target[leafKey] = deepClone(patch.value);
      } else if (patch.op === "remove") {
        delete target[leafKey];
      } else if (patch.op === "copy" && patch.from) {
        target[leafKey] = deepClone(getAtPath(clone, decodePointer(patch.from)));
      } else if (patch.op === "move" && patch.from) {
        const fromSegs = decodePointer(patch.from);
        const val = deepClone(getAtPath(clone, fromSegs));
        target[leafKey] = val;
        const fromParent = getAtPath(clone, fromSegs.slice(0, -1));
        if (fromParent && typeof fromParent === "object" && !Array.isArray(fromParent)) {
          delete (fromParent as Record<string, unknown>)[fromSegs[fromSegs.length - 1]];
        }
      }
    }
  }

  return { ok: true, document: clone as MotionDocument };
}

function normalizeRawPatchList(rawPatches: unknown[]): MdmJsonPatch[] {
  return rawPatches.map((entry) => {
    const rec = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    let value = rec.value;
    if (value === undefined && typeof rec.valueJson === "string") {
      try {
        value = JSON.parse(rec.valueJson);
      } catch {
        value = rec.valueJson;
      }
    }
    return {
      op: rec.op as MdmJsonPatch["op"],
      path: String(rec.path ?? ""),
      ...(typeof rec.from === "string" ? { from: rec.from } : {}),
      ...(value !== undefined ? { value } : {}),
    };
  });
}

/**
 * Validates all collected tool outputs from a single model turn against:
 * 1) Tool/Patch + MDM schema (`validateMotionDocument`) and/or `.nls` parser + `TypeChecker`
 * 2) `rules.validate` (`validateRules`)
 */
export function validateStreamOutput(
  baseDoc: MotionDocument,
  events: readonly LlmStreamEvent[],
  validateRules: RulesValidatorFn,
): TurnValidationResult {
  const issues: ValidationIssue[] = [];
  let text = "";
  let patches: MdmJsonPatch[] | undefined;
  let nodeScript: NodeScriptGraphProposal | undefined;
  let candidateDoc: MotionDocument = deepClone(baseDoc);
  let hasActionableTool = false;

  for (const evt of events) {
    if (evt.type === "text_delta") {
      text += evt.delta;
    } else if (evt.type === "error") {
      issues.push({
        stage: "schema",
        code: evt.code,
        message: evt.message,
      });
    } else if (evt.type === "tool_use") {
      if (evt.name === "answer_about_document") {
        hasActionableTool = true;
      } else if (evt.name === "propose_mdm_patches") {
        hasActionableTool = true;
        const raw = (evt.input && typeof evt.input === "object" ? evt.input : {}) as Record<
          string,
          unknown
        >;
        if (!Array.isArray(raw.patches)) {
          issues.push({
            stage: "schema",
            code: "INVALID_PATCHES",
            message: "`propose_mdm_patches` must provide a `patches` array.",
          });
          continue;
        }
        const normalized = normalizeRawPatchList(raw.patches);
        for (let i = 0; i < normalized.length; i += 1) {
          const check = MdmJsonPatchSchema.safeParse(normalized[i]);
          if (!check.success) {
            issues.push({
              stage: "schema",
              code: "PATCH_SCHEMA_ERROR",
              message: `Patch #${i}: ${check.error.issues.map((x) => x.message).join("; ")}`,
            });
          }
        }
        if (issues.length === 0) {
          const applied = applyMdmJsonPatches(candidateDoc, normalized);
          if (!applied.ok) {
            issues.push({ stage: "schema", code: "PATCH_APPLY_ERROR", message: applied.error });
          } else {
            candidateDoc = applied.document;
            patches = [...(patches ?? []), ...normalized];
          }
        }
      } else if (evt.name === "propose_nodescript_graph") {
        hasActionableTool = true;
        const parsedProposal = NodeScriptGraphProposalSchema.safeParse(evt.input);
        if (!parsedProposal.success) {
          issues.push({
            stage: "schema",
            code: "NODESCRIPT_SCHEMA_ERROR",
            message: parsedProposal.error.issues.map((x) => x.message).join("; "),
          });
          continue;
        }
        nodeScript = parsedProposal.data;
        try {
          const graph = NodeScriptParser.parse(nodeScript.source);
          const graphErrors = validateNodeScriptGraph(graph);
          for (const gErr of graphErrors) {
            issues.push({ stage: "nodescript", code: "NODESCRIPT_TYPE_ERROR", message: gErr });
          }
        } catch (err) {
          issues.push({
            stage: "nodescript",
            code: "NODESCRIPT_SYNTAX_ERROR",
            message: err instanceof Error ? err.message : "Invalid .nls syntax.",
            suggestion:
              "Use ASCII '->' (never '—') and ensure every wire endpoint has <node>.<pin>, e.g. 'wire buttonX.value -> offsetX.b'.",
          });
        }
      } else if (evt.name === "invoke_editor_command") {
        hasActionableTool = true;
      }
    }
  }

  if (!hasActionableTool && !text.trim() && issues.length === 0) {
    issues.push({
      stage: "empty",
      code: "EMPTY_MODEL_OUTPUT",
      message: "Model produced neither a valid tool output nor an answer.",
    });
  }

  // Run full MDM schema check + rules.validate when patches modified the candidate document
  if (patches && patches.length > 0 && issues.length === 0) {
    const mdmCheck = validateMotionDocument(candidateDoc);
    if (!mdmCheck.ok) {
      for (const issue of mdmCheck.issues) {
        issues.push({
          stage: "schema",
          code: "MDM_SCHEMA_ERROR",
          message: `${issue.path}: ${issue.message}`,
        });
      }
    } else {
      const ruleDiags = validateRules(mdmCheck.document);
      for (const diag of ruleDiags) {
        issues.push({
          stage: "rules",
          code: diag.code,
          message: diag.message,
          suggestion: diag.suggestion,
        });
      }
      candidateDoc = mdmCheck.document;
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    ...(patches ? { candidateDocument: candidateDoc, patches } : {}),
    ...(nodeScript ? { nodeScript } : {}),
    text: text.trim(),
  };
}

function buildRepairMessage(issues: readonly ValidationIssue[]): AiChatMessageInput {
  const details = issues
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.stage}/${i.code}] ${i.message}${i.suggestion ? ` (Fix hint: ${i.suggestion})` : ""}`,
    )
    .join("\n");
  return {
    role: "user",
    content: [
      "Your previous output failed validation. Fix all diagnostics below and return a valid schema- and rule-compliant proposal (one repair attempt):",
      details,
    ].join("\n"),
  };
}

export interface ExecuteValidatedTurnOptions {
  baseDocument: MotionDocument;
  provider: LlmProvider;
  request: LlmChatRequest;
  validateRules: RulesValidatorFn;
  signal?: AbortSignal;
}

/**
 * Phase 242 validation loop:
 * Runs the provider, validates output against MDM/`.nls` schema and `rules.validate`,
 * triggers at most ONE repair turn with diagnostics, or rejects with an explanation.
 */
export async function executeValidatedLlmTurn({
  baseDocument,
  provider,
  request,
  validateRules,
  signal,
}: ExecuteValidatedTurnOptions): Promise<ValidatedLlmTurnResult> {
  const runSinglePass = async (req: LlmChatRequest) => {
    const events: LlmStreamEvent[] = [];
    for await (const evt of provider.streamChat(req, { signal })) {
      events.push(evt);
    }
    return {
      events,
      validation: validateStreamOutput(baseDocument, events, validateRules),
    };
  };

  // Attempt 1
  const pass1 = await runSinglePass(request);
  if (pass1.validation.valid) {
    return {
      accepted: true,
      attempts: 1,
      repaired: false,
      text: pass1.validation.text,
      candidateDocument: pass1.validation.candidateDocument,
      patches: pass1.validation.patches,
      nodeScript: pass1.validation.nodeScript,
      diagnostics: [],
      events: pass1.events,
    };
  }

  // Single Repair Turn (Attempt 2, max 1 repair allowed by Phase 242)
  const repairRequest: LlmChatRequest = {
    ...request,
    messages: [
      ...request.messages,
      {
        role: "assistant",
        content:
          pass1.validation.text ||
          JSON.stringify({
            patches: pass1.validation.patches ?? [],
            nodeScript: pass1.validation.nodeScript,
          }),
      },
      buildRepairMessage(pass1.validation.issues),
    ],
  };

  const pass2 = await runSinglePass(repairRequest);
  if (pass2.validation.valid) {
    return {
      accepted: true,
      attempts: 2,
      repaired: true,
      text: pass2.validation.text,
      candidateDocument: pass2.validation.candidateDocument,
      patches: pass2.validation.patches,
      nodeScript: pass2.validation.nodeScript,
      diagnostics: [],
      events: pass2.events,
    };
  }

  const reasons = pass2.validation.issues
    .map((i) => `[${i.code}] ${i.message}${i.suggestion ? ` — ${i.suggestion}` : ""}`)
    .join("; ");

  return {
    accepted: false,
    attempts: 2,
    repaired: true,
    text: pass2.validation.text,
    diagnostics: pass2.validation.issues,
    rejectionReason: `Suggestion rejected after 1 repair attempt because it still violates validation rules: ${reasons}`,
    events: pass2.events,
  };
}

export { buildNodeScriptFromIntent };
