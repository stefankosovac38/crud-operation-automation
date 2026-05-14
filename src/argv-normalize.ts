/**
 * Simpler CLI UX: allow `crud-codegen ./api.yaml` instead of always typing `generate --spec`.
 * Maps legacy `-r` to `-p` (project).
 */
export function prepareUserArgs(raw: string[]): string[] {
  const args = raw.map((a) => (a === "-r" ? "-p" : a));

  if (args.length === 0) {
    return args;
  }

  const first = args[0];
  const builtins = new Set([
    "detect",
    "generate",
    "help",
    "-h",
    "--help",
    "-V",
    "--version",
  ]);

  if (builtins.has(first)) {
    if (first === "generate" && args[1] && !args[1].startsWith("-")) {
      return ["generate", "--spec", args[1], ...args.slice(2)];
    }
    return args;
  }

  if (!first.startsWith("-")) {
    return ["generate", "--spec", first, ...args.slice(1)];
  }

  return ["generate", ...args];
}
