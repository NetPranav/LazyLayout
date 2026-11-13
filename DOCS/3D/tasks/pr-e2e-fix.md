Lane A · tests only.

Four browser tests were failing on `main` itself (they also fail on docs-only PRs), which blocks every PR through the "main: PR + green CI" ruleset.

- **Shape menu race (3 tests):** the tests clicked Shape while the tool was still handing back to Select after a draw; the hand-back closes the menu again, so the menu item never appeared. Shapes are now armed with their keyboard shortcuts in `pickShape` (falling back to the menu), and `rectangle()` uses it and waits for the hand-back.
- **"a project saved with the page size in the wrong unit":** the test edited the sample `headline` layer in the saved snapshot, but the new editor saves only the root there, so the edit threw inside an IndexedDB transaction and the test hung for a minute. The edit is now guarded.
- **Not touched:** `new-ui-cutout` "Depth" (flaky in CI, passed on retry).

Verified locally in Chromium against `main` (4 targeted tests plus the Arrange and Shift-click tests pass). Test files only: no product code changed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
