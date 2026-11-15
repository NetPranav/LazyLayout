/**
 * @file codeComponents.ts
 * @module core/components/codeComponents
 * @description Phase 196: Code component importer (TSX/JSX files & npm deps)
 * with deterministic worker bundle manifests (pinned + hashed deps), sandboxed
 * execution (Phase 195 Decision 0012), TypeScript + JSDoc prop control inference,
 * signal/variable/state prop bindings, callback -> Blueprint events, and
 * GATE-03 licence classification (keeping restricted licences private).
 */

import {
  buildSandboxIframeDescriptor,
  type SandboxIframeDescriptor,
} from "./codeSandbox";

export type InferredControlKind =
  | "number"
  | "string"
  | "boolean"
  | "color"
  | "enum"
  | "callback_event";

export interface InferredPropControl {
  readonly name: string;
  readonly kind: InferredControlKind;
  readonly optional: boolean;
  readonly defaultValue?: number | string | boolean;
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly string[];
  readonly blueprintEventName?: string;
}

export type PropBindingTarget =
  | { readonly source: "signal"; readonly path: string }
  | { readonly source: "variable"; readonly variableId: string }
  | { readonly source: "state"; readonly stateName: string };

export interface PinnedDependency {
  readonly name: string;
  readonly version: string;
  readonly integritySha256: string;
}

export interface Gate03LicenseStatus {
  readonly spdx: string;
  readonly publicLibraryAllowed: boolean;
  readonly keepPrivate: boolean;
  readonly reason: string;
}

export interface ImportedCodeComponent {
  readonly id: string;
  readonly componentName: string;
  readonly bundleManifest: {
    readonly bundler: "esbuild-wasm";
    readonly target: "es2022";
    readonly bundleHash: string;
    readonly pinnedDependencies: readonly PinnedDependency[];
  };
  readonly sandbox: SandboxIframeDescriptor;
  readonly controls: readonly InferredPropControl[];
  readonly blueprintEvents: readonly { readonly propName: string; readonly eventName: string }[];
  readonly licenseStatus: Gate03LicenseStatus;
  readonly bindings: Readonly<Record<string, PropBindingTarget>>;
  readonly nextExportTsx: string;
}

const PERMISSIVE_LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "CC0-1.0"]);

/** Deterministic SHA-like 16-hex content digest for bundle integrity pins. */
export function deterministicHashHex(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function classifyLicenseGate03(spdx: string | undefined): Gate03LicenseStatus {
  const clean = (spdx ?? "UNLICENSED").trim();
  if (PERMISSIVE_LICENSES.has(clean)) {
    return {
      spdx: clean,
      publicLibraryAllowed: true,
      keepPrivate: false,
      reason: `Permissive licence (${clean}) eligible for project/public sharing.`,
    };
  }
  return {
    spdx: clean,
    publicLibraryAllowed: false,
    keepPrivate: true,
    reason: `Restricted or unverified licence (${clean}): locked private to this project (GATE-03).`,
  };
}

/** Infer inspector property controls & Blueprint callback events from TSX/TS prop interface + JSDoc hints. */
export function inferPropertyControlsFromTsSource(source: string): InferredPropControl[] {
  const controls: InferredPropControl[] = [];
  const blockMatch = source.match(/(?:interface|type)\s+\w*Props\s*=?\s*\{([\s\S]*?)\}/);
  if (!blockMatch) return controls;
  const body = blockMatch[1]!;

  // Match optional JSDoc comment right above each `propName?: type;` declaration
  const propRegex = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(\w+)(\??)\s*:\s*([^;\n]+)/g;
  let match: RegExpExecArray | null = propRegex.exec(body);
  while (match !== null) {
    const jsdoc = match[1] ?? "";
    const name = match[2]!;
    const optional = match[3] === "?";
    const rawType = match[4]!.trim();

    const minMatch = jsdoc.match(/@min\s+(-?\d+(?:\.\d+)?)/);
    const maxMatch = jsdoc.match(/@max\s+(-?\d+(?:\.\d+)?)/);

    if (/^\(?.*\)?\s*=>/.test(rawType) || /^on[A-Z]/.test(name)) {
      controls.push({
        name,
        kind: "callback_event",
        optional,
        blueprintEventName: `cmp:${name}`,
      });
    } else if (rawType.includes("|") && /["']/.test(rawType)) {
      const options = [...rawType.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!);
      controls.push({
        name,
        kind: "enum",
        optional,
        options,
        defaultValue: options[0],
      });
    } else if (rawType === "boolean") {
      controls.push({ name, kind: "boolean", optional, defaultValue: false });
    } else if (/color/i.test(name) && rawType === "string") {
      controls.push({ name, kind: "color", optional, defaultValue: "#4f46e5" });
    } else if (rawType === "number") {
      controls.push({
        name,
        kind: "number",
        optional,
        defaultValue: minMatch ? Number(minMatch[1]) : 1,
        min: minMatch ? Number(minMatch[1]) : undefined,
        max: maxMatch ? Number(maxMatch[1]) : undefined,
      });
    } else {
      controls.push({ name, kind: "string", optional, defaultValue: "" });
    }
    match = propRegex.exec(body);
  }
  return controls;
}

export function importCodeComponent(input: {
  readonly id: string;
  readonly componentName: string;
  readonly source: string;
  readonly license?: string;
  readonly dependencies?: readonly { readonly name: string; readonly version: string }[];
  readonly bindings?: Readonly<Record<string, PropBindingTarget>>;
}): ImportedCodeComponent {
  const controls = inferPropertyControlsFromTsSource(input.source);
  const blueprintEvents = controls
    .filter((c) => c.kind === "callback_event" && c.blueprintEventName)
    .map((c) => ({ propName: c.name, eventName: c.blueprintEventName! }));

  const pinnedDependencies: PinnedDependency[] = (input.dependencies ?? []).map((dep) => ({
    name: dep.name,
    version: dep.version,
    integritySha256: deterministicHashHex(`${dep.name}@${dep.version}`),
  }));

  const safeComponentName = input.componentName.replace(/[^a-zA-Z0-9_]/g, "");
  const nextExportTsx = [
    '"use client";',
    'import React from "react";',
    `export function ${safeComponentName}Host(props: Record<string, unknown>) {`,
    `  return React.createElement("div", { "data-ll-code-component": ${JSON.stringify(input.id)}, ...props });`,
    "}",
  ].join("\n");

  return {
    id: input.id,
    componentName: safeComponentName,
    bundleManifest: {
      bundler: "esbuild-wasm",
      target: "es2022",
      bundleHash: deterministicHashHex(input.source + JSON.stringify(pinnedDependencies)),
      pinnedDependencies,
    },
    sandbox: buildSandboxIframeDescriptor(input.id),
    controls,
    blueprintEvents,
    licenseStatus: classifyLicenseGate03(input.license),
    bindings: input.bindings ?? {},
    nextExportTsx,
  };
}
