import type { FrameworkProfile, ParsedOperation } from "../types.js";
import { reactMajor } from "../detect/framework.js";
import { groupByTag } from "../openapi/operations.js";
import { pathParams, toMethodName, urlExpression } from "./naming.js";

function useTanStack(profile: FrameworkProfile): boolean {
  return Boolean(profile.tanstackQuery);
}

function supportsHooks(profile: FrameworkProfile): boolean {
  const m = reactMajor(profile);
  if (m === null) return true;
  return m >= 16;
}

function fnSignature(
  op: ParsedOperation,
  withBase = true,
): { params: string; args: string; hasBody: boolean } {
  const params = pathParams(op.path);
  const hasBody =
    op.method === "post" || op.method === "put" || op.method === "patch";
  const parts = [
    ...(withBase ? ["baseUrl: string"] : []),
    ...params.map((p) => `${p}: string | number`),
    ...(hasBody ? ["body: unknown"] : []),
    "options?: { headers?: Record<string, string> }",
  ];
  const argList = [
    ...(withBase ? ["baseUrl"] : []),
    ...params,
    ...(hasBody ? ["body"] : []),
    "options",
  ];
  return { params: parts.join(", "), args: argList.join(", "), hasBody };
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateReactArtifacts(
  profile: FrameworkProfile,
  operations: ParsedOperation[],
): Map<string, string> {
  const files = new Map<string, string>();
  const byTag = groupByTag(operations);
  const tanstack = useTanStack(profile);
  const hooks = supportsHooks(profile);

  for (const [tag, ops] of byTag) {
    const safe = tag.replace(/[^a-zA-Z0-9]+/g, "") || "Default";

    const functions = ops
      .map((op) => {
        const name = toMethodName(op.operationId);
        const { params } = fnSignature(op, true);
        return `export async function ${name}(${params}) {
  ${fetchImpl(op, "baseUrl")}
}`;
      })
      .join("\n\n");

    const reactQueryImport = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
`;

    let content = `/* eslint-disable */
/**
 * Generated API client — tag "${tag}".
 * Detected react: ${profile.react ?? "unknown"}.
 * ${tanstack ? "Includes @tanstack/react-query hooks." : "Fetch helpers only (add @tanstack/react-query for hooks)."}
 */
${tanstack ? "\n" + reactQueryImport : ""}`;

    if (!hooks) {
      content += functions;
      files.set(`${safe}Api.ts`, content);
      continue;
    }

    content += functions;

    if (tanstack) {
      for (const op of ops) {
        const name = toMethodName(op.operationId);
        const isQuery =
          op.method === "get" || op.method === "head" || op.method === "options";
        const pnames = pathParams(op.path);
        const varsType =
          pnames.length > 0
            ? `{ ${pnames.map((p) => `${p}: string | number`).join("; ")} }`
            : "void";

        if (isQuery) {
          const callArgs =
            pnames.length > 0
              ? `baseUrl, ${pnames.map((p) => `vars.${p}`).join(", ")}, {}`
              : "baseUrl, {}";
          content += `

export function use${capitalize(name)}Query(baseUrl: string${pnames.length ? `, vars: ${varsType}` : ""}) {
  return useQuery({
    queryKey: ['${tag}', '${name}'${pnames.length ? ", vars" : ""}],
    queryFn: () => ${name}(${callArgs}),
  });
}`;
        } else {
          const hasBody =
            op.method === "post" || op.method === "put" || op.method === "patch";
          const mutVarsInner = [
            ...pnames.map((p) => `${p}: string | number`),
            ...(hasBody ? ["body: unknown"] : []),
          ];
          const hasVars = mutVarsInner.length > 0;
          const mutVarsType = hasVars
            ? `{ ${mutVarsInner.join("; ")} }`
            : "Record<string, never>";
          const mutationFn = hasVars
            ? `(vars: ${mutVarsType}) => ${name}(${[
                "baseUrl",
                ...pnames.map((p) => `vars.${p}`),
                ...(hasBody ? ["vars.body"] : []),
                "{}",
              ].join(", ")})`
            : `() => ${name}(baseUrl, {})`;

          content += `

export function use${capitalize(name)}Mutation(baseUrl: string) {
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

import { useMemo } from 'react';

export function use${safe}Client(baseUrl: string) {
  return useMemo(
    () => ({
${ops
  .map((op) => {
    const n = toMethodName(op.operationId);
    const ps = pathParams(op.path);
    const hasBody =
      op.method === "post" || op.method === "put" || op.method === "patch";
    const inner = [...ps, ...(hasBody ? ["body"] : []), "options"].join(", ");
    return `      ${n}: (${inner}) => ${n}(baseUrl, ${inner}),`;
  })
  .join("\n")}
    }),
    [baseUrl],
  );
}
`;
    }

    files.set(`${safe}Api.ts`, content);
  }

  files.set(
    "README-codegen.md",
    `# Generated React client

- **react**: ${profile.react ?? "unknown"}
- **@tanstack/react-query**: ${profile.tanstackQuery ?? "not detected — install for generated hooks"}
- Uses **fetch**; extend for auth interceptors as needed.

`,
  );

  return files;
}
