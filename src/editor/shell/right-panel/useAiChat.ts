"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { z, type ZodType } from "zod";
import { planBuilderTurn } from "@/ai/llm/builderPlanner";
import { useGhostDiffStore } from "@/ai/llm/ghostDiffStore";
import { resolvePromptMentions } from "@/ai/llm/mentions";
import { readSseFrames } from "@/ai/llm/sse";
import type { LlmStreamEvent } from "@/ai/llm/types";
import { applyMdmJsonPatches, validateStreamOutput } from "@/ai/llm/validationLoop";
import { validateMotionDocument } from "@/core/document/schema";
import { getAllCommands, getCommand } from "@/core/commands/registry";
import { rules } from "@/core/rules";
import { getDocument } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import type { AiChatMessage, AiProviderId, AiProviderStatusMap, RightPanelMode } from "./types";

interface StreamMetaPayload {
  provider: string;
  model: string;
  cachePrefixHash: string;
  keySource?: "byok" | "server" | "offline";
}

interface StreamUsagePayload {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

type OnlineProviderId = Exclude<AiProviderId, "offline">;

interface StoredAiSettings {
  provider: AiProviderId;
  keys: Partial<Record<OnlineProviderId, string>>;
  useUserKey: Partial<Record<OnlineProviderId, boolean>>;
  models: Partial<Record<AiProviderId, string>>;
}

const STORAGE_KEY = "lazylayout.ai.settings.v1";

const DEFAULT_PROVIDER_STATUS: AiProviderStatusMap = {
  anthropic: { configured: false, defaultModel: "claude-sonnet-5-5" },
  gemini: { configured: false, defaultModel: "gemini-2.5-flash" },
  nvidia: { configured: false, defaultModel: "nvidia/nemotron-3.5-super-vl-120b-a12b" },
  offline: { configured: true, defaultModel: "lazylayout-deterministic-v1.1" },
};

const EMPTY_SETTINGS: StoredAiSettings = { provider: "anthropic", keys: {}, useUserKey: {}, models: {} };

function sanitizePastedApiKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer(?:\s+|$)/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}
let cachedRawSettings: string | null = null;
let cachedParsedSettings: StoredAiSettings = EMPTY_SETTINGS;
const settingsListeners = new Set<() => void>();

function readStoredSettings(): StoredAiSettings {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRawSettings) return cachedParsedSettings;
    cachedRawSettings = raw;
    if (!raw) {
      cachedParsedSettings = EMPTY_SETTINGS;
      return cachedParsedSettings;
    }
    const parsed = JSON.parse(raw) as Partial<StoredAiSettings>;
    const provider =
      parsed.provider === "anthropic" ||
      parsed.provider === "gemini" ||
      parsed.provider === "nvidia" ||
      parsed.provider === "offline"
        ? parsed.provider
        : "anthropic";
    cachedParsedSettings = {
      provider,
      keys: parsed.keys && typeof parsed.keys === "object" ? parsed.keys : {},
      useUserKey: parsed.useUserKey && typeof parsed.useUserKey === "object" ? parsed.useUserKey : {},
      models: parsed.models && typeof parsed.models === "object" ? parsed.models : {},
    };
    return cachedParsedSettings;
  } catch {
    return EMPTY_SETTINGS;
  }
}

function writeStoredSettings(next: StoredAiSettings): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(next);
    cachedRawSettings = serialized;
    cachedParsedSettings = next;
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
  for (const listener of settingsListeners) {
    listener();
  }
}

function subscribeStoredSettings(listener: () => void): () => void {
  settingsListeners.add(listener);
  if (typeof window !== "undefined") {
    const onStorage = (evt: StorageEvent) => {
      if (evt.key === STORAGE_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      settingsListeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    settingsListeners.delete(listener);
  };
}

function getServerSettingsSnapshot(): StoredAiSettings {
  return EMPTY_SETTINGS;
}

export interface UseAiChatOptions {
  mode?: RightPanelMode;
  documentName?: string;
  endpoint?: string;
}

export interface UseAiChatResult {
  messages: AiChatMessage[];
  isLoading: boolean;
  error: string | null;
  lastUsage: StreamUsagePayload | null;
  lastMeta: StreamMetaPayload | null;
  provider: AiProviderId;
  setProvider: (provider: AiProviderId) => void;
  setModel: (provider: AiProviderId, model: string) => void;
  providerStatus: AiProviderStatusMap;
  userKeys: Partial<Record<OnlineProviderId, string>>;
  useUserKey: Partial<Record<OnlineProviderId, boolean>>;
  setUseUserKey: (provider: OnlineProviderId, useOwn: boolean) => void;
  customModels: Partial<Record<AiProviderId, string>>;
  saveCredentials: (provider: OnlineProviderId, apiKey: string, customModel?: string) => void;
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
}

function buildClientDocumentSnapshot(mode?: RightPanelMode, documentName?: string) {
  const doc = getDocument();
  const selectedIds = [...useSelectionStore.getState().selectedIds];
  const allLayers = Object.values(doc.layers ?? {});
  const rootIds = allLayers.filter((layer) => layer.parentId === null).map((layer) => layer.id);
  const pageCount = allLayers.filter((layer) => Boolean(layer.page)).length;
  const clips = Object.values(doc.clips ?? {});
  const trackCount = clips.reduce((acc, clip) => acc + (clip.tracks?.length ?? 0), 0);

  const layers = allLayers.slice(0, 120).map((layer) => {
    const propsEntries = Object.entries(layer.properties ?? {}).slice(0, 12);
    const propsSample = Object.fromEntries(propsEntries);
    return {
      id: layer.id,
      name: layer.name,
      type: layer.archetype,
      parentId: layer.parentId,
      childCount: layer.children.length,
      ...(propsEntries.length > 0 ? { propsSample } : {}),
    };
  });

  return {
    ...(documentName ? { documentName } : {}),
    ...(mode ? { activeMode: mode } : {}),
    pageCount,
    layerCount: allLayers.length,
    clipCount: clips.length,
    trackCount,
    selectedIds: selectedIds.slice(0, 100),
    rootIds: rootIds.slice(0, 100),
    layers,
    ...(doc.tokens ? { tokensSummary: doc.tokens } : {}),
  };
}

/**
 * Commands the AI may propose. File, export, history and test commands act outside the document (saving,
 * writing files, undoing the person's own steps), so the model is neither offered them nor allowed to stage them.
 */
const AI_BLOCKED_COMMAND_PREFIXES = ["file.", "export.", "test.", "edit.undo", "edit.redo"] as const;
export function isAiProposableCommand(commandId: string): boolean {
  return !AI_BLOCKED_COMMAND_PREFIXES.some((p) => commandId === p || commandId.startsWith(p));
}

function buildClientCommandCatalog() {
  return getAllCommands()
    .filter((cmd) => isAiProposableCommand(cmd.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 120)
    .map((cmd) => {
      let inputSchema: Record<string, unknown> | undefined;
      if (cmd.args) {
        try {
          const converted = z.toJSONSchema(cmd.args as ZodType, {
            unrepresentable: "any",
            io: "input",
            target: "draft-2020-12",
          });
          if (converted && typeof converted === "object" && !Array.isArray(converted)) {
            inputSchema = converted as Record<string, unknown>;
          }
        } catch {
          inputSchema = undefined;
        }
      }
      return {
        id: cmd.id,
        title: cmd.title,
        ...(cmd.category ? { category: cmd.category } : {}),
        ...(cmd.description ? { description: cmd.description } : {}),
        inputSchema: inputSchema ?? { type: "object", properties: {}, additionalProperties: false },
      };
    });
}

function formatToolProposal(name: string, input: unknown): string {
  const payload = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (name === "answer_about_document" && typeof payload.answer === "string") {
    return payload.answer;
  }
  if (name === "propose_mdm_patches") {
    const summary = typeof payload.summary === "string" ? payload.summary : "Proposed MDM edit";
    const patches = Array.isArray(payload.patches) ? payload.patches : [];
    return `${summary} (${patches.length} pending patch${patches.length === 1 ? "" : "es"}, awaiting approval).`;
  }
  if (name === "propose_nodescript_graph") {
    const graphName = typeof payload.graphName === "string" ? payload.graphName : "Graph";
    const summary = typeof payload.summary === "string" ? payload.summary : "";
    const source = typeof payload.source === "string" ? payload.source : "";
    return `${graphName}.nls${summary ? ` — ${summary}` : ""}${source ? `\n\n${source}` : ""}`;
  }
  if (name === "invoke_editor_command") {
    const commandId = typeof payload.commandId === "string" ? payload.commandId : "command";
    const rationale = typeof payload.rationale === "string" ? ` — ${payload.rationale}` : "";
    return `Suggested command \`${commandId}\`${rationale} (awaiting approval).`;
  }
  return `[Tool: ${name}]`;
}

let messageCounter = 0;
function nextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${Date.now()}-${messageCounter}`;
}

export function useAiChat({
  mode,
  documentName,
  endpoint = "/api/ai/chat",
}: UseAiChatOptions = {}): UseAiChatResult {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<StreamUsagePayload | null>(null);
  const [lastMeta, setLastMeta] = useState<StreamMetaPayload | null>(null);
  const settings = useSyncExternalStore(
    subscribeStoredSettings,
    readStoredSettings,
    getServerSettingsSnapshot,
  );
  const { provider, keys: userKeys, useUserKey, models: customModels } = settings;
  const [providerStatus, setProviderStatus] = useState<AiProviderStatusMap>(DEFAULT_PROVIDER_STATUS);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AiChatMessage[]>([]);
  const settingsRef = useRef<StoredAiSettings>(settings);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let active = true;
    fetch(endpoint, { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { providers?: AiProviderStatusMap } | null) => {
        if (active && json?.providers) {
          setProviderStatus(json.providers);
        }
      })
      .catch(() => {
        // Ignore offline/unavailable metadata checks cleanly.
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  const setProvider = useCallback((nextProvider: AiProviderId) => {
    const updated: StoredAiSettings = {
      ...settingsRef.current,
      provider: nextProvider,
    };
    writeStoredSettings(updated);
  }, []);

  const setModel = useCallback((targetProvider: AiProviderId, model: string) => {
    const nextModels = { ...settingsRef.current.models };
    const trimmed = model.trim();
    if (trimmed) nextModels[targetProvider] = trimmed;
    else delete nextModels[targetProvider];
    writeStoredSettings({
      ...settingsRef.current,
      models: nextModels,
    });
  }, []);

  const setUseUserKey = useCallback((targetProvider: OnlineProviderId, useOwn: boolean) => {
    const nextUseUserKey = { ...settingsRef.current.useUserKey, [targetProvider]: useOwn };
    writeStoredSettings({
      ...settingsRef.current,
      useUserKey: nextUseUserKey,
    });
  }, []);

  const saveCredentials = useCallback(
    (targetProvider: OnlineProviderId, apiKey: string, customModel?: string) => {
      const nextKeys = { ...settingsRef.current.keys };
      const trimmedKey = sanitizePastedApiKey(apiKey);
      if (trimmedKey) nextKeys[targetProvider] = trimmedKey;
      else delete nextKeys[targetProvider];

      const nextUseUserKey = { ...settingsRef.current.useUserKey };
      nextUseUserKey[targetProvider] = Boolean(trimmedKey);

      const nextModels = { ...settingsRef.current.models };
      const trimmedModel = customModel?.trim();
      if (trimmedModel) nextModels[targetProvider] = trimmedModel;
      else delete nextModels[targetProvider];

      const updated: StoredAiSettings = {
        ...settingsRef.current,
        keys: nextKeys,
        useUserKey: nextUseUserKey,
        models: nextModels,
      };
      writeStoredSettings(updated);
    },
    [],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    stop();
    useGhostDiffStore.getState().discardAll();
    useGhostDiffStore.getState().rejectAllCommands();
    setMessages([]);
    setError(null);
  }, [stop]);

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (!content) return;

      useGhostDiffStore.getState().rejectAllCommands();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: AiChatMessage = {
        id: nextMessageId("user"),
        role: "user",
        content,
      };
      const assistantId = nextMessageId("assistant");
      const assistantPlaceholder: AiChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      const docNow = getDocument();
      const rawSelectedIds = [...useSelectionStore.getState().selectedIds];
      const resolvedTargets = resolvePromptMentions(content, docNow, rawSelectedIds);
      const snapshot = {
        ...buildClientDocumentSnapshot(mode, documentName),
        selectedIds: resolvedTargets.targetLayerIds.slice(0, 100),
      };
      const targetTag =
        resolvedTargets.matchedCandidates.length > 0
          ? `[Targeted elements — apply edits to these exact layer IDs: ${resolvedTargets.matchedCandidates
              .map((c) => `${c.name} (id: "${c.id}", type: ${c.archetype})`)
              .join(", ")}]\n`
          : "";

      const historyPayload = [...messagesRef.current, { ...userMsg, content: `${targetTag}${content}` }]
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsLoading(true);
      setError(null);

      const updateAssistant = (updater: (current: string) => string) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: updater(m.content) } : m)),
        );
      };

      const activeProvider = settingsRef.current.provider;
      const storedKey =
        activeProvider !== "offline"
          ? sanitizePastedApiKey(settingsRef.current.keys[activeProvider] ?? "")
          : "";
      const wantUserKey =
        activeProvider !== "offline" &&
        Boolean(storedKey) &&
        (settingsRef.current.useUserKey?.[activeProvider] ?? true);
      const byokKey = wantUserKey ? storedKey : undefined;
      const modelOverride = settingsRef.current.models[activeProvider]?.trim();

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: activeProvider,
            ...(modelOverride ? { model: modelOverride } : {}),
            ...(byokKey ? { apiKey: byokKey } : {}),
            messages: historyPayload,
            documentContext: snapshot,
            commandSchemas: buildClientCommandCatalog(),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errMsg = `AI service returned HTTP ${res.status}.`;
          try {
            const data = (await res.json()) as { error?: string };
            if (typeof data?.error === "string" && data.error) errMsg = data.error;
          } catch {
            // Keep default HTTP status message.
          }
          setError(errMsg);
          updateAssistant(() => errMsg);
          return;
        }

        if (!res.body) {
          const fallback = "AI service returned an empty stream.";
          setError(fallback);
          updateAssistant(() => fallback);
          return;
        }

        const collectedEvents: LlmStreamEvent[] = [];
        let patchProposalSummary = "";

        for await (const frame of readSseFrames(res.body)) {
          if (!frame.data) continue;

          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(frame.data) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (evt.type === "meta") {
            const ks =
              evt.keySource === "byok" || evt.keySource === "server" || evt.keySource === "offline"
                ? evt.keySource
                : undefined;
            setLastMeta({
              provider: String(evt.provider ?? activeProvider),
              model: String(evt.model ?? ""),
              cachePrefixHash: String(evt.cachePrefixHash ?? ""),
              keySource: ks,
            });
          } else if (evt.type === "text_delta" && typeof evt.delta === "string") {
            const chunkText = evt.delta;
            collectedEvents.push({ type: "text_delta", delta: chunkText });
            updateAssistant((cur) => cur + chunkText);
          } else if (evt.type === "tool_use" && typeof evt.name === "string") {
            collectedEvents.push({
              type: "tool_use",
              id: typeof evt.id === "string" ? evt.id : "tool_1",
              name: evt.name,
              input: evt.input,
            });
            if (
              evt.name === "propose_mdm_patches" &&
              evt.input &&
              typeof evt.input === "object" &&
              typeof (evt.input as { summary?: unknown }).summary === "string"
            ) {
              patchProposalSummary = (evt.input as { summary: string }).summary;
            }
            const formatted = formatToolProposal(evt.name, evt.input);
            updateAssistant((cur) => {
              if (!cur) return formatted;
              return cur.includes(formatted) ? cur : `${cur}\n\n${formatted}`;
            });
          } else if (evt.type === "usage" && evt.usage && typeof evt.usage === "object") {
            setLastUsage(evt.usage as StreamUsagePayload);
          } else if (
            evt.type === "stop" &&
            evt.handling &&
            typeof evt.handling === "object" &&
            typeof (evt.handling as { userMessage?: unknown }).userMessage === "string"
          ) {
            const note = (evt.handling as { userMessage: string }).userMessage;
            updateAssistant((cur) => (cur ? `${cur}\n\n${note}` : note));
          } else if (evt.type === "error" && typeof evt.message === "string") {
            const errText = evt.message;
            setError(errText);
            updateAssistant((cur) => (cur ? `${cur}\n\n${errText}` : errText));
          }
        }

        // Phase 242/243: Validate patch proposals against MDM schema + rules.validate and stage ghost diff,
        // and stage any `invoke_editor_command` calls so Approve / Reject buttons always appear.
        let stagedValidProposal = false;
        let stagedCommandProposal = false;
        const hasErrorEvent = collectedEvents.some((e) => e.type === "error");

        for (const evt of collectedEvents) {
          if (evt.type !== "tool_use" || evt.name !== "invoke_editor_command") continue;
          const payload = (evt.input && typeof evt.input === "object" ? evt.input : {}) as Record<
            string,
            unknown
          >;
          const commandId = typeof payload.commandId === "string" ? payload.commandId.trim() : "";
          if (!commandId) continue;
          let parsedArgs: Record<string, unknown> | undefined;
          if (typeof payload.argsJson === "string" && payload.argsJson.trim()) {
            try {
              const raw = JSON.parse(payload.argsJson);
              if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                parsedArgs = raw as Record<string, unknown>;
              }
            } catch {
              // Ignore unparseable args JSON; command registry will report validation if required.
            }
          } else if (payload.args && typeof payload.args === "object" && !Array.isArray(payload.args)) {
            parsedArgs = payload.args as Record<string, unknown>;
          }
          const cmdDef = getCommand(commandId);
          if (!cmdDef || !isAiProposableCommand(commandId)) {
            updateAssistant((cur) => `${cur}\n\nNot staged: the AI can't run "${commandId}".`);
            continue;
          }
          useGhostDiffStore.getState().stageCommand({
            id: `${assistantId}-${evt.id}`,
            commandId,
            title: cmdDef?.title ?? commandId,
            rationale: typeof payload.rationale === "string" ? payload.rationale : "",
            ...(parsedArgs ? { args: parsedArgs } : {}),
          });
          stagedCommandProposal = true;
        }

        if (collectedEvents.some((e) => e.type === "tool_use" && e.name === "propose_mdm_patches")) {
          const check = validateStreamOutput(getDocument(), collectedEvents, rules.validate);
          if (check.valid && check.patches && check.patches.length > 0 && check.candidateDocument) {
            useGhostDiffStore.getState().stageProposal({
              proposalId: assistantId,
              prompt: content,
              summary: patchProposalSummary || "AI proposal",
              patches: check.patches,
              candidateDocument: check.candidateDocument,
            });
            stagedValidProposal = true;
          } else if (!check.valid && check.issues.length > 0) {
            const diagNote = check.issues
              .map((i) => `[${i.code}] ${i.message}`)
              .join("; ");
            setError(diagNote);
            updateAssistant((cur) => `${cur}\n\nNot staged — validation blocked: ${diagNote}`);
          } else {
            updateAssistant((cur) =>
              cur.replace(/\s*\(0 pending patches, awaiting approval\)\.?/gi, " (no changes proposed)."),
            );
          }
        }

        // If the model emitted text / unapplied .nls / blocked patches on a visual/cursor/motion request,
        // synthesize and stage a real runnable Ghost Diff (bindings / effects / clips) so Preview works immediately.
        const isVisualBuilderRequest =
          /\b(add|make|apply|animate|create|megnatic|magnetic|pull|cursor|pointer|hover|tilt|glow|bounce|fade|slide|scale|rotate|pulse|float|stagger|repel|glass|morphic|glassmorphic|blur|backdrop|change|edit|style|radius|opacity|color|fill|stroke|shadow|hide|show|move)\b/i.test(
            content,
          );
        if (!stagedValidProposal && !stagedCommandProposal && !hasErrorEvent && isVisualBuilderRequest) {
          const latestDoc = getDocument();
          const latestTargets = resolvePromptMentions(
            content,
            latestDoc,
            [...useSelectionStore.getState().selectedIds],
          );
          const plan = planBuilderTurn({
            prompt: content,
            documentContext: {
              ...buildClientDocumentSnapshot(mode, documentName),
              selectedIds: latestTargets.targetLayerIds,
            },
            targetLayerIds: latestTargets.targetLayerIds,
          });
          if (plan.patches.length > 0) {
            const applied = applyMdmJsonPatches(latestDoc, plan.patches);
            const check = applied.ok ? validateMotionDocument(applied.document) : null;
            if (check?.ok && rules.validate(check.document).length === 0) {
              setError(null);
              useGhostDiffStore.getState().stageProposal({
                proposalId: assistantId,
                prompt: content,
                summary: plan.summary,
                patches: plan.patches,
                candidateDocument: check.document,
                effectChoices: plan.matchedEffects,
              });
              updateAssistant(
                (cur) =>
                  `${cur ? `${cur}\n\n` : ""}The model didn't propose a change, so here is a built-in preset that matches your words: ${plan.summary}. Review it below; "Accept all" applies it, then Preview (▶) plays it.`,
              );
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          updateAssistant((cur) => (cur ? `${cur}\n\n(Stopped)` : "Stopped."));
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to reach AI service.";
        setError(message);
        updateAssistant((cur) => (cur ? `${cur}\n\n${message}` : message));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [documentName, endpoint, mode],
  );

  return {
    messages,
    isLoading,
    error,
    lastUsage,
    lastMeta,
    provider,
    setProvider,
    setModel,
    providerStatus,
    userKeys,
    useUserKey,
    setUseUserKey,
    customModels,
    saveCredentials,
    sendMessage,
    stop,
    clearMessages,
  };
}
