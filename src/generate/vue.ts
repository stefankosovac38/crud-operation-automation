import semver from "semver";
import type { FrameworkProfile, ParsedOperation } from "../types.js";
import { tanstackVueQueryMajor, vueMajor } from "../detect/framework.js";
import { groupByTag } from "../openapi/operations.js";
import { pathParams, toMethodName, urlExpression } from "./naming.js";

function useTanStackVue(profile: FrameworkProfile): boolean {
  return Boolean(profile.tanstackVueQuery);
}

function fetchImpl(op: ParsedOperation, baseVar: string): string {
  const method = op.method.toUpperCase();
  const hasBody =
    op.method === "post" || op.method === "put" || op.method === "patch";
  const urlExpr = urlExpression(baseVar, op.path);
  const init = hasBody
    ? `{ method: '${method}', headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) }, body: JSON.stringify(body) }`
    : `{ method: '${method}', headers: { ...(options?.headers ?? {}) } }`;
  return `const url = ${urlExpr};
  const res = await fetch(url, ${init});
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
  if (res.status === 204) return undefined as unknown;
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('application/json')) return res.json() as Promise<unknown>;
  return res.text() as Promise<unknown>;`;
}

export function generateVueArtifacts(
  profile: FrameworkProfile,
  operations: ParsedOperation[],
): Map<string, string> {
  const files = new Map<string, string>();
  const byTag = groupByTag(operations);
  const tanstack = useTanStackVue(profile);
  const vueM = vueMajor(profile);
  const tqMajor = tanstackVueQueryMajor(profile);

  for (const [tag, ops] of byTag) {
    const safe = tag.replace(/[^a-zA-Z0-9]+/g, "") || "Default";

    const fns = ops
      .map((op) => {
        const name = toMethodName(op.operationId);
        const params = pathParams(op.path);
        const hasBody =
          op.method === "post" || op.method === "put" || op.method === "patch";
        const sig = [
          "baseUrl: string",
          ...params.map((p) => `${p}: string | number`),
          ...(hasBody ? ["body: unknown"] : []),
          "options?: { headers?: Record<string, string> }",
        ].join(", ");
        return `export async function ${name}(${sig}) {
  ${fetchImpl(op, "baseUrl")}
}`;
      })
      .join("\n\n");

    const tanstackImports = `import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed, unref, type MaybeRefOrGetter } from 'vue';
`;

    const composableImports = `import { isRef, ref, type Ref } from 'vue';
`;

    let content = `/* eslint-disable */
/**
 * Generated API client — tag "${tag}".
 * Detected vue: ${profile.vue ?? "unknown"}.
 */
`;

    const coerced = profile.vue ? semver.coerce(profile.vue) : null;
    const vue27 =
      vueM === 2 && coerced && coerced.major === 2 && coerced.minor >= 7;

    if (vueM === 2 && !vue27 && !profile.tanstackVueQuery) {
      content += fns;
      content += `

/** Vue 2.x (<2.7): use these module-level async functions (no Composition API). */
`;
      files.set(`${safe}Api.ts`, content);
      continue;
    }

    if (tanstack) {
      content += tanstackImports + "\n";
    } else {
      content += composableImports + "\n";
    }

    content += fns;

    if (tanstack) {
      for (const op of ops) {
        const name = toMethodName(op.operationId);
        const isQuery =
          op.method === "get" || op.method === "head" || op.method === "options";
        const pnames = pathParams(op.path);
        const hasBody =
          op.method === "post" || op.method === "put" || op.method === "patch";

        if (isQuery) {
          const varsDecl =
            pnames.length > 0
              ? `vars: MaybeRefOrGetter<{ ${pnames.map((p) => `${p}: string | number`).join("; ")} }>`
              : "";
          const call =
            pnames.length > 0
              ? `${name}(unref(baseUrl), ${pnames.map((p) => `unref(vars).${p}`).join(", ")}, {})`
              : `${name}(unref(baseUrl), {})`;
          content += `

export function use${capitalize(name)}Query(baseUrl: MaybeRefOrGetter<string>${pnames.length ? `, ${varsDecl}` : ""}) {
  return useQuery({
    queryKey: computed(() => ['${tag}', '${name}', unref(baseUrl)${pnames.length ? ", unref(vars)" : ""}]),
    queryFn: () => ${call},
  });
}`;
        } else {
          const mutInner = [
            ...pnames.map((p) => `${p}: string | number`),
            ...(hasBody ? ["body: unknown"] : []),
          ];
          const hasVars = mutInner.length > 0;
          const mutVarsType = hasVars
            ? `{ ${mutInner.join("; ")} }`
            : "Record<string, never>";
          const mutationFn = hasVars
            ? `(vars: ${mutVarsType}) => ${name}(${[
                "unref(baseUrl)",
                ...pnames.map((p) => `vars.${p}`),
                ...(hasBody ? ["vars.body"] : []),
                "{}",
              ].join(", ")})`
            : `() => ${name}(unref(baseUrl), {})`;

          content += `

export function use${capitalize(name)}Mutation(baseUrl: MaybeRefOrGetter<string>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ${mutationFn},
    onSuccess: () => qc.invalidateQueries({ queryKey: ['${tag}'] }),
  });
}`;
        }
      }
    } else {
      content += `

export function use${safe}Api(baseUrl: string | Ref<string>) {
  const base = isRef(baseUrl) ? baseUrl : ref(baseUrl);
  return {
${ops
  .map((op) => {
    const n = toMethodName(op.operationId);
    const ps = pathParams(op.path);
    const hasBody =
      op.method === "post" || op.method === "put" || op.method === "patch";
    const inner = [...ps, ...(hasBody ? ["body"] : []), "options"].join(", ");
    return `    ${n}: (${inner}) => ${n}(base.value, ${inner}),`;
  })
  .join("\n")}
  } as const;
}
`;
    }

    files.set(`${safe}Api.ts`, content);
  }

  files.set(
    "README-codegen.md",
    `# Generated Vue client

- **vue**: ${profile.vue ?? "unknown"}
- **@tanstack/vue-query**: ${profile.tanstackVueQuery ?? "not detected — plain functions + optional use*Api composable"}
- TanStack Vue Query major (detected): **${tqMajor ?? "n/a"}**
- Uses **fetch**; wire auth headers via \`options.headers\`.

`,
  );

  return files;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
