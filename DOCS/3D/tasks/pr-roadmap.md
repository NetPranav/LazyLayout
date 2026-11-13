Lane A · docs and one check script. **Stacked on #95** (base `a/3d-021-030`); merge #95 first, then retarget this to `main`.

**Update 2026-11-13 (later the same day):**
- **Anime parked:** 3D-216 – 3D-226 are ⏸ as a to-do; 3D-227 (live animation mixing) stays active.
- **Design master track (D1–D21) added to ROADMAP.md**, pulled forward for Lane A like the Surfaces track. Six waves: make every control work (and test them all), Style code / drivers / parenting / follow / connect anything, repeater / cloner / effectors, scroll scenes / split text / scrubbed sequences / parallax, corner pin / tracking with parent to track / speed effects, 3D parts with explode and following labels; gate: the watch page. Lanes: **A** for 18 phases, **B** for D11 (81, 82), D12 (83, 84), D15 (78), plus Main 99 for tracking.
- Pointers: ROADMAP.md rows 110, 141, 144, 152, 154, 157, 188–190 say *→ Design track D…*; ROADMAP_3D 3D-044 – 047, 3D-197, 3D-204 – 206 say *→ ROADMAP.md D…*; ROADMAP_3D §0a has the track as order 0.
- `COLLABORATION.md` §1 (hot spot): one line saying Lane A works the track and which items stay Lane B's.
- New `npm run check:design-track`. All four checks pass (`check-roadmap-order`, `check-roadmap-3d`, `check-design-track`, `check-doc-links`).

Re-orders `DOCS/INITIAL/ROADMAP_3D.md` around the owner's four cases (2026-11-13): a static or reactive component, a fully 3D element lit by a page-wide pointer light, a photo with After Effects-style corner pin and tracking and text wrapped on a car, and an anime studio.

- **§0a (new):** the four cases, the owner's decisions (export smaller than Rive's runtime and only the code the recipe uses; AI in the browser plus a server option; production quality for the photo work; live multi-animation; touch on phones), and a proposed build order. **§0b:** the anime studio in one page, with its honest limits.
- **37 new phases, 3D-191 to 3D-227:** small export (zero-script, micro-renderer, size gates), page signals and pointer light, AI gateway, tracking, photo to surface, text wrap, the anime look, camera and shot tools, live animation mixing. Three milestones added: M1+, M5, M6.
- **64 phases deferred (⏸):** edit mode, modifier and material depth, rigging and physics depth, asset browser and imports, instancing, camera solve. Needs of active phases that pointed at them were rewired; nothing active needs a deferred phase.
- **Entries written** for the 39 active M3 and M4 phases that had none; the two gates (M2, M3) re-scoped.
- **Status of 3D-001 to 3D-030 checked against each Done-when:** 11 are ✅; the rest stay 🚧 with the missing part written in a *Status check* line (for example Firefox and WebKit not run, or a timing bound looser than the gate). `mark.py` had silently skipped 3D-011 onward earlier.
- **`npm run check:roadmap-3d` (new):** index and entries agree, every Need exists, nothing active needs a deferred phase, no cycles.
- **ROADMAP.md:** the pulled-in rows now say *→ ROADMAP_3D 3D-…* (Lane B's rows 76 to 79 left alone); a note on Stage 6; the phases this roadmap owes the 3D one are named (99, 76 to 79).
- **CLAIMS.md:** decision records 0022 to 0025 claimed (export tiers and IR, AI services, photo to surface, the anime pipeline).

**Shared hot spots:** `DOCS/INITIAL/ROADMAP.md` (title cells only), `DOCS/TEAM/CLAIMS.md`, `package.json` (one script line).
**For Lane B:** 3D-205 (tracking; needs Main 99 video layers), 3D-218 (time on twos), 3D-223 (shots) and 3D-227 (live animation mixing) are in their area. Please read §8 item 7 and say whether you build them or Lane A does.

Checks run: `check-roadmap-order` (277 phases pass), `check-roadmap-3d`, `check-doc-links`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
