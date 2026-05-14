import type { FrameworkProfile, ParsedOperation } from "../types.js";
import { angularMajor } from "../detect/framework.js";
import { groupByTag } from "../openapi/operations.js";
import { pathParams, toMethodName, urlExpression } from "./naming.js";

function angularUsesInject(profile: FrameworkProfile): boolean {
  const major = angularMajor(profile);
  if (major === null) return true;
  return major >= 14;
}

function methodBlock(op: ParsedOperation, baseExpr: string): string {
  const urlExpr = urlExpression(baseExpr, op.path);
  const method = op.method;
  const headers = "headers: options?.headers";

  if (method === "get" || method === "delete" || method === "head" || method === "options") {
    return `const url = ${urlExpr};
    return this.http.${method}<unknown>(url, { ${headers} });`;
  }
  if (method === "post" || method === "put" || method === "patch") {
    return `const url = ${urlExpr};
    return this.http.${method}<unknown>(url, body, { ${headers} });`;
  }
  return `const url = ${urlExpr};
    return this.http.request<unknown>('${method.toUpperCase()}', url, { ${headers} });`;
}

function renderServiceClass(
  tag: string,
  operations: ParsedOperation[],
  profile: FrameworkProfile,
): string {
  const className = `${sanitizeClassName(tag)}ApiService`;
  const usesInject = angularUsesInject(profile);

  const ctorOrFields = usesInject
    ? `private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);`
    : `constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string,
  ) {}`;

  const coreImport = usesInject
    ? "import { inject, Injectable } from '@angular/core';"
    : "import { Inject, Injectable } from '@angular/core';";

  const methods = operations.map((op) => {
    const name = toMethodName(op.operationId);
    const params = pathParams(op.path);
    const needsBody =
      op.method === "post" || op.method === "put" || op.method === "patch";
    const sigParts = [
      ...params.map((p) => `${p}: string | number`),
      ...(needsBody ? ["body: unknown"] : []),
      "options?: { headers?: Record<string, string> }",
    ];
    const baseExpr = "this.baseUrl";

    return `
  /**
   * ${op.summary ?? op.operationId}
   * ${op.method.toUpperCase()} ${op.path}
   */
  ${name}(${sigParts.join(", ")}) {
    ${methodBlock(op, baseExpr)}
  }`;
  });

  return `${coreImport}
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api-base-url.token';

@Injectable({ providedIn: 'root' })
export class ${className} {
  ${ctorOrFields}
${methods.join("\n")}
}
`;
}

function sanitizeClassName(tag: string): string {
  return tag
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("") || "Default";
}

export function generateAngularArtifacts(
  profile: FrameworkProfile,
  operations: ParsedOperation[],
): Map<string, string> {
  const files = new Map<string, string>();
  const byTag = groupByTag(operations);

  const tokenFile = `import { InjectionToken } from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => {
    const w = typeof window !== 'undefined' ? (window as unknown as { __API_BASE_URL__?: string }) : undefined;
    return w?.__API_BASE_URL__ ?? '/api';
  },
});
`;

  files.set("api-base-url.token.ts", tokenFile);

  for (const [tag, ops] of byTag) {
    const name = sanitizeClassName(tag);
    files.set(`${name}ApiService.ts`, renderServiceClass(tag, ops, profile));
  }

  const major = profile.angular ?? "unknown";
  const inj = angularUsesInject(profile) ? "`inject()` (Angular 14+)" : "constructor injection + `@Inject` (Angular < 14)";

  files.set(
    "README-codegen.md",
    `# Generated Angular client

- Detected **@angular/core**: ${major}
- **HttpClient** with ${inj}
- Tune \`API_BASE_URL\` in \`api-base-url.token.ts\`.

`,
  );

  return files;
}
