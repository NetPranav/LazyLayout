/**
 * ============================================================================
 * APPLY LOOK (Phase 3D-023)
 * ============================================================================
 * Pure immutable function to apply a preset or user look to one or more targets.
 * Resolves sizing rules against object bounds or scene scale before updating
 * materials, lights, or modifiers.
 * ============================================================================
 */

import { createId } from "@/core/ids";
import type { Light3d, Material3d, Modifier3d, MotionDocument } from "@/core/document/schema";
import { BUILTIN_LOOKS } from "./builtins";
import { applySizingRules } from "./sizing";
import type { Look3d } from "./types";

/**
 * Applies a look to a set of target object IDs in the document.
 * Returns a new immutable MotionDocument with the changes applied.
 */
export function applyLook(
  doc: MotionDocument,
  targetIds: string[],
  lookId: string
): MotionDocument {
  const look: Look3d | undefined =
    doc.looks?.[lookId] ?? (BUILTIN_LOOKS[lookId] as Look3d | undefined);
  if (!look || targetIds.length === 0) return doc;

  const next: MotionDocument = {
    ...doc,
    objects: doc.objects ? { ...doc.objects } : {},
    materials: doc.materials ? { ...doc.materials } : {},
    lights: doc.lights ? { ...doc.lights } : {},
  };

  for (const targetId of targetIds) {
    const obj = next.objects?.[targetId];
    if (!obj) continue;

    const values = applySizingRules(look.values, look.sizing, next, targetId);

    switch (look.section) {
      case "material": {
        // Find or create material for the object
        let matId = obj.materialSlots?.[0] ?? obj.materials?.[0];
        let mat = matId ? next.materials?.[matId] : undefined;

        if (!matId || !mat) {
          matId = createId("mat");
          const newMat: Material3d = {
            id: matId,
            name: `${obj.name ?? "Object"} Material`,
            baseColor: "#ffffff",
            metallic: 0,
            roughness: 0.5,
            emissive: "#000000",
          };
          next.materials![matId] = newMat;
          mat = newMat;
          next.objects![targetId] = {
            ...obj,
            materialSlots: [matId],
          };
        } else {
          // Clone material
          const cloned: Material3d = { ...mat };
          next.materials![matId] = cloned;
          mat = cloned;
        }

        if (!mat) continue;

        // Apply material values
        if (typeof values.baseColor === "string") mat.baseColor = values.baseColor;
        if (typeof values.metallic === "number") mat.metallic = values.metallic;
        if (typeof values.roughness === "number") mat.roughness = values.roughness;
        if (typeof values.emissive === "string") mat.emissive = values.emissive;
        if (typeof values.emissiveIntensity === "number") mat.emissiveIntensity = values.emissiveIntensity;
        if (typeof values.opacity === "number") mat.opacity = values.opacity;
        if (typeof values.wireframe === "boolean") mat.wireframe = values.wireframe;
        if (typeof values.doubleSided === "boolean") mat.doubleSided = values.doubleSided;
        break;
      }

      case "light": {
        const lightId = obj.dataId;
        if (obj.type === "light" && lightId && next.lights?.[lightId]) {
          const light: Light3d = { ...next.lights[lightId] };
          next.lights[lightId] = light;

          if (typeof values.color === "string") light.color = values.color;
          if (typeof values.intensity === "number") light.intensity = values.intensity;
          if (typeof values.decay === "number") light.decay = values.decay;
          if (typeof values.distance === "number") light.distance = values.distance;
          if (typeof values.castShadow === "boolean") light.castShadow = values.castShadow;
          if (typeof values.spotAngle === "number") light.spotAngle = values.spotAngle;
          if (typeof values.spotBlend === "number") light.spotBlend = values.spotBlend;
        }
        break;
      }

      case "modifier": {
        const modType = typeof values.type === "string" ? values.type : "mirror";
        const modParams: Record<string, unknown> = { ...values };
        delete modParams.type;

        const newModifier: Modifier3d = {
          id: createId("mod"),
          name: look.name,
          type: modType,
          enabled: true,
          renderEnabled: true,
          params: modParams,
        };

        const existingModifiers = obj.modifiers ? [...obj.modifiers] : [];
        existingModifiers.push(newModifier);

        next.objects![targetId] = {
          ...obj,
          modifiers: existingModifiers,
        };
        break;
      }

      case "physics":
      case "animation":
      case "interaction":
        // Extensible stub for phase 3D-049/3D-115/3D-156 looks
        break;
    }
  }

  return next;
}
