import path from "node:path";

export function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Resolve a user-supplied relative path against rootDir safely.
 * Throws if traversal escapes rootDir.
 */
export function resolveUnderRoot(rootDir: string, relPath: string): string {
  const root = path.resolve(rootDir);
  const abs = path.resolve(root, relPath.replace(/^[\\/]+/, ""));
  const relative = path.relative(root, abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes rootDir");
  }
  return abs;
}
