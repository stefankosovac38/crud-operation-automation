#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import { prepareUserArgs } from "./argv-normalize.js";
import { detectFramework } from "./detect/framework.js";
import { generateAngularArtifacts } from "./generate/angular.js";
import { generateReactArtifacts } from "./generate/react.js";
import { generateVueArtifacts } from "./generate/vue.js";
import { generateSpecFiles } from "./generate/spec-snapshots.js";
import { loadOpenApiDocument } from "./openapi/load-spec.js";
import { listOperations } from "./openapi/operations.js";
import type { FrameworkKind, OpenApiInputVersion } from "./types.js";
import { mergeReadmeSection, writeGeneratedFiles } from "./util/write-files.js";

const program = new Command();

program
  .name("crud-codegen")
  .description(
    "Generate Angular HttpClient, React (fetch + optional TanStack Query), or Vue clients from OpenAPI 3.x / Swagger 2.0.",
  );

program
  .command("generate")
  .requiredOption("-s, --spec <path>", "Path or URL to OpenAPI 3.x / Swagger 2.0 document")
  .option("-p, --project <path>", "Frontend project root (default: cwd)", process.cwd())
  .option("-o, --out <path>", "Output directory for generated files", "src/api")
  .option(
    "--framework <kind>",
    "Override detection: angular | react | vue",
    (v) => v as FrameworkKind,
  )
  .option(
    "--openapi-version <mode>",
    "auto (default) | 3 | 2 — see README",
    "auto",
  )
  .option("--readme <path>", "README to patch with an API summary section")
  .option("--with-specs", "Emit Vitest snapshot specs for URL building", false)
  .action(async (opts) => {
    const projectRoot = resolve(opts.project);
    const outDir = resolve(projectRoot, opts.out);
    const specPath = opts.spec;

    const openapiMode = opts.openapiVersion as OpenApiInputVersion;
    if (!["auto", "2", "3"].includes(openapiMode)) {
      throw new Error("--openapi-version must be auto, 2, or 3");
    }

    const profile = await detectFramework(projectRoot, opts.framework);
    if (profile.kind === "unknown" && !opts.framework) {
      throw new Error(
        "Could not detect framework. Pass --framework angular|react|vue.",
      );
    }

    const { document, originalMajor } = await loadOpenApiDocument(
      specPath,
      openapiMode,
    );
    const operations = listOperations(document);

    let files: Map<string, string>;
    switch (profile.kind) {
      case "angular":
        files = generateAngularArtifacts(profile, operations);
        break;
      case "react":
        files = generateReactArtifacts(profile, operations);
        break;
      case "vue":
        files = generateVueArtifacts(profile, operations);
        break;
      default:
        throw new Error("Unsupported framework");
    }

    if (opts.withSpecs) {
      for (const [k, v] of generateSpecFiles(operations)) {
        files.set(`__specs__/${k}`, v);
      }
    }

    await writeGeneratedFiles(outDir, files);

    const readmeTarget = opts.readme
      ? resolve(projectRoot, opts.readme)
      : resolve(projectRoot, "README.md");

    const table = [
      "| Field | Value |",
      "| --- | --- |",
      `| Framework | ${profile.kind} |`,
      `| OpenAPI input | ${originalMajor === "2" ? "Swagger 2.0 (normalized to OAS 3)" : "OpenAPI 3.x"} |`,
      `| Operations | ${operations.length} |`,
      `| Output | \`${opts.out}\` |`,
      "",
      "Regenerate:",
      "",
      "```bash",
      `npx crud-codegen ${specPath} --out ${opts.out}`,
      "```",
      "",
    ].join("\n");

    await mergeReadmeSection(readmeTarget, table);

    // eslint-disable-next-line no-console
    console.log(
      `Generated ${files.size} file(s) for ${profile.kind} → ${outDir}`,
    );
  });

program
  .command("detect")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(async (opts) => {
    const projectRoot = resolve(opts.project);
    const p = await detectFramework(projectRoot);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(p, null, 2));
  });

const userArgs = process.argv.slice(2);
if (userArgs.length === 0) {
  // eslint-disable-next-line no-console
  console.error(`Usage:
  crud-codegen <openapi.yaml|url> [options]     generate client (default)
  crud-codegen generate --spec <path> [options]
  crud-codegen detect [--project <dir>]

Common options:  -p, --project <dir>   -o, --out <path>   --framework angular|react|vue
`);
  process.exit(1);
}

program
  .parseAsync(prepareUserArgs(userArgs), { from: "user" })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
