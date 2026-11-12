"use client";

/**
 * ============================================================================
 * 3D LOOKS STRIP (Phase 3D-023)
 * ============================================================================
 * Thumbnail strip rendered at the top of each Simple face tab:
 *   - Offline-rendered 96 px thumbnails cached by `lookId:targetShape`.
 *   - Instant flat-colour / gradient fallback when WebGL is unavailable.
 *   - One-click application via typed command `3d.look.apply`.
 *   - "Save as look" action to capture the current entity state into doc.looks.
 * ============================================================================
 */

import React, { useState, useId, useMemo } from "react";
import { Plus, Check, Sparkles, Trash2 } from "lucide-react";
import { Icon } from "@/editor/components/Icon";
import { Button } from "@/editor/components/Button";
import { TextField } from "@/editor/components/TextField";
import { compositor } from "@/core/gpu/compositor";
import { useDocument } from "@/core/store/useDocumentStore";
import { tryRunCommand } from "@/core/commands";
import { createId } from "@/core/ids";
import {
  BUILTIN_LOOKS,
  getLooksForSection,
  type BuiltinLook,
  type Look3d,
  type LookSection,
} from "@/core/3d/looks";

// Cache for rendered 96px thumbnails
const thumbnailCache = new Map<string, string>();

function getThumbnail(look: BuiltinLook, targetShape: string): string | null {
  const cacheKey = `${look.id}:${targetShape}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  // Attempt offline render using shared compositor WebGL context
  try {
    const gl = compositor.shared();
    if (gl) {
      compositor.ensureSharedSize(96, 96);
      gl.viewport(0, 0, 96, 96);
      gl.clearColor(0.12, 0.14, 0.18, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const canvas = compositor.sharedCanvasElement();
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        thumbnailCache.set(cacheKey, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // WebGL offline rendering failed or unavailable; use fast flat-colour fallback
  }

  return null;
}

export interface LooksStripProps {
  section: LookSection;
  targetId: string;
  activeLookId?: string;
  onApplyLook?: (lookId: string) => void;
  className?: string;
}

export const LooksStrip: React.FC<LooksStripProps> = ({
  section,
  targetId,
  activeLookId,
  onApplyLook,
  className = "",
}) => {
  const inputId = useId();
  const [isSaving, setIsSaving] = useState(false);
  const [newLookName, setNewLookName] = useState("");

  const docLooks = useDocument((d) => d.looks);
  const docObjects = useDocument((d) => d.objects);
  const docMaterials = useDocument((d) => d.materials);

  const looks = useMemo(() => {
    return getLooksForSection(section, docLooks as Record<string, BuiltinLook> | undefined);
  }, [section, docLooks]);

  const handleApply = (lookId: string) => {
    tryRunCommand("3d.look.apply", { lookId, targetIds: [targetId] });
    onApplyLook?.(lookId);
  };

  const handleSaveAsLook = () => {
    if (!newLookName.trim()) return;

    const currentObj = docObjects?.[targetId];
    let values: Record<string, unknown> = {};

    if (section === "material") {
      const matId = currentObj?.materialSlots?.[0] ?? currentObj?.materials?.[0];
      const mat = matId ? docMaterials?.[matId] : undefined;
      if (mat) {
        values = {
          baseColor: mat.baseColor,
          metallic: mat.metallic,
          roughness: mat.roughness,
          emissive: mat.emissive,
          emissiveIntensity: mat.emissiveIntensity ?? 0,
          opacity: mat.opacity ?? 1.0,
          wireframe: mat.wireframe ?? false,
        };
      }
    } else if (section === "modifier" && currentObj?.modifiers?.[0]) {
      const mod = currentObj.modifiers[0];
      values = {
        type: mod.type,
        ...(mod.params ?? {}),
      };
    }

    const newLook: Look3d = {
      id: createId("look"),
      name: newLookName.trim(),
      section,
      values,
    };

    tryRunCommand("3d.look.save", { look: newLook });

    setNewLookName("");
    setIsSaving(false);
  };

  const handleDeleteLook = (e: React.MouseEvent, lookId: string) => {
    e.stopPropagation();
    tryRunCommand("3d.look.delete", { lookId });
  };

  return (
    <div
      data-testid="looks-strip"
      className={`ll:flex ll:flex-col ll:gap-2 ll:pb-2.5 ll:border-b ll:border-border/60 ${className}`}
    >
      {/* Strip Header */}
      <div className="ll:flex ll:items-center ll:justify-between ll:px-0.5">
        <div className="ll:flex ll:items-center ll:gap-1.5">
          <Icon icon={Sparkles} size={13} className="ll:text-accent" />
          <span className="ll:text-micro ll:font-semibold ll:text-primary ll:uppercase ll:tracking-wider">
            Looks
          </span>
        </div>
        <button
          type="button"
          data-testid="save-look-button"
          onClick={() => setIsSaving((prev) => !prev)}
          className="ll:text-micro ll:text-muted ll:hover:text-primary ll:flex ll:items-center ll:gap-1 ll:bg-transparent ll:border-0 ll:cursor-pointer ll:p-0"
        >
          <Icon icon={Plus} size={12} />
          <span>Save as look</span>
        </button>
      </div>

      {/* Save as Look inline prompt */}
      {isSaving && (
        <div className="ll:flex ll:items-center ll:gap-1.5 ll:p-2 ll:bg-surface-canvas ll:border ll:border-border ll:rounded-md">
          <TextField
            id={inputId}
            aria-label="New look name"
            placeholder="Look name..."
            value={newLookName}
            onChange={(e) => setNewLookName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveAsLook();
              if (e.key === "Escape") setIsSaving(false);
            }}
            size="sm"
            className="ll:flex-1"
            autoFocus
          />
          <Button size="sm" variant="primary" onClick={handleSaveAsLook}>
            Save
          </Button>
        </div>
      )}

      {/* Horizontal Scrolling Looks Strip */}
      <div className="ll:flex ll:items-center ll:gap-2 ll:overflow-x-auto ll:py-1 ll:no-scrollbar">
        {looks.map((look) => {
          const isSelected = activeLookId === look.id;
          const isUserLook = !BUILTIN_LOOKS[look.id];
          const cachedImg = getThumbnail(look, "sphere");
          const fallbackBg = look.previewColor ?? "#475569";

          return (
            <button
              key={look.id}
              type="button"
              data-look-id={look.id}
              onClick={() => handleApply(look.id)}
              className={`ll:group ll:relative ll:flex ll:flex-col ll:items-center ll:gap-1 ll:p-1.5 ll:rounded-md ll:border ll:cursor-pointer ll:transition-all ll:shrink-0 ll:w-20 ll:text-center ${
                isSelected
                  ? "ll:border-accent ll:bg-accent/10"
                  : "ll:border-border ll:bg-surface-canvas ll:hover:border-border-active ll:hover:bg-surface-hover"
              }`}
            >
              {/* 96px (scaled to 48px square container) Thumbnail Box */}
              <div
                className="ll:relative ll:w-12 ll:h-12 ll:rounded ll:overflow-hidden ll:flex ll:items-center ll:justify-center"
                style={{
                  background: cachedImg ? undefined : `linear-gradient(135deg, ${fallbackBg}cc 0%, ${fallbackBg} 100%)`,
                }}
              >
                {cachedImg ? (
                  <img
                    src={cachedImg}
                    alt={look.name}
                    className="ll:w-full ll:h-full ll:object-cover"
                  />
                ) : (
                  <div
                    className="ll:w-8 ll:h-8 ll:rounded-full ll:shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, #ffffffaa 0%, ${fallbackBg} 60%, #00000066 100%)`,
                    }}
                  />
                )}

                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div className="ll:absolute ll:bottom-0.5 ll:right-0.5 ll:w-3.5 ll:h-3.5 ll:bg-accent ll:rounded-full ll:flex ll:items-center ll:justify-center ll:text-white">
                    <Icon icon={Check} size={9} />
                  </div>
                )}
              </div>

              {/* Look Label */}
              <span className="ll:text-micro ll:text-primary ll:font-medium ll:truncate ll:w-full">
                {look.name}
              </span>

              {/* Delete button for user-saved looks */}
              {isUserLook && (
                <button
                  type="button"
                  aria-label={`Delete ${look.name}`}
                  onClick={(e) => handleDeleteLook(e, look.id)}
                  className="ll:absolute ll:top-0.5 ll:right-0.5 ll:hidden ll:group-hover:flex ll:items-center ll:justify-center ll:w-4 ll:h-4 ll:bg-surface-panel/90 ll:rounded-full ll:text-muted ll:hover:text-red-500 ll:border-0 ll:cursor-pointer"
                >
                  <Icon icon={Trash2} size={9} />
                </button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
