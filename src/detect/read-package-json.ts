import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PackageJsonShape {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export async function readPackageJson(
  projectRoot: string,
): Promise<PackageJsonShape | null> {
  try {
    const raw = await readFile(join(projectRoot, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJsonShape;
  } catch {
    return null;
  }
}

export function mergeDeps(pkg: PackageJsonShape | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
}
