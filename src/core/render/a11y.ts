/**
 * Accessibility attributes of a layer (Design track D12, Phase 83): what a layer is called and what it is, and whether it is left out
 * of what assistive technology reads. A text split into pieces uses these so a screen reader hears the text once: the group is named
 * with the whole text, and every piece is hidden.
 */
import type { ResolvedProps } from "./types";

export interface A11yAttrs {
  role?: string;
  "aria-label"?: string;
  "aria-hidden"?: true;
}

/** Roles that may be written (a stored value is checked on read: a document edited by hand cannot put anything else in the page). */
const ROLE = /^[a-z][a-z-]{1,30}$/;

export function a11yAttrs(resolved: ResolvedProps): A11yAttrs {
  const out: A11yAttrs = {};
  const label = resolved.str("a11y.label", "");
  const role = resolved.str("a11y.role", "");
  if (label !== "") out["aria-label"] = label.slice(0, 2000);
  if (role !== "" && ROLE.test(role)) out.role = role;
  if (resolved.bool("a11y.hidden", false)) out["aria-hidden"] = true;
  return out;
}
