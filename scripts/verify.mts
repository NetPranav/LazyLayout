/**
 * `npm run verify`: the checks every push must pass, run one after another, every one of them, even when an earlier
 * one fails (a lint error once hid seven failing unit tests). Prints one line per check and exits non-zero if any
 * failed. Used by the pre-push hook (.githooks/pre-push) and runnable by hand.
 *
 * While GitHub Actions can't run (account billing), this is the gate. `--e2e` adds the canvas contract browser suite.
 */
import { spawnSync } from "node:child_process";

const steps: { name: string; cmd: string; args: string[] }[] = [
  { name: "types", cmd: "npx", args: ["tsc", "--noEmit", "-p", "."] },
  { name: "lint", cmd: "npm", args: ["run", "-s", "lint", "--", "src", "tests"] },
  { name: "unit tests", cmd: "npm", args: ["run", "-s", "test:unit"] },
];
if (process.argv.includes("--e2e")) steps.push({ name: "canvas contract (browser)", cmd: "npm", args: ["run", "-s", "test:canvas-contract"] });

const results: { name: string; ok: boolean; seconds: number }[] = [];
for (const step of steps) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${step.name}\n`);
  const run = spawnSync(step.cmd, step.args, { stdio: "inherit", shell: process.platform === "win32" });
  results.push({ name: step.name, ok: run.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

process.stdout.write("\nverify:\n");
for (const r of results) process.stdout.write(`  ${r.ok ? "✔" : "✖"} ${r.name} (${r.seconds}s)\n`);
const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  process.stdout.write(`\n${failed.length} check(s) failed: ${failed.map((r) => r.name).join(", ")}. Fix them before pushing (or push with --no-verify if you must, and say so in the PR).\n`);
  process.exit(1);
}
