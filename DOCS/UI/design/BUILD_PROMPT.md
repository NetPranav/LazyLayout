# Build session prompt (Sonnet), 2026-11-07

Paste this into the build session. It was written by the design session after an analysis of `ui/redesign`.

```text
You are the BUILD SESSION (Sonnet) for Lazy Layout. Branch: ui/redesign ONLY (our main working branch; ignore integrate/main-into-new-ui completely). Never push unless the user says so, never touch main, never force-push, no Co-Authored-By lines.

GOAL
Bind the rebuilt UI in src/editor to the real engine and make it match the HTML prototype EXACTLY: DOCS/UI/design/editor-design-mode-blocks-dark.html (the spec: values, sizes, motion, states, all 8 themes). You orchestrate; Antigravity (agy) workers do the work, several lanes in parallel, without breaking anything that works today.

READ FIRST (in this order)
CLAUDE.md, DOCS/UI/UI_RULES.md, DOCS/UI/PARALLEL_BUILD.md (overrides BUILD_SESSION's one-at-a-time loop), DOCS/UI/BUILD_SESSION.md, DOCS/UI/handoffs/LATEST.md, DOCS/UI/PARITY.md, DOCS/UI/INTEGRATION.md, DOCS/UI/DECISIONS.md (never override "user | approved" rows), .claude/agents/ui-worker.md (17 known mistakes), ui-watcher.md, DOCS/UI/design/CHANGELOG.md (every "not built" row is your backlog; the 2026-11-07 rows list the user's decisions), DOCS/UI/design/HANDOFF.md, DOCS/UI/handoffs/e2e-testids.md.

STEP 0 – RECONCILE (you, no workers)
1. git switch ui/redesign; git status (the design session may have uncommitted files, e.g. DOCS/UI/design/home.html — never stage them).
2. Compare CHANGELOG "not built" rows with src/editor. Some older rows are stale (Code mode, Motion timeline, Trace logo, parts of Canvas editing are built). List the real gaps.
3. Write DOCS/UI/handoffs/<date>-binding-plan.md: prototype feature → src/editor file(s) → engine binding (store/command) → status. The prototype's new code is in named blocks, easy to find by id: ll-cursors (canvas cursor), ll-cpick (colour picker), ll-fpick (font picker), ll-more (inspector options popover, layers search, page selector), ll-spot (Spotlight), ll-frames (frame presets), ll-tbar (per-mode toolbars). Plus edits in the main script: Layers rows, multi-select Mixed values, inline text format bar, Canvas settings (#vpop), blank page, console filter, --syn-* and per-theme --lbl-* tokens, trace loader, list edge blur.
4. Record the 2026-11-07 user decisions from the CHANGELOG/HANDOFF in DECISIONS.md as "user | approved".

WAVE A – FOUNDATION (one lane, commit before Wave B)
L0b owns the shared files: styles/tokens.css, tailwind.css, animations.css, globals.css, components/index.ts.
- Add --syn-kw/str/num/fn/tag/attr/type/punc/com and the per-theme --lbl-1..6 + tints for all 8 themes (copy from the prototype theme blocks); Warm and Darkroom as the default themes.
- Add lane token blocks for every Wave B lane (/* === lane: Bx === */ … /* === end lane: Bx === */).
- Make src/editor/motion expose one shared spring preset table and feel (Smooth/Lively/Bouncy), like the prototype's window.LLMotion.

WAVE B – PARALLEL LANES (file paths never overlap; one task file per lane in DOCS/UI/tasks/)
B1 Pickers (new files in components/): ColorPicker, FontPicker (304px, no weight control), FramePresetsPanel, OptionsPopover (floats 8px from the inspector like the colour picker, morphs from its trigger). Demos in design-system/demos/B1Demos.tsx.
B2 Left panel (shell/left-panel/**, panels/layers/**): layer rows (fold with stagger, sliding --sel band, hover band, drag lift/part/drop, rename settle, eye/lock micro-motion, keyboard), quiet Layers search, page selector (menu-style rows, check only, route tooltip, row actions, New page). Bind to useDocumentStore/useLayers/useSelectionStore/useLayersUiStore/usePagesData.
B3 Inspector (panels/details/**, shell/right-panel/**): sliders icon button on the right of section headers that opens OptionsPopover with the section's extra fields; Mixed values and the single multi-layer header icon; hairline outlines on fields in floating surfaces; Canvas settings popover layout. Bind via src/core/inspector (proModel/proRead/simpleOps) and commands.
B4 Canvas (stage/**): canvas-only custom cursor (tail-free dart in --text2, blur crossfade between kinds, velocity lean, rotated resize/rotate cursors, hidden while a context menu is open; panels keep system cursors); inline text format bar; blank page renders nothing. Bind to useToolStore/useCameraStore/useSnapStore/selection.
B5 Canvas chrome (shell/canvas-chrome/**): lean per-mode toolbars — Design: Select, Hand, Frame, Shape ▾ (Pen inside), Text, Insert, AI; Motion: Select, Hand, Add keyframe, Split, Easing ▾; Code: Inspect, Hand, Run, Export ▾; carets right of the icon; morph between modes; lifts above the zoom bar when narrow. Frame tool opens FramePresetsPanel. Spotlight grows out of the toolbar (Ctrl+K and "/", sections, prefixes > @ #, edge blur, no scrollbar) and lists real registered commands via src/core/commands.
B6 Code mode (panels/code-view/**, panels/console/**): syntax colours via --syn-*, console filter widths, find bar (Ctrl+F), Run → console line; side and bottom panels meet on one hairline. Code stays generated by src/compiler.
B7 Motion (panels/timeline/**, motion-model/**, panels/inspectors/**): per-theme label colours, Auto-key and Onion skin toggles in the timeline footer, Easing popover for selected keys, Split. Bind to src/core/timeline (model/timelineCommands/timelineOps).
B8 Top bar (components/TopBar.tsx, LogoMark.tsx and their own files): Preview button left of Ship; trace loader draws and undraws the outline back and forth (fill hidden while saving, no opacity blink). Keep data-testid="save-status".
B9 Wiring (after B1–B8 commit): design-system/** (every new component with all states), components/index.ts exports, shell/EditorShell.tsx mounts.

ENGINE RULES
Bind only through existing stores/commands/compiler/runtime. Workers never edit src/core, src/compiler, src/runtime, src/ai, src/legacy-editor or config. Missing engine pieces (no Add keyframe command, no undo for page create/rename/delete, no collaborator presence) → "Engine changes requested" in INTEGRATION.md, a thin adapter in the lane, carry on. Ask the user before you touch src/core yourself.

LAUNCH (exact, one background Bash call per lane, all lanes of a wave in one message; mkdir -p DOCS/UI/handoffs/logs first)
agy --dangerously-skip-permissions --output-format text --print="Read .claude/agents/ui-worker.md, then do DOCS/UI/tasks/<task>.md. Edit only the paths in its Lane section. Don't stop to ask. Don't commit." > DOCS/UI/handoffs/logs/<lane>.log 2>&1
Fallback when agy quota runs out: ui-worker subagent, model sonnet, run_in_background. No edits for 10 minutes: stop and relaunch once. Forbid eslint --fix, prettier or any mass rewrite; after each lane check git status for mass line-ending changes.

TASK FILE (each lane)
Goal; "Read only these": prototype script block ids / line ranges / CSS selectors + the app files; behaviour with values copied from the prototype (sizes, spacing, radii, spring presets, timings, all 8 themes, reduced motion); rules (ll: prefix, tokens only, no arbitrary values, radii 4/6/8, no glass/pills, Icon component, no new deps, labsEnabled gate); Lane paths; Done = npx tsc --noEmit once (own files only), headless Playwright screenshots at 1440/1024/390 in Warm and Darkroom side by side with the prototype in the same state, a handoff from handoffs/TEMPLATE.md, no commit. In parallel waves workers don't edit PARITY/DECISIONS/INTEGRATION; they write it in the handoff and you merge.

REVIEW AND COMMIT
Run ui-watcher on each finished lane (diff vs UI_RULES, lane breach, visual parity with the prototype). PASS → git add <lane paths> only (never -A or .), commit feat(ui): …. FAIL → "Retry N" with numbered file:line fixes, relaunch only that lane; after 2 failed retries fix it yourself. Mark CHANGELOG rows "built" and update PARITY/INTEGRATION/DECISIONS in your own docs commit (a worker's or Claude's choice is never recorded as the user's).

DON'T BREAK
Test hooks in DOCS/UI/handoffs/e2e-testids.md (save-status, Application menu, File / Export project file, Motion tab, [aria-label="Motion Timeline"], Timeline header). Playwright: chromium-1248 executablePath and a throwaway config with webServer reuse (see PARALLEL_BUILD). At the end of each wave: npm run typecheck, npm run lint, NEXT_PUBLIC_ENABLE_LABS=1 npm run build, npm run test:e2e. The 4 known failing specs and 96 fixme must not get worse; a wave closes only when all four are at least as good as before.

STOP AND ASK THE USER ONLY FOR: a push, deleting anything outside a task, money or credentials, an engine/config change that blocks the work. Otherwise keep going wave after wave. At the end report: branch, what was built and bound, check results, screenshots vs prototype, engine changes requested, decisions for the user's review.
```
