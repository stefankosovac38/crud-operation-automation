import SwaggerParser from "@apidevtools/swagger-parser";
import converter from "swagger2openapi";
import type { OpenApiInputVersion } from "../types.js";

export interface LoadedOpenApi {
  /** OpenAPI 3.x document after normalization */
  document: Record<string, unknown>;
  originalMajor: "2" | "3";
}

function isSwagger2(doc: Record<string, unknown>): boolean {
  return String(doc.swagger) === "2.0";
}

function isOpenApi3(doc: Record<string, unknown>): boolean {
  const v = doc.openapi;
  return typeof v === "string" && String(v).startsWith("3.");
}

async function convertSwagger2ToOpenApi3(
  spec: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    converter.convertObj(
      spec,
      { patch: true, warnOnly: true },
      (err: Error | null, out?: { openapi?: Record<string, unknown> }) => {
        if (err) reject(err);
        else if (out?.openapi) resolve(out.openapi);
        else reject(new Error("swagger2openapi produced no openapi output"));
      },
    );
  });
}

/**
 * @param preferred
 * - `auto` (default): OpenAPI 3.x as-is; Swagger 2.0 converted to OpenAPI 3.
 * - `3`: require OpenAPI 3.x input (reject Swagger 2.0).
 * - `2`: require Swagger 2.0 input (converted to OpenAPI 3 for codegen).
 */
export async function loadOpenApiDocument(
  pathOrUrl: string,
  preferred: OpenApiInputVersion,
): Promise<LoadedOpenApi> {
  const parsed = (await SwaggerParser.parse(pathOrUrl)) as Record<
    string,
    unknown
  >;

  const swagger2 = isSwagger2(parsed);
  const openapi3 = isOpenApi3(parsed);

  if (preferred === "2") {
    if (!swagger2) {
      throw new Error(
        "Expected Swagger 2.0 (--openapi-version 2) but the document is not 2.0.",
      );
    }
    const document = await convertSwagger2ToOpenApi3(parsed);
    return { document, originalMajor: "2" };
  }

  if (preferred === "3") {
    if (swagger2) {
      throw new Error(
        "Document is Swagger 2.0. Use --openapi-version auto to convert, or pass an OpenAPI 3.x file.",
      );
    }
    if (!openapi3) {
      throw new Error("Expected OpenAPI 3.x but the document version is not recognized.");
    }
    return { document: parsed, originalMajor: "3" };
  }

  // auto
  if (swagger2) {
    const document = await convertSwagger2ToOpenApi3(parsed);
    return { document, originalMajor: "2" };
  }
  if (openapi3) {
    return { document: parsed, originalMajor: "3" };
  }

  throw new Error(
    "Unsupported API description: expected OpenAPI 3.x or Swagger 2.0.",
  );
}
