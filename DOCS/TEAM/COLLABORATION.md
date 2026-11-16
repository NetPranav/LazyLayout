# Working Together: Two Lanes, One Repo

**Applies to:** every person and every AI assistant (Claude or otherwise) working in this repo.
**Since:** 2026-10-18. Two people now work at the same time, each with their own Claude.
**Source of truth for the work itself:** `DOCS/INITIAL/ROADMAP.md` (v5). This file only says *who* does *which* phase and *how* to avoid stepping on each other.

> **For Claude:** read this whole file before doing anything. Then find out which lane you are in (§1). If `CLAUDE.local.md` doesn't say, **ask the person before writing code.** Never guess the lane.

---

## 0. Where do I push? (the short version)

```
main                      ← nobody pushes here. It only changes when a PR is merged.
a/phase-NN-short-name     ← NetPranav's work   (e.g. a/phase-13-command-bus)
b/phase-NN-short-name     ← OVERxPOWERED's work (e.g. b/phase-53-schema-gaps)
```

Every day:
1. `git switch main && git pull` to get the other person's merged work.
2. Start or continue your phase branch: `git switch -c b/phase-53-schema-gaps` (new), or `git switch b/phase-53-schema-gaps && git rebase main` (existing).
3. Work, commit, then `git push origin b/phase-53-schema-gaps`.
4. Open a PR into `main` on GitHub (`gh pr create --base main`). When CI is green, squash-merge it. GitHub deletes the branch after the merge.
5. Next phase, or still working tomorrow? Back to step 1.

Those are the only kinds of branches. Anything else on GitHub is old and can be deleted.

## 1. The lanes

| | **Lane A** | **Lane B** | **Lane C** | **Lane D** | **Lane E** | **Lane F** | **Lane G** |
|---|---|---|---|---|---|---|---|
| Who | NetPranav (`@NetPranav`) | `@OVERxPOWERED` | Project owner (admin) | Stage 4 worker (opened 2026-11-15 by project owner) | Stage 5 worker (opened 2026-11-15 by project owner) | Stage 6 worker (opened 2026-11-16 by project owner) | Stage 7 worker (opened 2026-11-15 by project owner) |
| Phases | **13–52** + Design track (**D1–D24**): Stage 1 viewport & Design track | **53–102**: Stage 2 animation engine | **103–131**: Stage 3 Design depth | **132–202**: Stage 4 Interactive & complex animation | **203–217**: Stage 5 Characters & rigging | **218–240**: Stage 6 3D | **241–250**: Stage 7 AI & agents |
| Branch names | `a/phase-NN-short-name` | `b/phase-NN-short-name` | `c/phase-NN-short-name` | `d/phase-NN-short-name` | `e/stage-5-complete` | `f/stage-6-complete` | `g/phase-NN-short-name` |
| Starts at | Phase 13 (in progress) | Phase 53 | Phase 103 (active in #107) | Phase 132 (active) | Phase 203 (active) | Phase 218 (active) | Phase 241 (active) |

- **Since ROADMAP v5 (2026-11-14) the order of work is the release plan (ROADMAP §2), not the phase number.** Both lanes work in the active release only (Law 21). When a release opens, the two lanes split its work packages between them and say so in the PR that opens it. The bullets below say whose area a phase is in; they no longer say when it is built.
- **Lane C (since 2026-11-14, by the owner):** Stage 3, Design depth (Phases 103–131), with branch prefix `c/`. It needs only Stage 1, so it waits on neither lane. It replaces the earlier proposal that Stage 3 be Lane A's.
- **Lane D (since 2026-11-15, by the project owner):** Stage 4, Interactive & complex animation (Phases 132–202), with branch prefix `d/`. Works step by step from 132 to 202 with batched verification every 10th phase (141, 151, 161, 171, 181, 191, 202).
- **Lane E (since 2026-11-15, by the project owner):** Stage 5, Characters & rigging (Phases 203–217), with branch prefix `e/`. Builds Phases 203–217 sequentially on `e/stage-5-complete` and opens one consolidated PR when verified.
- **Lane F (since 2026-11-16, by the project owner):** Stage 6, 3D (Phases 218–240), with branch prefix `f/`. Builds Phases 218–240 sequentially on `f/stage-6-complete`, verifies CI + Playwright E2E locally, and opens one consolidated PR.
- **Lane G (since 2026-11-15, by the project owner):** Stage 7, AI & agents (Phases 241–250), with branch prefix `g/`. Builds Phase 241 first (starting LLM integration via server-side `@anthropic-ai/sdk` while external agent runtimes such as Codex and Antigravity connect over MCP via Phases 50 & 250).
- **Inside a lane, the phase number was the order until v5** (the old Law 18). Take the lowest phase in your lane that isn't ✅.
- A phase may start only when **every phase in its "Needs" line is ✅ on `main`**. This is ROADMAP §0 rule 7, and it's the only thing that links the two lanes. §2 lists every place where it matters.
- **Stage 3, Design depth (Phases 103–131, added in ROADMAP v4.1 on 2026-10-21), is proposed for Lane A** after Phase 52, with branch prefix `a/`. Every phase in it needs only Stage 1, so it never waits on Lane B. It becomes Lane A's once Lane B agrees, in the v4.1 PR or in a message.
- **Since 2026-11-13 Lane A works the Design master track (D1–D21 in ROADMAP.md)**, pulled forward by the project owner. It takes over Phases 110 (repeat), 141, 144, 152, 154, 157 and 188–190, and wires the UI for Lane B's merged engine work (73, 76, 77). **On 2026-11-14 the project owner (admin) took over D11 to D20 for Lane A**, including the items that were Lane B's: **D11** (Phases 81, 82), **D12** (83, 84), **D15** (78) and Phase 99 (video layers, needed by tracking). Lane A builds them without waiting for agreement from Lane B. Lane B's work already on `main` is built on, not replaced; the hot-spot rules (§3, §4) and the Definition of Done still apply.
- **Lane D coordinates with Lane A's Design track (D4, D6, D7, D9, D10, D13, D14, D18)** already landed on `main` / PR #106, building directly on `src/core/bindings/*`, `src/core/text/splitText.ts`, `src/core/render/sequence.ts`, and `src/core/export/runtime/smoothScroll.ts` rather than replacing them.
- Laws 1–25 and the Definition of Done (ROADMAP §3, §4) apply to both lanes. Nothing in this file relaxes them.

## 2. Where Lane B waits on Lane A

Taken from the "Needs" lines in ROADMAP §5. Lane B can do 53–56 straight away.

| Lane B phase | Needs from Lane A | What Lane B actually uses |
|---|---|---|
| 57 Engine adapters & the kernel on the stage | **19** | `LayerNodeRegistry` + the measurement API |
| 61 Timeline workspace: layout | **15** | Workspace presets, the Animate layout |
| 69 Motion paths on the canvas | 40 | Vector paths and their editing |
| 78 States | 33 | Design inspector, Simple face |
| 80 Animated variants | 47 | Variants & component properties |
| 82 Scroll simulator & sections | 48 | Sections & pages |
| 83 Accessible text splitting | 31, 38 | Text on the canvas, fonts |
| 88 Motion per breakpoint | 43 | Breakpoints & overrides |
| 94 Motion export architecture | 49 | Static export v1 |
| 99 Video & audio layers | 36 | Asset store |

**Interfaces first, so Lane B isn't stuck:** when Lane A starts a phase in this table (19 and 15 first), Lane A merges the types and interfaces first, with a stub that throws "not implemented". Lane B may then write code and tests against that interface. Lane B's phase is still not ✅ until the real Lane A phase is ✅ (Definition of Done).

If Lane B is blocked anyway, pull work forward inside Lane B whose Needs are already met, or agree with Lane A to build the missing piece yourself.

## 3. No folder limits

Both people may change **any file** in the repo. The lanes split the *phases*, not the folders. If your phase needs a change in code the other person usually works on, make it.

To keep that cheap, a few files are **shared hot spots**. Changing them is fine; just say so in your PR and in your message to the other person (§9):
- `src/core/document/`: the MDM schema, `migrations/`, property paths
- `src/core/commands/`: the command registry and its types
- `src/core/store/`: every store
- `src/core/rules/`: the rule table
- `src/editor/shell/EditorShell.tsx`
- `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `.github/`, `scripts/`
- ROADMAP §0–§4 (rules, laws, Definition of Done), and this file

## 4. Shared hot spots

1. **Prefer adding to renaming.** If you rename or delete something the other lane uses, also update their callers in the same PR so `main` still builds.
2. **Schema rule:** before bumping the MDM schema version or adding a migration, claim the next number in `DOCS/TEAM/CLAIMS.md`. Two people creating "v6" on the same day is the one conflict that's painful to undo.
3. Mention any hot-spot change in the PR description, so the daily merge (§5) knows to look at it.

## 5. Day-to-day git: merge every day

- **`main` only changes through pull requests with green CI.** That applies to both people, admins included. No force-pushes to `main`.
- One branch per phase **or per batch of phases**, named as in §1 (a batch uses the first and last phase: `b/phase-53-58-schema-and-engine`). A phase may land as several PRs (e.g. `a/phase-18-stage-host-1`, `-2`).
- **Batching is allowed.** One Claude run may build 5–10 phases in order on one branch and land them as one PR (or a few). Phases still go in order (Law 18), each phase keeps its own commit(s), changelog fragment and ROADMAP rows, and a phase is ✅ only when its gate passes in CI. Don't make a PR per phase just to satisfy a rule: there isn't one. **v5:** a PR holds one work package of the release plan at most (Law 25), and merges only on green CI (Law 23).
- **You merge your own PR.** GitHub only needs the PR and green `verify` + `e2e` checks (no reviewer approval is required). When CI is green, the PR's author squash-merges it (or tells their Claude to). Nobody needs the other person's approval.
- **Merge into `main` every day.** At the end of each working day, each person opens or updates a PR with whatever is done and green, and merges it. Smaller, daily merges mean conflicts stay small. Unfinished work can merge if it's hidden or harmless; the phase just stays 🚧.
- **Start every session from the latest `main`:**
  `git fetch origin && git rebase origin/main`
  (That is the only way the other lane's work reaches you: through `main`. Never merge or cherry-pick the other person's branch into yours.)
- If something goes wrong after a merge (a conflict, a broken feature, the other person's work changed under you), **fix it forward** in the next PR. Talk it through with the other person if the fix touches their phase.
- Merge style: **squash merge**, with a conventional-commit PR title: `feat(canvas): Phase 25 creation tools`.
- Never rewrite a branch the other person has pulled.

## 6. Docs without conflicts

The three most-edited files (ROADMAP, CHANGELOG, AUDIT) used to conflict on every parallel phase. Here's how each one is handled now:

| File | Rule |
|---|---|
| `CHANGELOG.md` | **Don't edit it in a phase PR.** Add a new file to `DOCS/INITIAL/changelog.d/` instead (see its README). Fragments are folded into `CHANGELOG.md` by `npm run changelog:fold` in a separate PR. |
| `ROADMAP.md` | Update the index rows and entries for the phase you're working on, in the same PR as the phase. Changes to §0–§4 are a shared hot spot (§3). |
| `AUDIT.md` | Edit only the AUD rows your phase closes. To add a **new** AUD ID, claim the number in `CLAIMS.md`. |
| `decisions/` | Claim the next record number in `CLAIMS.md` first (the next free number is 0008). |

## 7. Pull request checklist

The PR template (`.github/pull_request_template.md`) asks for this. In short:
- Lane, phase and branch name are right, and every "Needs" phase is ✅ on `main`.
- Shared hot spots touched (§3)? Say which, in the description.
- `npm test`, `npm run lint`, `npm run build` and the Playwright suite pass. CI checks this again.
- There's a changelog fragment, the roadmap rows for your phase are updated, and AUDIT rows are updated if the phase closes any.
- The phase's "You'll see" line is true in the running editor.

## 8. Rules for Claude specifically

1. Know your lane (§1). Work on phases of the active release (ROADMAP §2) that are in your lane; never start a phase of a later release (Law 21). You may edit any file a phase needs (§3).
   **The project owner (the admin) decides who builds what.** When the owner moves a phase to a lane, or says to take it over, that is the decision: do not ask the other lane for permission or agreement, record the move here and in `ROADMAP.md`, and say so in the PR description and in the discussions panel so the other person knows. Everything else in this file (branches, PRs, hot spots, Definition of Done) still applies.
2. Before starting a phase: `git fetch origin`, rebase on `origin/main`, check that every phase in its "Needs" line is ✅ on `origin/main`, and check `CLAIMS.md`.
3. If you change a shared hot spot (§3), say so in the PR description and in your end-of-session summary.
4. Never push to `main`. Merge a PR only when the person asks, and only a PR from their own lane (never the other lane's, unless they say so by name). Never use `--force` on a shared branch. Never pass `--admin` to bypass branch protection.
5. Never edit `CHANGELOG.md` directly; write a fragment. Never mark a phase ✅ before its gate passes in CI.
6. Don't add `Co-Authored-By: Claude` trailers to commits or PRs in this repo.
7. At the end of a session, remind the person about the daily merge (§5) and summarise: the branch, what's done, what's next, and any hot-spot change the other lane should know about.

## 9. Talking to each other

Git can't catch everything, so message the other person when:
- you change a shared hot spot (§3), especially the schema or the command registry;
- you finish a phase that's in the §2 table;
- a daily merge broke something and you're fixing it forward.


## 10. The canvas contract (both lanes)

Both lanes draw on the same canvas: Lane A's frames, handles and device views, Lane B's anchor points, onion skin, motion paths and value HUD. One overlay that takes the pointer in the wrong place breaks clicking for everyone (the anchor handle did, on 2026-11-07). So anything that draws on the canvas keeps these rules:

1. **Clicking a layer selects it, and dragging it moves it.** An overlay may not take the pointer from the middle of a layer in the Design workspace. A handle that must sit there (an anchor point) is a marker, dragged only with a modifier (Ctrl, Cmd on a Mac) and only once the press that selected the layer is over. In Motion, dragging the middle of a layer records keys, so it belongs to the layer there too.
2. **Shift-click adds and removes, Alt-drag copies, Backspace/Delete deletes, the arrange shortcuts arrange**, with the pointer anywhere over the canvas.
3. **Where edits go is never hidden.** The edit target is derived from the selection (a layer picked in a mirror edits that mirror's breakpoint; anything else edits the breakpoint being viewed). No gesture sets the breakpoint as a side effect. A frame edited at a breakpoint shows "Editing <name>".
4. **Editor-only things never ship.** A design-time layer (helper, mirror frame) is marked by `isEditorOnlyLayer` (`src/core/document/editorOnly.ts`); editor attributes are listed in `EDITOR_ONLY_ATTRIBUTES`. The exporter and every code emitter use those, and the export tests fail if one leaks.
5. **Core stays pure.** Code in `src/core/{editing,document,frames,geometry,paint,breakpoints,text,store}` does not read or build the page (lint enforces it). The editor measures and hands the result in.

Before merging a PR that changes anything drawn on or over the canvas, run `npm run test:canvas-contract` (the canvas, device-view and anchor suites, Chromium) and say in the PR that it passed. `npm run verify` (types, lint, unit tests: all of them, even when one fails) runs on every push through `.githooks/pre-push`; `npm install` turns the hook on.
