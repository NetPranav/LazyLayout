"use client";

import React from "react";
import {
  Menu,
  MenuItem,
  SubMenu,
  MenuSeparator,
  ThemeSwatch,
} from "@/editor/components/Menu";
import { Icon } from "@/editor/components/Icon";
import {
  Scissors,
  Copy,
  Trash2,
  Play,
  RotateCcw,
  Palette,
  Edit2,
  Plus,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Eye,
  Lock,
  Diamond,
  Flag,
  Clock,
  Hash,
  X,
  FastForward,
  BookmarkPlus,
  Check,
} from "lucide-react";
import {
  useMotionModel,
  motionActions,
  PORD,
  PROPS,
  EZL,
  LABEL_COLORS,
} from "@/editor/motion-model";
import type { EaseName } from "@/editor/motion-model";
import type { ContextMenuState } from "./types";
import { SplitIcon, EaseCurveIcon } from "./icons";
import { timelineOpsAdapter } from "./timelineOpsAdapter";
import { EASE_PRESETS } from "@/core/timeline/graph";

export interface TimelineMenusProps {
  ctx: ContextMenuState | null;
  onClose: () => void;
}

export const TimelineMenus: React.FC<TimelineMenusProps> = ({ ctx, onClose }) => {
  const comp = useMotionModel((s) => s.comp);
  const framesMode = useMotionModel((s) => s.frames);
  const wa = useMotionModel((s) => s.wa);

  if (!ctx || !ctx.kind) return null;

  const currentLayer = ctx.layerId
    ? comp.layers.find((x) => x.id === ctx.layerId) ?? null
    : null;
  const currentClip =
    currentLayer && ctx.clipIndex !== undefined
      ? currentLayer.clips[ctx.clipIndex] ?? null
      : null;

  const freeProps = currentLayer
    ? PORD.filter((p) => !currentLayer.tr.some((t) => t.p === p))
    : [];

  return (
    <Menu
      open={true}
      onClose={onClose}
      position={{ x: ctx.x, y: ctx.y }}
      variant="context"
    >
      {/* 1. Keyframe Context Menu */}
      {ctx.kind === "keyframe" && (
        <>
          <SubMenu
            id="sub-key-easing"
            label="Easing"
            icon={<Icon icon={Diamond} size={14} className="ll:text-muted ll:shrink-0" />}
          >
            {EZL.filter((e) => e !== "Custom").map((easeName) => (
              <MenuItem
                key={easeName}
                icon={
                  <Icon
                    icon={ctx.currentEase === easeName ? Check : Diamond}
                    size={14}
                    className="ll:text-muted ll:shrink-0"
                  />
                }
                onClick={() => {
                  if (ctx.keyId) {
                    motionActions.setKeyEase(ctx.keyId, easeName as EaseName);
                  }
                  onClose();
                }}
              >
                {easeName}
              </MenuItem>
            ))}
          </SubMenu>

          {/* Phase 67: the engine's named feels (springs by Bounce and Time), its curves and Hold, on the selected keyframes */}
          <SubMenu
            id="sub-key-feel"
            label="Feel"
            icon={<Icon icon={Diamond} size={14} className="ll:text-muted ll:shrink-0" />}
          >
            {EASE_PRESETS.map((preset) => (
              <MenuItem
                key={preset.id}
                onClick={() => {
                  const selected = Object.keys(useMotionModel.getState().selectedKeys);
                  const ids = ctx.keyId && !selected.includes(ctx.keyId) ? [ctx.keyId] : selected;
                  motionActions.applyEasePreset(ids, preset.value);
                  onClose();
                }}
              >
                {preset.label}
              </MenuItem>
            ))}
          </SubMenu>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Copy} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Ctrl+C"
            onClick={() => {
              motionActions.copyKeys();
              onClose();
            }}
          >
            Copy
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Copy} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Ctrl+V"
            onClick={() => {
              if (ctx.layerId) {
                motionActions.pasteKeys(ctx.layerId, ctx.prop ?? null, ctx.frame);
              }
              onClose();
            }}
          >
            Paste
          </MenuItem>
          <MenuItem
            icon={<Icon icon={FastForward} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Ctrl+D"
            onClick={() => {
              motionActions.duplicateKeys();
              onClose();
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Trash2} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Del"
            onClick={() => {
              if (ctx.keyId) {
                motionActions.deleteKeys([ctx.keyId]);
              }
              onClose();
            }}
          >
            Delete
          </MenuItem>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Check} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              if (currentLayer && ctx.prop) {
                const tr = currentLayer.tr.find((t) => t.p === ctx.prop);
                if (tr) {
                  const ids = tr.keys.map((k) => k.id);
                  motionActions.selectKeys(ids, false);
                }
              }
              onClose();
            }}
          >
            Select all on track
          </MenuItem>
          <MenuItem
            icon={<Icon icon={FastForward} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.alignKeysToPlayhead();
              onClose();
            }}
          >
            Align to playhead
          </MenuItem>
          <MenuItem
            disabled={Object.keys(useMotionModel.getState().selectedKeys).length < 3}
            onClick={() => {
              motionActions.distributeKeys();
              onClose();
            }}
          >
            Distribute evenly
          </MenuItem>
          <MenuItem
            onClick={() => {
              motionActions.scaleKeyTime(1.25);
              onClose();
            }}
          >
            Slower
          </MenuItem>
          <MenuItem
            onClick={() => {
              motionActions.scaleKeyTime(0.8);
              onClose();
            }}
          >
            Faster
          </MenuItem>
        </>
      )}

      {/* 2. Clip Context Menu */}
      {ctx.kind === "clip" && currentLayer && currentClip && (
        <>
          <MenuItem
            icon={<Icon icon={SplitIcon} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="C"
            disabled={
              currentLayer.lock ||
              ctx.frame <= currentClip.s + 1 ||
              ctx.frame >= currentClip.e - 1
            }
            onClick={() => {
              timelineOpsAdapter.splitClipAtPlayhead(currentLayer.id, {
                clipIndex: ctx.clipIndex,
                frame: ctx.frame,
              });
              onClose();
            }}
          >
            Split at playhead
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Copy} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Ctrl+D"
            disabled={currentLayer.lock}
            onClick={() => {
              motionActions.duplicateClip(currentLayer.id, ctx.clipIndex ?? 0);
              onClose();
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Trash2} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Del"
            disabled={currentLayer.lock}
            onClick={() => {
              motionActions.deleteClip(currentLayer.id, ctx.clipIndex ?? 0);
              onClose();
            }}
          >
            Delete
          </MenuItem>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Play} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock || ctx.frame >= currentClip.e}
            onClick={() => {
              motionActions.trimClip(currentLayer.id, ctx.clipIndex ?? 0, "s", ctx.frame);
              onClose();
            }}
          >
            Trim start to playhead
          </MenuItem>
          <MenuItem
            icon={<Icon icon={FastForward} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock || ctx.frame <= currentClip.s}
            onClick={() => {
              motionActions.trimClip(currentLayer.id, ctx.clipIndex ?? 0, "e", ctx.frame);
              onClose();
            }}
          >
            Trim end to playhead
          </MenuItem>
          <MenuItem
            icon={<Icon icon={FastForward} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock}
            onClick={() => {
              motionActions.moveClip(currentLayer.id, ctx.clipIndex ?? 0, ctx.frame);
              onClose();
            }}
          >
            Move to playhead
          </MenuItem>

          <MenuSeparator />

          <SubMenu
            id="sub-clip-label"
            label="Label colour"
            icon={<Icon icon={Palette} size={14} className="ll:text-muted ll:shrink-0" />}
          >
            {LABEL_COLORS.map((name, i) => (
              <MenuItem
                key={name}
                icon={<ThemeSwatch theme="paper" />}
                onClick={() => {
                  motionActions.setLayerLabel(currentLayer.id, i + 1);
                  onClose();
                }}
              >
                {name}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={RotateCcw} size={14} className="ll:text-muted ll:shrink-0" />}
              onClick={() => {
                motionActions.setLayerLabel(currentLayer.id, 0);
                onClose();
              }}
            >
              Type default
            </MenuItem>
          </SubMenu>

          <MenuItem
            icon={<Icon icon={Edit2} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="F2"
            onClick={() => {
              onClose();
            }}
          >
            Rename
          </MenuItem>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Copy} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.copyAnimation(currentLayer.id, ctx.clipIndex ?? 0);
              onClose();
            }}
          >
            Copy animation
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Copy} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock}
            onClick={() => {
              motionActions.pasteAnimation(currentLayer.id, ctx.frame);
              onClose();
            }}
          >
            Paste animation
          </MenuItem>
          <MenuItem
            icon={<Icon icon={BookmarkPlus} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.copyAnimation(currentLayer.id, ctx.clipIndex ?? 0);
              onClose();
            }}
          >
            Save as preset
          </MenuItem>
          <MenuItem
            icon={<Icon icon={RotateCcw} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock}
            onClick={() => {
              motionActions.reverseClip(currentLayer.id, ctx.clipIndex ?? 0);
              onClose();
            }}
          >
            Reverse
          </MenuItem>
        </>
      )}

      {/* 3. Track Context Menu */}
      {ctx.kind === "track" && currentLayer && (
        <>
          <SubMenu
            id="sub-track-add-prop"
            label="Add property"
            icon={<Icon icon={Plus} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock || freeProps.length === 0}
          >
            {freeProps.map((p) => (
              <MenuItem
                key={p}
                icon={<Icon icon={Plus} size={14} className="ll:text-muted ll:shrink-0" />}
                onClick={() => {
                  motionActions.addProperty(currentLayer.id, p);
                  onClose();
                }}
              >
                {PROPS[p].n}
              </MenuItem>
            ))}
          </SubMenu>

          <MenuItem
            icon={<Icon icon={ChevronDown} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              comp.layers.forEach((l) => {
                motionActions.setLayer(l.id, { open: true, gopen: true });
              });
              onClose();
            }}
          >
            Expand all
          </MenuItem>
          <MenuItem
            icon={<Icon icon={ChevronRight} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              comp.layers.forEach((l) => {
                motionActions.setLayer(l.id, { open: false, gopen: false });
              });
              onClose();
            }}
          >
            Collapse all
          </MenuItem>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={currentLayer.mute ? EyeOff : Eye} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.toggleLayerMute(currentLayer.id);
              onClose();
            }}
          >
            {currentLayer.mute ? "Unmute" : "Mute"}
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Eye} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.toggleLayerSolo(currentLayer.id);
              onClose();
            }}
          >
            {currentLayer.solo ? "Unsolo" : "Solo"}
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Lock} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.toggleLayerLock(currentLayer.id);
              onClose();
            }}
          >
            {currentLayer.lock ? "Unlock" : "Lock"}
          </MenuItem>

          <MenuSeparator />

          <SubMenu
            id="sub-track-label"
            label="Label colour"
            icon={<Icon icon={Palette} size={14} className="ll:text-muted ll:shrink-0" />}
          >
            {LABEL_COLORS.map((name, i) => (
              <MenuItem
                key={name}
                icon={<ThemeSwatch theme="paper" />}
                onClick={() => {
                  motionActions.setLayerLabel(currentLayer.id, i + 1);
                  onClose();
                }}
              >
                {name}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem
              icon={<Icon icon={RotateCcw} size={14} className="ll:text-muted ll:shrink-0" />}
              onClick={() => {
                motionActions.setLayerLabel(currentLayer.id, 0);
                onClose();
              }}
            >
              Type default
            </MenuItem>
          </SubMenu>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Trash2} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={currentLayer.lock || currentLayer.tr.length === 0}
            onClick={() => {
              if (ctx.prop) {
                motionActions.removeProperty(currentLayer.id, ctx.prop);
              } else {
                motionActions.setLayer(currentLayer.id, { tr: [] });
              }
              onClose();
            }}
          >
            Remove animation
          </MenuItem>
        </>
      )}

      {/* 4. Lane Context Menu */}
      {ctx.kind === "lane" && (
        <>
          <MenuItem
            icon={<Icon icon={Copy} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Ctrl+V"
            disabled={!currentLayer || currentLayer.lock}
            onClick={() => {
              if (currentLayer) {
                motionActions.pasteKeys(currentLayer.id, ctx.prop ?? null, ctx.frame);
              }
              onClose();
            }}
          >
            Paste
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Diamond} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="K"
            disabled={!currentLayer || currentLayer.lock}
            onClick={() => {
              if (currentLayer) {
                const targetProp = ctx.prop ?? currentLayer.tr[0]?.p ?? "opacity";
                motionActions.addKey(currentLayer.id, targetProp, ctx.frame);
              }
              onClose();
            }}
          >
            Add keyframe here
          </MenuItem>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Flag} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="M"
            onClick={() => {
              motionActions.addMarker(ctx.frame);
              onClose();
            }}
          >
            Add marker
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Check} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="Ctrl+A"
            onClick={() => {
              const allKeyIds: string[] = [];
              for (const l of comp.layers) {
                for (const tr of l.tr) {
                  for (const k of tr.keys) allKeyIds.push(k.id);
                }
              }
              motionActions.selectKeys(allKeyIds, false);
              onClose();
            }}
          >
            Select all
          </MenuItem>
        </>
      )}

      {/* 5. Ruler Context Menu */}
      {ctx.kind === "ruler" && (
        <>
          <MenuItem
            icon={<Icon icon={FastForward} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="I"
            onClick={() => {
              motionActions.setWorkArea(ctx.frame, wa.b);
              onClose();
            }}
          >
            Set in point here
          </MenuItem>
          <MenuItem
            icon={<Icon icon={FastForward} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="O"
            onClick={() => {
              motionActions.setWorkArea(wa.a, ctx.frame);
              onClose();
            }}
          >
            Set out point here
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Flag} size={14} className="ll:text-muted ll:shrink-0" />}
            shortcut="M"
            onClick={() => {
              motionActions.addMarker(ctx.frame);
              onClose();
            }}
          >
            Add marker
          </MenuItem>
          <MenuItem
            icon={<Icon icon={X} size={14} className="ll:text-muted ll:shrink-0" />}
            disabled={wa.a === 0 && wa.b === comp.dur}
            onClick={() => {
              motionActions.resetWorkArea();
              onClose();
            }}
          >
            Clear work area
          </MenuItem>

          <MenuSeparator />

          <MenuItem
            icon={<Icon icon={Clock} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.setFrames(false);
              onClose();
            }}
          >
            {framesMode ? "Timecode" : "✓ Timecode"}
          </MenuItem>
          <MenuItem
            icon={<Icon icon={Hash} size={14} className="ll:text-muted ll:shrink-0" />}
            onClick={() => {
              motionActions.setFrames(true);
              onClose();
            }}
          >
            {framesMode ? "✓ Frames" : "Frames"}
          </MenuItem>
        </>
      )}
    </Menu>
  );
};
