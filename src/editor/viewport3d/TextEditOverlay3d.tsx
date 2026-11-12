"use client";

/**
 * ============================================================================
 * 3D IN-PLACE TEXT EDIT OVERLAY (Phase 3D-026, Task B3-W3-addtext)
 * ============================================================================
 * Floating input field anchored directly above the 3D text object on the canvas:
 *   - Automatically triggered upon creating text or via requestTextEdit3d(objectId).
 *   - Projects 3D position into 2D screen coordinates using camera VP matrix.
 *   - Typing updates the 3D Text3d data block and mesh geometry live via `3d.text.set`.
 *   - Enter or blur finishes editing.
 *   - Escape cancels and reverts to the original string.
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { create } from "zustand";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { getDocument } from "@/core/store/useDocumentStore";
import { runCommand } from "@/core/commands";
import {
  viewMatrix as calcViewMatrix,
  projectionMatrix as calcProjMatrix,
} from "@/core/3d/camera/viewCamera";
import { worldMatrix } from "@/core/3d/hierarchy";
import { multiply, type Mat4, type Vec3 } from "@/core/3d/math";

interface TextEditRequestState {
  objectId: string | null;
  seq: number;
}

export const useTextEditRequest3d = create<TextEditRequestState>(() => ({
  objectId: null,
  seq: 0,
}));

export const requestTextEdit3d = (objectId: string): void => {
  useTextEditRequest3d.setState((s) => ({ objectId, seq: s.seq + 1 }));
};

export const endTextEdit3d = (): void => {
  useTextEditRequest3d.setState(() => ({ objectId: null }));
};

export interface TextEditOverlay3dProps {
  width: number;
  height: number;
}

function projectToScreen(
  p: Vec3 | [number, number, number],
  vpMatrix: Mat4,
  width: number,
  height: number
): { x: number; y: number; visible: boolean } {
  const x = p[0];
  const y = p[1];
  const z = p[2];

  const clipX = vpMatrix[0] * x + vpMatrix[4] * y + vpMatrix[8] * z + vpMatrix[12];
  const clipY = vpMatrix[1] * x + vpMatrix[5] * y + vpMatrix[9] * z + vpMatrix[13];
  const clipW = vpMatrix[3] * x + vpMatrix[7] * y + vpMatrix[11] * z + vpMatrix[15];

  if (clipW <= 1e-4) {
    return { x: width / 2, y: height / 2, visible: false };
  }

  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;

  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1.0 - (ndcY * 0.5 + 0.5)) * height,
    visible: true,
  };
}

export const TextEditOverlay3d: React.FC<TextEditOverlay3dProps> = ({ width, height }) => {
  const editingObjectId = useTextEditRequest3d((s) => s.objectId);
  const camera = useViewportStore((s) => s.camera);

  const [textValue, setTextValue] = useState("");
  const originalTextRef = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute camera matrices
  const aspect = Math.max(0.001, width / Math.max(1, height));
  const vMat = useMemo(() => calcViewMatrix(camera), [camera]);
  const pMat = useMemo(() => calcProjMatrix(camera, aspect), [camera, aspect]);
  const vpMat = useMemo(() => multiply(pMat, vMat), [pMat, vMat]);

  // Read current text from document
  /* eslint-disable react-hooks/set-state-in-effect -- opening the editor loads the text's current words into the field */
  useEffect(() => {
    if (!editingObjectId) return;

    const doc = getDocument();
    const obj = doc.objects?.[editingObjectId];
    if (obj && obj.dataId && doc.texts?.[obj.dataId]) {
      const current = doc.texts[obj.dataId].text;
      setTextValue(current);
      originalTextRef.current = current;
    }

    // Auto-focus and select
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 30);
  }, [editingObjectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Compute screen coordinates for floating input
  const screenPos = useMemo(() => {
    if (!editingObjectId) return null;
    const doc = getDocument();
    const obj = doc.objects?.[editingObjectId];
    if (!obj) return null;

    const mat = worldMatrix(doc, editingObjectId);
    const objLocation: [number, number, number] = [mat[12], mat[13], mat[14]];
    return projectToScreen(objLocation, vpMat, width, height);
  }, [editingObjectId, vpMat, width, height]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setTextValue(val);
      if (editingObjectId) {
        runCommand("3d.text.set", {
          objectId: editingObjectId,
          text: val,
        });
      }
    },
    [editingObjectId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        endTextEdit3d();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (editingObjectId) {
          runCommand("3d.text.set", {
            objectId: editingObjectId,
            text: originalTextRef.current,
          });
        }
        endTextEdit3d();
      }
    },
    [editingObjectId]
  );

  const handleBlur = useCallback(() => {
    endTextEdit3d();
  }, []);

  if (!editingObjectId || !screenPos) return null;

  return (
    <div
      data-testid="text-edit-overlay-3d"
      className="ll:absolute ll:z-40 ll:pointer-events-auto"
      style={{
        left: screenPos.x,
        top: Math.max(16, screenPos.y - 36),
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="ll:flex ll:items-center ll:bg-surface-panel ll:border ll:border-border ll:rounded-md ll:shadow-md ll:px-2 ll:py-1 ll:font-sans">
        <input
          ref={inputRef}
          type="text"
          data-testid="text-3d-inplace-input"
          value={textValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="ll:bg-transparent ll:border-0 ll:text-body-sm ll:font-medium ll:text-primary ll:outline-none ll:min-w-28 ll:max-w-64"
        />
      </div>
    </div>
  );
};

export default TextEditOverlay3d;
