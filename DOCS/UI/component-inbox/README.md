# Component inbox

Drop components you want here. A worker converts each one to our rules, puts it in `src/editor/components/`, adds it to the design system page and logs it in `COMPONENT_SOURCES.md`.

**Language:** React with TypeScript, in a `.tsx` file. Tailwind classes are fine, because we convert them to the `ll:` prefix and our tokens. Plain React with CSS or CSS modules is also fine. Vue, Svelte and Angular code is not.

**One file per component:** `component-inbox/<name>.tsx`. Paste the code as it is, without cleaning it up.

**Put this comment at the top of each file:**

```tsx
// Name:      (e.g. Command menu)
// Source:    (page URL, e.g. https://21st.dev/...)
// License:   (e.g. MIT, from the repo or the page. If unsure, write "unknown")
// Use for:   (where in Lazy Layout, e.g. the layer tree, the top bar)
// Keep:      (what you like about it, e.g. the hover motion, the layout)
```

If a component needs an npm package we don't have, the worker rewrites it without the package. Components with no clear license, paid code and anything copied from a live site's own source are skipped.
