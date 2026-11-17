import type { MotionDocument } from "@/core/document/schema";

export interface LayerMentionCandidate {
  id: string;
  name: string;
  archetype: string;
  insertText: string;
}

export interface ResolvedPromptTargets {
  targetLayerIds: string[];
  matchedCandidates: LayerMentionCandidate[];
  hasExplicitMentions: boolean;
}

export interface ActiveMentionQuery {
  start: number;
  end: number;
  query: string;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Formats an element name for `@` insertion (quotes names with spaces cleanly). */
export function formatMentionToken(nameOrId: string): string {
  const trimmed = nameOrId.trim();
  return /\s/.test(trimmed) ? `@"${trimmed}"` : `@${trimmed}`;
}

/** Lists all addressable layers in the document for `@mention` autocomplete and resolution. */
export function getLayerMentionCandidates(doc: MotionDocument): LayerMentionCandidate[] {
  const layers = Object.values(doc.layers ?? {});
  return layers
    .map((layer) => ({
      id: layer.id,
      name: layer.name || layer.id,
      archetype: layer.archetype,
      insertText: formatMentionToken(layer.name || layer.id),
      isRoot: layer.parentId === null || Boolean(layer.page),
    }))
    .sort((a, b) => {
      if (a.isRoot !== b.isRoot) return a.isRoot ? 1 : -1;
      return a.name.localeCompare(b.name);
    })
    .map(({ id, name, archetype, insertText }) => ({ id, name, archetype, insertText }));
}

/**
 * Detects an active `@query` immediately before `cursorPos` for live autocomplete dropdowns.
 */
export function detectActiveMentionQuery(text: string, cursorPos: number): ActiveMentionQuery | null {
  const pos = Math.max(0, Math.min(cursorPos, text.length));
  const before = text.slice(0, pos);
  const match = /(?:^|[\s(])@(?:"([^"]*)|([A-Za-z0-9_.-]*))$/.exec(before);
  if (!match) return null;
  const rawQuery = (match[1] ?? match[2] ?? "").trim();
  const atIndex = before.lastIndexOf("@");
  if (atIndex < 0) return null;
  return {
    start: atIndex,
    end: pos,
    query: rawQuery,
  };
}

/** Filters mention candidates by typed query (substring + normalized match). */
export function filterMentionCandidates(
  candidates: readonly LayerMentionCandidate[],
  query: string,
  limit = 8,
): LayerMentionCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates.slice(0, limit);
  const normQ = normalizeToken(q);
  return candidates
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (normQ.length > 0 && normalizeToken(c.name).includes(normQ)),
    )
    .slice(0, limit);
}

/**
 * Resolves `@Name`, `@"Multi Word Name"`, `@snake_name`, and `@id` mentions in a prompt.
 * When explicit `@` mentions match layers, those matched layers take priority over current selection.
 */
export function resolvePromptMentions(
  prompt: string,
  doc: MotionDocument,
  selectedIds: readonly string[] = [],
): ResolvedPromptTargets {
  const candidates = getLayerMentionCandidates(doc);
  const matched: LayerMentionCandidate[] = [];
  const seenIds = new Set<string>();

  const pushMatch = (cand: LayerMentionCandidate | undefined) => {
    if (!cand || seenIds.has(cand.id)) return;
    seenIds.add(cand.id);
    matched.push(cand);
  };

  // Sort longest names first so multi-word unquoted `@Get started` matches before shorter prefixes.
  const byLongestName = [...candidates].sort((a, b) => b.name.length - a.name.length);

  // 1. Quoted mentions: @"Get started" or @'Hero Card'
  const quotedRegex = /@["']([^"']+)["']/g;
  let qm: RegExpExecArray | null;
  while ((qm = quotedRegex.exec(prompt)) !== null) {
    const raw = qm[1].trim();
    const normRaw = normalizeToken(raw);
    const hit =
      candidates.find((c) => c.id.toLowerCase() === raw.toLowerCase()) ??
      candidates.find((c) => c.name.toLowerCase() === raw.toLowerCase()) ??
      candidates.find((c) => normalizeToken(c.name) === normRaw);
    pushMatch(hit);
  }

  // 2. Unquoted mentions: `@Get started`, `@Get_started`, `@button`, `@Headline`
  const unquotedAtRegex = /(?:^|[\s(])@(?!["'])([^\s,;!?)]+(?:\s+[^\s,;!?)]+)*)/g;
  let um: RegExpExecArray | null;
  while ((um = unquotedAtRegex.exec(prompt)) !== null) {
    const tail = um[1];
    const tailLower = tail.toLowerCase();

    // Greedy exact-prefix match against full layer names (supports spaces even without quotes)
    const prefixNameHit = byLongestName.find((c) => {
      const nameLower = c.name.toLowerCase();
      if (!tailLower.startsWith(nameLower)) return false;
      const nextChar = tailLower.charAt(nameLower.length);
      return nextChar === "" || /[\s.,;:!?)]/.test(nextChar);
    });
    if (prefixNameHit) {
      pushMatch(prefixNameHit);
      continue;
    }

    // Single-token id / exact normalized name match
    const firstToken = tail.split(/[\s.,;:!?)]/)[0] ?? "";
    const normTok = normalizeToken(firstToken);
    if (!normTok) continue;
    const singleHit =
      candidates.find((c) => c.id.toLowerCase() === firstToken.toLowerCase()) ??
      candidates.find((c) => normalizeToken(c.name) === normTok);
    pushMatch(singleHit);
  }

  if (matched.length > 0) {
    return {
      targetLayerIds: matched.map((m) => m.id),
      matchedCandidates: matched,
      hasExplicitMentions: true,
    };
  }

  const validSelected = selectedIds
    .filter((id, idx, arr) => Boolean(doc.layers[id]) && arr.indexOf(id) === idx);
  return {
    targetLayerIds: validSelected,
    matchedCandidates: validSelected
      .map((id) => candidates.find((c) => c.id === id))
      .filter((c): c is LayerMentionCandidate => Boolean(c)),
    hasExplicitMentions: false,
  };
}

/**
 * Prepends `@Name` / `@"Name"` tokens for auto-tagged viewport selections unless
 * the prompt already explicitly mentions those layers.
 */
export function attachTaggedLayersToPrompt(
  prompt: string,
  taggedLayers: readonly { id: string; name: string }[],
): string {
  const trimmed = prompt.trim();
  if (!trimmed || taggedLayers.length === 0) return trimmed;
  const lower = trimmed.toLowerCase();
  const missingTokens: string[] = [];
  const seen = new Set<string>();

  for (const layer of taggedLayers) {
    const label = (layer.name || layer.id).trim();
    if (!label || seen.has(layer.id)) continue;
    seen.add(layer.id);
    const labelLower = label.toLowerCase();
    const idLower = layer.id.toLowerCase();
    const alreadyMentioned =
      lower.includes(`@"${labelLower}"`) ||
      lower.includes(`@'${labelLower}'`) ||
      lower.includes(`@${labelLower}`) ||
      lower.includes(`@${idLower}`);
    if (!alreadyMentioned) {
      missingTokens.push(formatMentionToken(label));
    }
  }

  return missingTokens.length > 0 ? `${missingTokens.join(" ")} ${trimmed}` : trimmed;
}
