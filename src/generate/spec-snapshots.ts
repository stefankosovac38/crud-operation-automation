import type { ParsedOperation } from "../types.js";
import { groupByTag } from "../openapi/operations.js";
import { pathParams, toMethodName, urlExpression } from "./naming.js";

/**
 * Minimal Vitest-style specs that assert URL construction (no network).
 */
export function generateSpecFiles(
  operations: ParsedOperation[],
): Map<string, string> {
  const files = new Map<string, string>();
  const byTag = groupByTag(operations);

  for (const [tag, ops] of byTag) {
    const safe = tag.replace(/[^a-zA-Z0-9]+/g, "") || "Default";
    const cases = ops
      .map((op) => {
        const name = toMethodName(op.operationId);
        const params = pathParams(op.path);
        const base = "const base = 'https://api.example.com'";
        const assigns = params.map((p, i) => `const ${p} = ${JSON.stringify(`v${i}`)};`).join("\n    ");
        const urlExpr = urlExpression("base", op.path);
        return `  it('${name} builds URL for ${op.method.toUpperCase()} ${op.path}', () => {
    ${base};
    ${assigns}
    const url = ${urlExpr};
    expect(url).toMatchSnapshot();
  });`;
      })
      .join("\n\n");

    const content = `import { describe, it, expect } from 'vitest';

describe('${tag} API URLs', () => {
${cases}
});
`;
    files.set(`${safe}.api-urls.spec.ts`, content);
  }

  return files;
}
