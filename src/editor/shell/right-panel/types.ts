import type React from "react";
import type { LucideIcon } from "lucide-react";

export type RightPanelMode = "design" | "motion" | "code";

export interface StatusChip {
  id: string;
  label: string;
  targetSection?: string;
  onClick?: () => void;
}

export interface DesignSectionConfig {
  id: string;
  title: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  collapsible?: boolean;
  onAdd?: () => void;
  moreContent?: React.ReactNode;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
}

export interface AccordionRowConfig {
  id: string;
  label: string;
  value: string;
  isMuted?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type AiProviderId = "anthropic" | "gemini" | "nvidia" | "offline";

export type AiProviderStatusMap = Record<
  AiProviderId,
  { configured: boolean; defaultModel: string }
>;

export interface RightPanelFrameProps {
  /** Active inspector mode. In motion and code modes, header is hidden and accordion rows show. */
  mode?: RightPanelMode;
  /** Selection name in header. Default: "Headline" */
  selectionName?: string;
  /** Selection icon in header. Default: Frame */
  selectionIcon?: LucideIcon;
  /** Whether the selected layer is hidden on canvas. */
  isLayerHidden?: boolean;
  /** Callback when hide layer eye toggle is clicked. */
  onToggleHideLayer?: () => void;
  /** Callback for the More menu Reset item in the header. */
  onReset?: () => void;
  /** Callback for the More menu Delete item in the header. */
  onDelete?: () => void;
  /** Status chips (e.g. "Animated", "Data bound") shown below top row. */
  statusChips?: StatusChip[];
  /** Callback when a status chip is clicked. */
  onSelectStatusChip?: (chip: StatusChip) => void;
  /** Whether expanded AI chat view is open. When open, replaces entire right panel body. */
  aiOpen?: boolean;
  /** Callback when the user manually opens the AI chat view. */
  onAiOpen?: () => void;
  /** Callback when AI close button is clicked. */
  onAiClose?: () => void;
  /** Messages to display in the AI chat list. */
  aiMessages?: AiChatMessage[];
  /** Callback when a new AI message is sent. */
  onAiSendMessage?: (content: string) => void;
  /** Active AI provider id. */
  aiProvider?: AiProviderId;
  /** Callback when the AI provider is switched. */
  onAiProviderChange?: (provider: AiProviderId) => void;
  /** Callback when the model for a provider is switched. */
  onAiModelChange?: (provider: AiProviderId, model: string) => void;
  /** Server built-in configuration availability per provider. */
  aiProviderStatus?: AiProviderStatusMap;
  /** Stored user BYOK keys per online provider (browser-local only). */
  aiUserKeys?: Partial<Record<Exclude<AiProviderId, "offline">, string>>;
  /** Whether the user's BYOK key (true) or built-in server key (false) is active per provider. */
  aiUseUserKey?: Partial<Record<Exclude<AiProviderId, "offline">, boolean>>;
  /** Switches between using the user's BYOK key vs the built-in server key. */
  onAiToggleUseUserKey?: (provider: Exclude<AiProviderId, "offline">, useOwn: boolean) => void;
  /** Optional key source used on the latest server response ("byok" | "server" | "offline"). */
  aiLastKeySource?: "byok" | "server" | "offline";
  /** Optional custom model overrides per provider. */
  aiCustomModels?: Partial<Record<AiProviderId, string>>;
  /** Callback when a user attaches/clears a BYOK key or model override. */
  onAiSaveCredentials?: (
    provider: Exclude<AiProviderId, "offline">,
    apiKey: string,
    customModel?: string,
  ) => void;
  /** Placeholder text for AI chat input. Default: "Ask anything about this…" */
  aiInputPlaceholder?: string;
  /** Whether an AI response is currently streaming/validating. */
  aiLoading?: boolean;
  /** Callback to abort an in-flight AI response. */
  onAiStop?: () => void;
  /** Explicit dimension override (2D or 3D) for the header switcher */
  dimension?: "2d" | "3d";
  /** Custom section list for Design mode. Defaults to the 11 prototype sections. */
  designSections?: DesignSectionConfig[];
  /** Custom accordion rows for Key/Motion mode. Defaults to the 9 prototype rows. */
  motionRows?: AccordionRowConfig[];
  /** Custom accordion rows for Code mode. Defaults to the 7 prototype rows. */
  codeRows?: AccordionRowConfig[];
  /** Custom body children to override default sections/rows. */
  children?: React.ReactNode;
  /** Additional container classes. */
  className?: string;
}
