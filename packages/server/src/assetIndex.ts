import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { toPosixPath } from "./paths.js";

export type AssetInfo = {
  path: string;
  type: "glb" | "gltf";
  bytes: number;
  mtimeMs: number;
};

export async function scanAssets(rootDir: string): Promise<AssetInfo[]> {
  const entries = await fg(["**/*.glb", "**/*.gltf"], {
    cwd: rootDir,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ["**/node_modules/**", "**/.git/**"]
  });

  const out: AssetInfo[] = [];
  for (const rel of entries) {
    const abs = path.join(rootDir, rel);
    const st = await fs.stat(abs);
    const lower = rel.toLowerCase();
    const type: "glb" | "gltf" = lower.endsWith(".glb") ? "glb" : "gltf";
    out.push({
      path: toPosixPath(rel),
      type,
      bytes: st.size,
      mtimeMs: st.mtimeMs
    });
  }

  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
