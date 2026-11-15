# Changelog Fragment — Lane D · Phase 198

- Implemented `src/core/export/embedScriptAndVitals.ts`: framework-free `<div data-fx>` + `<script type="module">` embed snippet emitter (Webflow, Framer, Wix, WordPress, plain HTML) with per-family size budgets, `CLS === 0` aspect-ratio poster boxes, post-LCP idle hydration (`< 50 ms`), IntersectionObserver offscreen pause, and strict nonce-based CSP compatibility.
- Added full library-wide size & Web Vitals test sweep in `src/core/export/__tests__/embedScriptAndVitals.test.ts`.
