/**
 * MDM v6 → v7 (ROADMAP_3D Phase 3D-007): 3D data blocks and schema v7.
 *
 * v7 adds optional top-level 3D tables: scenes, objects, meshes, materials,
 * lights, cameras, armatures, actions, worlds, images3d, and the scene3d layer
 * archetype. Every v6 value is still valid, so no data is rewritten: this only
 * moves `schemaVersion` to 7 and leaves the 3D tables absent (or empty). Idempotent.
 */

import type { MigrationReportEntry } from "./v2-to-v3";
import type { MotionDocument } from "../schema";

type Loose = Record<string, unknown>;

export function migrateV6ToV7(input: Loose): { document: MotionDocument; report: MigrationReportEntry[] } {
  const doc = structuredClone(input) as Loose;
  doc.schemaVersion = 7;
  return { document: doc as unknown as MotionDocument, report: [] };
}
