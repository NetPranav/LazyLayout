import React, { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import {
  CONNECT_FEELS,
  connectPropertyToSource,
  type ConnectFeel,
  type ConnectInputTarget,
  type ConnectResult,
} from "@/core/bindings/connectAnything";

export interface ConnectLinkHandleProps {
  readonly targetLayerId: string;
  readonly targetPath: string;
  readonly targetLabel?: string;
  readonly onConnect?: (result: ConnectResult) => void;
  readonly className?: string;
}

const QUICK_INPUTS: ReadonlyArray<{ readonly key: string; readonly label: string; readonly source: ConnectInputTarget }> = [
  { key: "cursor", label: "Cursor", source: { kind: "cursor", axis: "x" } },
  { key: "scroll", label: "Scroll", source: { kind: "scroll" } },
  { key: "key", label: "Key", source: { kind: "key", axis: "x" } },
  { key: "mic", label: "Mic", source: { kind: "microphone" } },
];

/**
 * Phase 141 · Connect anything pick-whip handle: drag any property onto
 * Cursor, Scroll, Key, Microphone, or another layer's property, and tune by feel.
 */
export const ConnectLinkHandle: React.FC<ConnectLinkHandleProps> = ({
  targetLayerId,
  targetPath,
  targetLabel,
  onConnect,
  className = "",
}) => {
  const [feel, setFeel] = useState<ConnectFeel>("gentle");
  const [lastPreview, setLastPreview] = useState<ConnectResult | null>(null);

  const previewSentence = useMemo(() => {
    if (lastPreview) return lastPreview.sentence;
    return connectPropertyToSource({
      targetLayerId,
      targetPath,
      targetLabel,
      source: { kind: "cursor", axis: "x" },
      feel,
    }).sentence;
  }, [lastPreview, targetLayerId, targetPath, targetLabel, feel]);

  const handleConnect = (source: ConnectInputTarget, nextFeel: ConnectFeel = feel) => {
    const result = connectPropertyToSource({
      targetLayerId,
      targetPath,
      targetLabel,
      source,
      feel: nextFeel,
    });
    setLastPreview(result);
    onConnect?.(result);
  };

  return (
    <div data-testid={`connect-handle-${targetPath}`} className={`ll:flex ll:flex-col ll:gap-1 ${className}`}>
      <div className="ll:flex ll:items-center ll:gap-1">
        <button
          type="button"
          draggable
          aria-label={`Drag link handle for ${targetLabel ?? targetPath}`}
          onDragStart={(e) => {
            e.dataTransfer?.setData(
              "application/x-lazylayout-connect-prop",
              JSON.stringify({ targetLayerId, targetPath, targetLabel, feel })
            );
          }}
          className="ll:w-7 ll:h-7 ll:grid ll:place-items-center ll:rounded-sm ll:border ll:border-board-line ll:bg-surface-bar ll:text-secondary ll:hover:text-primary ll:cursor-grab"
          title="Drag onto Cursor, Scroll, Key, Mic, or another property"
        >
          <Icon icon={Link2} size={13} />
        </button>

        <div className="ll:flex ll:items-center ll:gap-1 ll:flex-wrap">
          {QUICK_INPUTS.map((target) => (
            <button
              key={target.key}
              type="button"
              onClick={() => handleConnect(target.source)}
              className="ll:h-6 ll:px-2 ll:rounded-sm ll:border ll:border-board-line ll:bg-surface-bar ll:text-micro ll:text-primary ll:hover:bg-surface-hover"
            >
              {target.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ll:flex ll:items-center ll:gap-1">
        {CONNECT_FEELS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setFeel(preset.id)}
            className={`ll:h-6 ll:px-2 ll:rounded-sm ll:border ll:text-micro ${
              feel === preset.id
                ? "ll:bg-control-primary ll:text-control-primary-fg ll:border-control-primary"
                : "ll:bg-surface-panel ll:text-secondary ll:border-board-line ll:hover:text-primary"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="ll:text-micro ll:text-secondary">{previewSentence}</p>
    </div>
  );
};
