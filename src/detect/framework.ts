import { existsSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";
import type { FrameworkKind, FrameworkProfile } from "../types.js";
import { mergeDeps, readPackageJson } from "./read-package-json.js";

function coerceRange(version: string | undefined): string | undefined {
  if (!version) return undefined;
  const cleaned = version.replace(/^[\^~]/, "");
  const coerced = semver.coerce(cleaned);
  return coerced?.version;
}

/**
 * Inspects the repo (package.json + a few sentinel files) to infer
 * Angular / React / Vue and semver ranges used for codegen style.
 */
export async function detectFramework(
  projectRoot: string,
  override?: FrameworkKind,
): Promise<FrameworkProfile> {
  const pkg = await readPackageJson(projectRoot);
  const deps = mergeDeps(pkg);

  const hasAngularCore = Boolean(deps["@angular/core"]);
  const hasReact = Boolean(deps["react"]);
  const hasVue = Boolean(deps["vue"]);

  const angular = coerceRange(deps["@angular/core"]);
  const react = coerceRange(deps["react"]);
  const vue = coerceRange(deps["vue"]);
  const tanstackQuery = coerceRange(deps["@tanstack/react-query"]);
  const tanstackVueQuery = coerceRange(deps["@tanstack/vue-query"]);

  let kind: FrameworkKind = "unknown";
  if (override && override !== "unknown") {
    kind = override;
  } else {
    const angularJson = existsSync(join(projectRoot, "angular.json"));
    const nuxt = existsSync(join(projectRoot, "nuxt.config.ts"))
      || existsSync(join(projectRoot, "nuxt.config.js"))
      || existsSync(join(projectRoot, "nuxt.config.mjs"));
    const vite = existsSync(join(projectRoot, "vite.config.ts"))
      || existsSync(join(projectRoot, "vite.config.js"))
      || existsSync(join(projectRoot, "vite.config.mts"));

    if (hasAngularCore || angularJson) kind = "angular";
    else if (nuxt && hasVue) kind = "vue";
    else if (hasVue && (vite || existsSync(join(projectRoot, "vue.config.js"))))
      kind = "vue";
    else if (hasReact) kind = "react";
    else if (hasVue) kind = "vue";
  }

  return {
    kind,
    angular,
    react,
    vue,
    tanstackQuery,
    tanstackVueQuery,
    hasAngularCore,
    hasReact,
    hasVue,
  };
}

export function angularMajor(profile: FrameworkProfile): number | null {
  if (!profile.angular) return null;
  return semver.major(profile.angular);
}

export function vueMajor(profile: FrameworkProfile): number | null {
  if (!profile.vue) return null;
  return semver.major(profile.vue);
}

export function reactMajor(profile: FrameworkProfile): number | null {
  if (!profile.react) return null;
  return semver.major(profile.react);
}

export function tanstackQueryMajor(profile: FrameworkProfile): number | null {
  if (!profile.tanstackQuery) return null;
  return semver.major(profile.tanstackQuery);
}

export function tanstackVueQueryMajor(profile: FrameworkProfile): number | null {
  if (!profile.tanstackVueQuery) return null;
  return semver.major(profile.tanstackVueQuery);
}
