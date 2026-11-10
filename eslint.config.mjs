import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A name that starts with an underscore is unused on purpose (a parameter an interface requires, a rest-sibling that is dropped).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  // Stale closures in editor/timeline code are a correctness risk (ROADMAP Phase 1.2).
  {
    files: ["src/editor/**/*.{ts,tsx}", "src/legacy-editor/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // One clock, one frame loop (ROADMAP Phase 55): only src/core/time/** may request animation frames; everything else registers a task with the frame scheduler.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/core/time/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "requestAnimationFrame", message: "Register a task with frameScheduler (src/core/time/scheduler.ts) instead." },
        { name: "cancelAnimationFrame", message: "Unregister the frameScheduler task instead." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "requestAnimationFrame", message: "Register a task with frameScheduler (src/core/time/scheduler.ts) instead." },
        { object: "window", property: "cancelAnimationFrame", message: "Unregister the frameScheduler task instead." },
      ],
    },
  },
  // The short allowlist: pointer-drag batching and a canvas loop that are not on the timeline's clock. The Sequencer left it in Phase 56.
  {
    files: [
      "src/legacy-editor/shell/DockSplitter.tsx",
      "src/legacy-editor/shell/DockCornerSplitter.tsx",
      "src/core/events/useTearOff.ts",
      "src/legacy-editor/canvas/WasmCableCanvas.tsx",
      "src/legacy-editor/panels/details/controls/KeyframeTimeline.tsx",
    ],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
  // Core logic stays pure (no reading or building the page), so it runs the same in the editor, in tests, in the
  // export and on a server. Whatever needs the drawn page lives in src/editor and is handed in (see
  // registerLetterMeasurer in src/core/editing/splitText.ts); user feedback goes through a store (showToast).
  // The animation-frame rule above is repeated: a later block replaces a rule of the same name for its files.
  {
    files: [
      "src/core/editing/**/*.{ts,tsx}",
      "src/core/document/**/*.{ts,tsx}",
      "src/core/frames/**/*.{ts,tsx}",
      "src/core/geometry/**/*.{ts,tsx}",
      "src/core/paint/**/*.{ts,tsx}",
      "src/core/breakpoints/**/*.{ts,tsx}",
      "src/core/text/**/*.{ts,tsx}",
      "src/core/store/**/*.{ts,tsx}",
    ],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "window", property: "requestAnimationFrame", message: "Register a task with frameScheduler (src/core/time/scheduler.ts) instead." },
        { object: "window", property: "cancelAnimationFrame", message: "Unregister the frameScheduler task instead." },
        { object: "document", property: "querySelector", message: "Core is pure: measure the page in src/editor and pass the result in." },
        { object: "document", property: "querySelectorAll", message: "Core is pure: measure the page in src/editor and pass the result in." },
        { object: "document", property: "getElementById", message: "Core is pure: measure the page in src/editor and pass the result in." },
        { object: "document", property: "createElement", message: "Core is pure: draw UI in src/editor (for a message, use showToast)." },
        { object: "document", property: "createTreeWalker", message: "Core is pure: measure the page in src/editor and pass the result in." },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "CallExpression[callee.property.name='getBoundingClientRect']", message: "Core is pure: measure the page in src/editor and pass the result in." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
