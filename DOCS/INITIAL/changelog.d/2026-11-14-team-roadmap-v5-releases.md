### ROADMAP v5 (Releases): the order of work is a release plan, not the phase number

After an audit of the repository on 2026-11-14 (`ROADMAP.md` §1), the roadmap's order, committed scope and rules were rewritten. No phase changed what it builds; every phase keeps its number and its entry.

#### Changed
- **`ROADMAP.md` §0–§4 rewritten.** §0 states the goal and how to use the roadmap; §1 is the audit; §2 is the release plan; §3 keeps Laws 1–17, 19 and 20, rewrites Law 18 (Release order) and adds Laws 21–25 (one release at a time; fixed scope, one in and one out; green `main`; a person at every gate; reviewable size); §4 adds "reachable in the new editor" to the Definition of Done.
- **Five committed releases:** R0 Solid ground (19 open phases, no new features), R1 The motion studio, case 1 (28), R2 Public beta (14), R3 The foil button, case 2 (63), R4 The watch page (4). The other 274 open phases are sorted into 11 Later themes and are not started.
- **Needs that were a chain are now real dependencies:** Phases 93, 94, 95, 101, 241 and 259, and the watch page gate D21 (it no longer needs corner pin and tracking, D16 and D17). Phases 93, 95, 96, 101, 261, 265 and 266 carry a "v5" line that scopes them to their release.
- **`ROADMAP_3D.md`:** its order between tracks is now the release plan; the rule "do not wait for CI" (2026-11-12) is withdrawn.
- **`DOCS/TEAM/COLLABORATION.md`:** both lanes work in the active release; a PR holds one work package at most.

#### Added
- `scripts/check-release-plan.mts` and `npm run check:release-plan`, run in CI: every open phase is in exactly one work package, no phase in a release needs a phase in a later release or in Later, and deferred phases are in Later. It prints the progress of each release and names the active one.

#### Fixed
- `scripts/check-design-track.mts` passes on a Windows checkout (CRLF line endings).

#### Not done
- The time budgets in §2 are proposed; the owner confirms each when its release opens.
- The index still shows D3 – D18 as 📋 although they are built with named gaps; their status lines are updated by the PRs that land them.
