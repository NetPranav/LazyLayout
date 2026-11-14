import type { MotionDocument } from "../../../document/schema";

/** A copy of a document with properties set on one layer (a fixture helper; not a document edit). */
export function setLayerPropsForTest(doc: MotionDocument, layerId: string, props: Record<string, unknown>): MotionDocument {
  return { ...doc, layers: { ...doc.layers, [layerId]: { ...doc.layers[layerId], properties: { ...doc.layers[layerId].properties, ...props } } } } as MotionDocument;
}
