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
  /** Callback for more options button in header. */
  onMoreOptions?: () => void;
  /** Status chips (e.g. "Animated", "Data bound") shown below top row. */
  statusChips?: StatusChip[];
  /** Callback when a status chip is clicked. */
  onSelectStatusChip?: (chip: StatusChip) => void;
  /** Whether expanded AI chat view is open. When open, replaces entire right panel body. */
  aiOpen?: boolean;
  /** Callback when AI close button is clicked. */
  onAiClose?: () => void;
  /** Messages to display in the AI chat list. */
  aiMessages?: AiChatMessage[];
  /** Callback when a new AI message is sent. */
  onAiSendMessage?: (content: string) => void;
  /** Placeholder text for AI chat input. Default: "Ask anything about this…" */
  aiInputPlaceholder?: string;
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
