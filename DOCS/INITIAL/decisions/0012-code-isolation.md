# Decision 0012 — Code Isolation & Untrusted Component Sandboxing

- **Status:** Accepted (Phase 195)
- **Owner:** Lane D (Interactive & Complex Animation)
- **Context:** Phase 196 allows users to import third-party TSX/JSX and npm code components inside the LazyLayout editor and Playground. Running arbitrary third-party bundles inside the editor origin would expose auth tokens, IndexedDB projects, `localStorage`, and `document.cookie`.

## Decision
1. **Opaque-Origin Iframe (`allow-scripts` ONLY):** Every user-authored code component executes inside an `<iframe>` whose `sandbox` attribute contains **`allow-scripts` without `allow-same-origin`**, forcing an opaque `"null"` origin.
2. **Typed `MessageChannel` Bridge:** Editor host and sandbox iframe communicate exclusively over a transferred `MessagePort` validating a discriminated message union (`init`, `props_update`, `event_emit`, `render_metrics`, `security_violation`) — zero ambient globals or window-opener references.
3. **Strict CSP + Exfiltration Block:** The sandbox HTML document carries a strict CSP (`default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; connect-src 'none';`) and drops `allow-top-navigation`, `allow-forms`, and `allow-popups`.
4. **Consequences:** Malicious reads of `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`, or `parent.document` receive nothing or throw a DOM `SecurityError` in Chromium, Firefox, and WebKit.
