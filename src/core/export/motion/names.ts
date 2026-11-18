/** Identifier helpers for the generators (moved from `MultiEngineAnimationRuntime`, Phase 94). */

export function toPascalCase(id: string): string {
  return id
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export function toCamelCase(id: string): string {
  const pascal = toPascalCase(id);
  if (!pascal) return "";
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
