"use client";

import React, { useState, useId, useRef, useEffect } from "react";
import { ArrowUp, Key, Loader2, Square, X } from "lucide-react";
import { DEFAULT_MODELS_BY_PROVIDER, PROVIDER_MODEL_OPTIONS } from "@/ai/llm/constants";
import {
  explainSelectionMotion,
  fixDiagnosticsForDocument,
  runSelectionScopedEdit,
} from "@/ai/llm/copilot";
import { useGhostDiffStore } from "@/ai/llm/ghostDiffStore";
import { applyMdmJsonPatches } from "@/ai/llm/validationLoop";
import { useMcpActivityStore } from "@/ai/mcp/mcpActivityStore";
import { rules } from "@/core/rules";
import { getDocument } from "@/core/store/documentState";
import { useSelectionStore } from "@/core/store/useSelectionStore";
import { Icon } from "@/editor/components/Icon";
import { IconButton } from "@/editor/components/IconButton";
import { LogoMark } from "@/editor/components/LogoMark";
import type { AiChatMessage, AiProviderId, AiProviderStatusMap } from "./types";

export interface RightPanelAiChatProps {
  onAiClose?: () => void;
  aiMessages?: AiChatMessage[];
  onAiSendMessage?: (content: string) => void;
  aiProvider?: AiProviderId;
  onAiProviderChange?: (provider: AiProviderId) => void;
  onAiModelChange?: (provider: AiProviderId, model: string) => void;
  aiProviderStatus?: AiProviderStatusMap;
  aiUserKeys?: Partial<Record<Exclude<AiProviderId, "offline">, string>>;
  aiCustomModels?: Partial<Record<AiProviderId, string>>;
  onAiSaveCredentials?: (
    provider: Exclude<AiProviderId, "offline">,
    apiKey: string,
    customModel?: string,
  ) => void;
  aiInputPlaceholder?: string;
  aiLoading?: boolean;
  onAiStop?: () => void;
  className?: string;
}

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: "Claude",
  gemini: "Gemini",
  nvidia: "NVIDIA NIM",
  offline: "Offline",
};

const KEY_HINTS: Record<Exclude<AiProviderId, "offline">, string> = {
  anthropic: "sk-ant-...",
  gemini: "AIza...",
  nvidia: "nvapi-...",
};

export const RightPanelAiChat: React.FC<RightPanelAiChatProps> = ({
  onAiClose,
  aiMessages = [],
  onAiSendMessage,
  aiProvider = "anthropic",
  onAiProviderChange,
  onAiModelChange,
  aiProviderStatus,
  aiUserKeys,
  aiCustomModels,
  onAiSaveCredentials,
  aiInputPlaceholder = "Ask anything about this…",
  aiLoading = false,
  onAiStop,
  className = "",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [keysOpen, setKeysOpen] = useState(false);
  const [mcpLogOpen, setMcpLogOpen] = useState(false);
  const [copilotNote, setCopilotNote] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const keyInputId = `${baseId}-apikey`;
  const modelInputId = `${baseId}-model`;
  const listRef = useRef<HTMLDivElement>(null);
  const copilotSeqRef = useRef(0);
  const pendingGhost = useGhostDiffStore((s) => s.pending);
  const stageGhostProposal = useGhostDiffStore((s) => s.stageProposal);
  const acceptAllGhost = useGhostDiffStore((s) => s.acceptAll);
  const acceptLayerGhost = useGhostDiffStore((s) => s.acceptLayer);
  const discardLayerGhost = useGhostDiffStore((s) => s.discardLayer);
  const discardAllGhost = useGhostDiffStore((s) => s.discardAll);
  const mcpEntries = useMcpActivityStore((s) => s.entries);
  const setMcpStatus = useMcpActivityStore((s) => s.setStatus);
  const selectedIdsSet = useSelectionStore((s) => s.selectedIds);

  const handleCopilotAction = (action: "bouncier" | "stagger" | "calmer" | "explain" | "fix") => {
    const doc = getDocument();
    const selectedIds = [...selectedIdsSet];
    if (action === "explain") {
      const info = explainSelectionMotion(doc, selectedIds);
      setCopilotNote(`[${info.engineChoice}] ${info.summary}`);
      return;
    }
    if (action === "fix") {
      const fix = fixDiagnosticsForDocument(doc, rules.validate);
      setCopilotNote(fix.summary);
      if (fix.patches.length > 0) {
        const applied = applyMdmJsonPatches(doc, fix.patches);
        if (applied.ok) {
          copilotSeqRef.current += 1;
          stageGhostProposal({
            proposalId: `fix-${copilotSeqRef.current}`,
            prompt: "Fix rule and performance diagnostics",
            patches: fix.patches,
            summary: fix.summary,
            candidateDocument: applied.document,
          });
        }
      }
      return;
    }
    const promptMap = {
      bouncier: "Make the selected animation bouncier",
      stagger: "Stagger the selected layers from the centre",
      calmer: "Make this motion calmer on mobile",
    } as const;
    const res = runSelectionScopedEdit(doc, selectedIds, promptMap[action], rules.validate);
    setCopilotNote(res.summary);
    if (res.accepted && res.patches.length > 0) {
      const applied = applyMdmJsonPatches(doc, res.patches);
      if (applied.ok) {
        copilotSeqRef.current += 1;
        stageGhostProposal({
          proposalId: `copilot-${copilotSeqRef.current}`,
          prompt: promptMap[action],
          patches: res.patches,
          summary: res.summary,
          candidateDocument: applied.document,
        });
      }
    }
  };

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [aiMessages.length, aiLoading]);

  const syncDraftForProvider = (nextProvider: AiProviderId) => {
    if (nextProvider === "offline") {
      setDraftKey("");
      setDraftModel("");
      return;
    }
    setDraftKey(aiUserKeys?.[nextProvider] ?? "");
    setDraftModel(aiCustomModels?.[nextProvider] ?? "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiLoading) return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAiSendMessage?.(trimmed);
    setInputValue("");
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiProvider === "offline") return;
    onAiSaveCredentials?.(aiProvider, draftKey, draftModel);
    setKeysOpen(false);
  };

  const handleClearKey = () => {
    if (aiProvider === "offline") return;
    setDraftKey("");
    setDraftModel("");
    onAiSaveCredentials?.(aiProvider, "", "");
  };

  const hasUserKey = aiProvider !== "offline" && Boolean(aiUserKeys?.[aiProvider]);
  const hasServerKey = aiProvider === "offline" || Boolean(aiProviderStatus?.[aiProvider]?.configured);
  const defaultModel =
    aiProviderStatus?.[aiProvider]?.defaultModel ?? DEFAULT_MODELS_BY_PROVIDER[aiProvider];
  const modelOptions = PROVIDER_MODEL_OPTIONS[aiProvider] ?? [];
  const activeModel = aiCustomModels?.[aiProvider]?.trim() || defaultModel;
  const isPresetModel = modelOptions.some((opt) => opt.id === activeModel);

  return (
    <section
      aria-label="AI chat"
      className={`ll-aichat ll:flex ll:flex-1 ll:flex-col ll:min-h-0 ll:overflow-hidden ll:font-sans ll:text-body ${className}`}
    >
      {/* AI Chat Header */}
      <div className="ll-aichead ll:h-header ll:pl-4 ll:pr-3 ll:flex ll:items-center ll:gap-2 ll:border-b ll:border-border ll:shrink-0">
        <span className="ll-logo ll-aimark ll:text-primary ll:shrink-0">
          <LogoMark size={18} />
        </span>
        <span className="ll-aitl ll:text-body ll:font-medium ll:text-primary ll:font-sans">
          AI
        </span>

        {onAiProviderChange && (
          <select
            aria-label="AI provider"
            value={aiProvider}
            onChange={(e) => {
              const next = e.target.value as AiProviderId;
              syncDraftForProvider(next);
              onAiProviderChange(next);
            }}
            className="ll:h-6 ll:px-1.5 ll:bg-surface-bar ll:border ll:border-border ll:rounded-sm ll:text-small ll:text-primary ll:font-sans ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
          >
            {(["anthropic", "gemini", "nvidia", "offline"] as const).map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABELS[id]}
              </option>
            ))}
          </select>
        )}

        <div className="ll:flex-1" />

        {onAiSaveCredentials && aiProvider !== "offline" && (
          <button
            type="button"
            aria-label="API key settings"
            aria-pressed={keysOpen}
            title={
              hasUserKey
                ? "Using your API key (click to edit)"
                : hasServerKey
                  ? "Using studio built-in key (click to attach your own)"
                  : "Attach your API key"
            }
            onClick={() => {
              if (!keysOpen) syncDraftForProvider(aiProvider);
              setKeysOpen((open) => !open);
            }}
            className={`ll:h-6 ll:px-2 ll:flex ll:items-center ll:gap-1 ll:rounded-sm ll:border ll:text-nano ll:font-medium ll:cursor-pointer ll:shrink-0 ${
              keysOpen || hasUserKey
                ? "ll:border-border-active ll:bg-surface-hover ll:text-primary"
                : "ll:border-border ll:bg-surface-bar ll:text-secondary ll:hover:text-primary"
            }`}
          >
            <Icon icon={Key} size={12} />
            <span>{hasUserKey ? "Key ✓" : "API Key"}</span>
          </button>
        )}

        <IconButton
          aria-label="Close AI"
          title="Close AI"
          icon={<Icon icon={X} size={16} />}
          onClick={onAiClose}
        />
      </div>

      {/* Model selector bar */}
      <div className="ll:h-8 ll:px-3 ll:flex ll:items-center ll:gap-2 ll:border-b ll:border-border ll:bg-surface-bar ll:shrink-0">
        <span className="ll:text-nano ll:text-muted ll:shrink-0">Model</span>
        <select
          aria-label="AI model"
          value={activeModel}
          disabled={!onAiModelChange && !onAiSaveCredentials}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "__custom__") {
              syncDraftForProvider(aiProvider);
              setKeysOpen(true);
              return;
            }
            if (onAiModelChange) {
              onAiModelChange(aiProvider, val);
            } else if (aiProvider !== "offline" && onAiSaveCredentials) {
              onAiSaveCredentials(aiProvider, aiUserKeys?.[aiProvider] ?? "", val);
            }
          }}
          className="ll:flex-1 ll:min-w-0 ll:h-6 ll:px-1.5 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:text-small ll:text-primary ll:font-sans ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
        >
          {modelOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
          {!isPresetModel && activeModel && (
            <option value={activeModel}>Custom: {activeModel}</option>
          )}
          {aiProvider !== "offline" && <option value="__custom__">Custom model…</option>}
        </select>

        <button
          type="button"
          aria-label="MCP activity log toggle"
          aria-pressed={mcpLogOpen}
          onClick={() => setMcpLogOpen((open) => !open)}
          className={`ll:h-6 ll:px-1.5 ll:rounded-sm ll:border ll:text-nano ll:font-medium ll:shrink-0 ll:cursor-pointer ${
            mcpLogOpen
              ? "ll:border-border-active ll:bg-surface-hover ll:text-primary"
              : "ll:border-border ll:bg-surface-panel ll:text-secondary hover:ll:text-primary"
          }`}
        >
          MCP{mcpEntries.length > 0 ? ` (${mcpEntries.length})` : ""}
        </button>
      </div>

      {/* Phase 245: Selection-scoped Co-pilot Quick Actions */}
      <div
        aria-label="AI co-pilot quick actions"
        className="ll:px-3 ll:py-1.5 ll:flex ll:flex-wrap ll:items-center ll:gap-1 ll:border-b ll:border-border ll:bg-surface-panel ll:shrink-0"
      >
        {(
          [
            { id: "bouncier", label: "Bouncier" },
            { id: "stagger", label: "Stagger" },
            { id: "calmer", label: "Calmer" },
            { id: "explain", label: "Explain" },
            { id: "fix", label: "Fix" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleCopilotAction(item.id)}
            className="ll:h-5 ll:px-1.5 ll:rounded-xs ll:border ll:border-border ll:bg-surface-bar ll:text-nano ll:text-secondary hover:ll:text-primary hover:ll:bg-surface-hover ll:cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {copilotNote && (
        <div className="ll:px-3 ll:py-1.5 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:items-start ll:justify-between ll:gap-2 ll:shrink-0">
          <span className="ll:text-nano ll:text-primary ll:leading-snug">{copilotNote}</span>
          <button
            type="button"
            aria-label="Dismiss co-pilot note"
            onClick={() => setCopilotNote(null)}
            className="ll:text-nano ll:text-muted hover:ll:text-primary ll:cursor-pointer ll:shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Phase 250: MCP Activity Log Drawer */}
      {mcpLogOpen && (
        <div
          aria-label="MCP activity log"
          className="ll:max-h-36 ll:overflow-y-auto ll:p-2.5 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:flex-col ll:gap-1.5 ll:shrink-0"
        >
          <div className="ll:flex ll:items-center ll:justify-between">
            <span className="ll:text-nano ll:font-medium ll:text-primary">MCP Activity Log</span>
            <span className="ll:text-nano ll:text-muted">{mcpEntries.length} action(s)</span>
          </div>
          {mcpEntries.length === 0 ? (
            <span className="ll:text-nano ll:text-muted">No MCP agent actions recorded yet.</span>
          ) : (
            mcpEntries.map((entry) => (
              <div
                key={entry.id}
                className="ll:p-1.5 ll:rounded-xs ll:border ll:border-border ll:bg-surface-panel ll:flex ll:items-center ll:justify-between ll:gap-2"
              >
                <div className="ll:min-w-0">
                  <div className="ll:text-nano ll:font-medium ll:text-primary ll:truncate">
                    {entry.toolName} · {entry.status}
                  </div>
                  <div className="ll:text-nano ll:text-secondary ll:truncate">{entry.summary}</div>
                </div>
                {entry.status === "pending" && (
                  <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
                    <button
                      type="button"
                      onClick={() => setMcpStatus(entry.id, "rejected")}
                      className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:border ll:border-border ll:text-nano ll:text-secondary ll:cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setMcpStatus(entry.id, "approved")}
                      className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-nano ll:cursor-pointer"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Missing API key prompt */}
      {aiProvider !== "offline" && !hasUserKey && !hasServerKey && !keysOpen && onAiSaveCredentials && (
        <div className="ll:px-3 ll:py-2 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:items-center ll:justify-between ll:gap-2 ll:shrink-0">
          <span className="ll:text-nano ll:text-secondary ll:leading-tight">
            No built-in key for {PROVIDER_LABELS[aiProvider]}.
          </span>
          <button
            type="button"
            onClick={() => {
              syncDraftForProvider(aiProvider);
              setKeysOpen(true);
            }}
            className="ll:h-6 ll:px-2 ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-nano ll:font-medium ll:shrink-0 ll:cursor-pointer"
          >
            Attach API key
          </button>
        </div>
      )}

      {/* Collapsible BYOK API Key & Model drawer */}
      {keysOpen && aiProvider !== "offline" && (
        <form
          onSubmit={handleSaveKey}
          aria-label="BYOK API key settings"
          className="ll:p-3 ll:bg-surface-bar ll:border-b ll:border-border ll:flex ll:flex-col ll:gap-2 ll:shrink-0"
        >
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <label htmlFor={keyInputId} className="ll:text-small ll:font-medium ll:text-primary">
              {PROVIDER_LABELS[aiProvider]} API key
            </label>
            <span className="ll:text-nano ll:text-muted">
              {hasUserKey ? "Your key saved locally" : hasServerKey ? "Built-in active" : "Key required"}
            </span>
          </div>

          <input
            id={keyInputId}
            type="password"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder={KEY_HINTS[aiProvider]}
            autoComplete="off"
            className="ll:h-7 ll:px-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:text-small ll:text-primary ll:placeholder:text-muted ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
          />

          <label htmlFor={modelInputId} className="ll:text-nano ll:text-secondary">
            Model ID override (optional)
          </label>
          <input
            id={modelInputId}
            type="text"
            value={draftModel}
            onChange={(e) => setDraftModel(e.target.value)}
            placeholder={defaultModel}
            autoComplete="off"
            className="ll:h-7 ll:px-2 ll:bg-surface-panel ll:border ll:border-border ll:rounded-sm ll:text-small ll:text-primary ll:placeholder:text-muted ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active"
          />

          <div className="ll:flex ll:items-center ll:justify-end ll:gap-2">
            {hasUserKey && (
              <button
                type="button"
                onClick={handleClearKey}
                className="ll:h-6 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:text-small ll:text-secondary ll:hover:text-primary ll:cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="ll:h-6 ll:px-2.5 ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-small ll:font-medium ll:cursor-pointer"
            >
              Save key
            </button>
          </div>
        </form>
      )}

      {/* Message List */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        className="ll-ailist ll:flex-1 ll:min-h-0 ll:overflow-y-auto ll:p-4 ll:flex ll:flex-col ll:gap-4"
      >
        {aiMessages.map((msg) => (
          <p
            key={msg.id}
            className={`ll-aimsg ll:m-0 ll:whitespace-pre-wrap ll:font-sans ll:text-body ll:leading-normal ${
              msg.role === "user"
                ? "ll-you ll:text-secondary"
                : "ll:text-primary"
            }`}
          >
            {msg.content}
          </p>
        ))}

        {aiLoading && (
          <div
            role="status"
            aria-live="polite"
            className="ll:flex ll:items-center ll:gap-2 ll:text-small ll:text-secondary"
          >
            <Loader2 size={14} className="ll:animate-spin ll:shrink-0 ll:text-primary" />
            <span>Thinking &amp; validating…</span>
          </div>
        )}
      </div>

      {/* Phase 243: Pending Ghost Diff Review Bar */}
      {pendingGhost && (
        <div
          aria-label="Pending AI ghost diff"
          className="ll:p-3 ll:bg-surface-bar ll:border-t ll:border-border ll:flex ll:flex-col ll:gap-2 ll:shrink-0"
        >
          <div className="ll:flex ll:items-center ll:justify-between ll:gap-2">
            <span className="ll:text-small ll:font-medium ll:text-primary ll:truncate">
              {pendingGhost.summary}
            </span>
            <div className="ll:flex ll:items-center ll:gap-1 ll:shrink-0">
              <button
                type="button"
                onClick={discardAllGhost}
                className="ll:h-6 ll:px-2 ll:rounded-sm ll:border ll:border-border ll:bg-surface-panel ll:text-nano ll:text-secondary ll:hover:text-primary ll:cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => acceptAllGhost()}
                className="ll:h-6 ll:px-2 ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:text-nano ll:font-medium ll:cursor-pointer"
              >
                Accept all
              </button>
            </div>
          </div>

          {pendingGhost.engineSummary && (
            <p className="ll:m-0 ll:text-nano ll:text-secondary ll:leading-normal">
              {pendingGhost.engineSummary}
            </p>
          )}

          {Object.values(pendingGhost.layerDiffs).length > 1 && (
            <div className="ll:flex ll:flex-col ll:gap-1">
              {Object.values(pendingGhost.layerDiffs).map((diff) => (
                <div
                  key={diff.layerId}
                  className="ll:flex ll:items-center ll:justify-between ll:gap-2 ll:text-nano"
                >
                  <span className="ll:truncate ll:text-primary">{diff.layerName}</span>
                  <div className="ll:flex ll:items-center ll:gap-1">
                    <button
                      type="button"
                      onClick={() => discardLayerGhost(diff.layerId)}
                      className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:border ll:border-border ll:text-secondary ll:cursor-pointer"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => acceptLayerGhost(diff.layerId)}
                      className="ll:px-1.5 ll:py-0.5 ll:rounded-xs ll:bg-control-primary-bg ll:text-control-primary-fg ll:cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer / Input row */}
      <div className="ll-aichatfoot ll:shrink-0 ll:p-3 ll:border-t ll:border-border">
        <form
          onSubmit={handleSubmit}
          className="ll-airow ll:flex ll:items-center ll:gap-2 ll:min-w-0"
        >
          <input
            id={inputId}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={aiInputPlaceholder}
            aria-label={aiInputPlaceholder.replace(/…$/, "")}
            autoComplete="off"
            className="ll:flex-1 ll:min-w-0 ll:h-8 ll:p-0 ll:bg-transparent ll:border-0 ll:font-sans ll:text-body ll:text-primary ll:placeholder:text-muted ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-border-active ll:rounded-sm ll:transition-all"
          />
          {aiLoading && onAiStop ? (
            <button
              type="button"
              onClick={onAiStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="ll-aistop ll:w-8 ll:h-8 ll:shrink-0 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-border ll:bg-surface-bar ll:text-primary ll:hover:bg-surface-hover ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:transition-none"
            >
              <Icon icon={Square} size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={aiLoading || !inputValue.trim()}
              aria-label="Send"
              title="Send"
              className="ll-aisend ll:w-8 ll:h-8 ll:shrink-0 ll:grid ll:place-items-center ll:rounded-sm ll:bg-control-primary-bg ll:text-control-primary-fg ll:hover:opacity-90 ll:disabled:opacity-40 ll:cursor-pointer ll:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:transition-none"
            >
              <Icon icon={ArrowUp} size={16} />
            </button>
          )}
        </form>
      </div>
    </section>
  );
};
