import type { Vec3Tuple } from "./viewportAndHierarchy";

export type { QuatTuple, Vec3Tuple } from "./viewportAndHierarchy";
export { addVec3, lengthVec3, normalizeVec3, scaleVec3, slerpQuat, subVec3 } from "./viewportAndHierarchy";

export function distanceVec3Safe(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
