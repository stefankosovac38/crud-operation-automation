import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function writeGeneratedFiles(
  outDir: string,
  files: Map<string, string>,
): Promise<void> {
  for (const [rel, content] of files) {
    const full = join(outDir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content.trimStart() + (content.endsWith("\n") ? "" : "\n"), "utf8");
  }
}

const START = "<!-- crud-codegen:api-start -->";
const END = "<!-- crud-codegen:api-end -->";

export async function mergeReadmeSection(
  readmePath: string,
  sectionMarkdown: string,
): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(readmePath, "utf8");
  } catch {
    existing = `# API client\n\n${START}\n${END}\n`;
  }

  const block = `${START}\n${sectionMarkdown.trim()}\n${END}`;
  if (existing.includes(START) && existing.includes(END)) {
    const next = existing.replace(
      new RegExp(`${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`),
      block,
    );
    await writeFile(readmePath, next, "utf8");
    return;
  }

  const appended = `${existing.trimEnd()}\n\n${block}\n`;
  await writeFile(readmePath, appended, "utf8");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
