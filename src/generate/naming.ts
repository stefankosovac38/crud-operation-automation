/** Valid TypeScript identifier for a method name */
export function toMethodName(operationId: string): string {
  const base = operationId.replace(/[^a-zA-Z0-9_]+/g, "_");
  if (/^[0-9]/.test(base)) return `_${base}`;
  return base;
}

export function pathParams(path: string): string[] {
  const params: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    params.push(m[1]);
  }
  return params;
}

/**
 * Build URL template expression: `${baseUrl}/items/${encodeURIComponent(String(id))}`
 * @param baseVar - e.g. `this.baseUrl` or `baseUrl`
 */
export function urlExpression(baseVar: string, path: string): string {
  const pathWithReplacements = path.replace(
    /\{([^}]+)\}/g,
    (_m, p: string) => `\${encodeURIComponent(String(${p}))}`,
  );
  return `\`\${${baseVar}}${pathWithReplacements}\``;
}
