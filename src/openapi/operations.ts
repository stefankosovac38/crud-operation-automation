import type { HttpMethod, ParsedOperation } from "../types.js";

const HTTP_METHODS = new Set<HttpMethod>([
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
]);

function pickOperationId(
  explicit: unknown,
  method: string,
  path: string,
  index: number,
): string {
  if (typeof explicit === "string" && explicit.trim()) return explicit;
  const safePath = path
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${method}_${safePath || "root"}_${index}`;
}

/**
 * Flattens OpenAPI 3 `paths` into a list of operations.
 */
export function listOperations(document: Record<string, unknown>): ParsedOperation[] {
  const paths = document.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths || typeof paths !== "object") return [];

  const out: ParsedOperation[] = [];
  let index = 0;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [methodRaw, operation] of Object.entries(pathItem)) {
      const method = methodRaw.toLowerCase() as HttpMethod;
      if (!HTTP_METHODS.has(method)) continue;
      if (!operation || typeof operation !== "object") continue;
      const op = operation as Record<string, unknown>;
      const tags = Array.isArray(op.tags)
        ? op.tags.filter((t): t is string => typeof t === "string")
        : [];
      const summary = typeof op.summary === "string" ? op.summary : undefined;
      const operationId = pickOperationId(op.operationId, method, path, index);
      index += 1;
      out.push({
        operationId,
        method,
        path,
        summary,
        tags,
      });
    }
  }

  return out;
}

export function groupByTag(
  operations: ParsedOperation[],
): Map<string, ParsedOperation[]> {
  const map = new Map<string, ParsedOperation[]>();
  for (const op of operations) {
    const keys = op.tags.length ? op.tags : ["default"];
    for (const tag of keys) {
      const list = map.get(tag) ?? [];
      list.push(op);
      map.set(tag, list);
    }
  }
  return map;
}
