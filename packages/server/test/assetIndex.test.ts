import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanAssets } from "../src/assetIndex.js";
import { makeTempDir } from "./fixtures.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("scanAssets", () => {
  it("finds glb/gltf files recursively, excludes ignored folders, and sorts output", async () => {
    const root = await makeTempDir("gltf-studio-scan-");
    dirs.push(root);

    await fs.mkdir(path.join(root, "nested"), { recursive: true });
    await fs.mkdir(path.join(root, "node_modules"), { recursive: true });
    await fs.mkdir(path.join(root, ".git"), { recursive: true });

    await fs.writeFile(path.join(root, "b-model.gltf"), "{}");
    await fs.writeFile(path.join(root, "nested", "a-model.glb"), "glb");
    await fs.writeFile(path.join(root, "note.txt"), "skip");
    await fs.writeFile(path.join(root, "node_modules", "ignored.gltf"), "{}");
    await fs.writeFile(path.join(root, ".git", "ignored.glb"), "x");

    const assets = await scanAssets(root);

    expect(assets.map((asset) => asset.path)).toEqual(["b-model.gltf", "nested/a-model.glb"]);
    expect(assets.map((asset) => asset.type)).toEqual(["gltf", "glb"]);
    expect(assets.every((asset) => asset.bytes > 0)).toBe(true);
    expect(assets.every((asset) => asset.mtimeMs > 0)).toBe(true);
  });
});
