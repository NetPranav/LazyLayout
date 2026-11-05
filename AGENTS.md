<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI work (`src/editor`)

Before changing `src/editor`, read `DOCS/UI/UI_RULES.md` and `DOCS/UI/WORKER_RULES.md`: Tailwind classes take the `ll:` prefix, colours come from tokens, components live in `src/editor/components/` and on `/design-system`. Those rules are about UI code only.
