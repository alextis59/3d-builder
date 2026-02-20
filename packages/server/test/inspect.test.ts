import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectAsset } from "../src/inspect.js";
import { makeTempDir, writeTriangleGlb, writeTriangleGltf } from "./fixtures.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("inspectAsset", () => {
  it("inspects a GLB asset", async () => {
    const root = await makeTempDir("gltf-studio-inspect-");
    dirs.push(root);

    const file = path.join(root, "triangle.glb");
    await writeTriangleGlb(file);

    const info = await inspectAsset(file);

    expect(info.kind).toBe("glb");
    expect(info.scenes).toBe(1);
    expect(info.nodes).toBe(1);
    expect(info.meshes).toBe(1);
    expect(info.primitives).toBe(1);
    expect(info.triangles).toBe(1);
    expect(info.materials).toBe(0);
    expect(info.textures).toBe(0);
    expect(info.animations).toBe(0);
    expect(info.skins).toBe(0);
    expect(info.animationNames).toEqual([]);
  });

  it("inspects a GLTF asset", async () => {
    const root = await makeTempDir("gltf-studio-inspect-");
    dirs.push(root);

    const file = path.join(root, "triangle.gltf");
    await writeTriangleGltf(file);

    const info = await inspectAsset(file);

    expect(info.kind).toBe("gltf");
    expect(info.meshes).toBe(1);
    expect(info.triangles).toBe(1);
  });

  it("rejects unsupported file types", async () => {
    const root = await makeTempDir("gltf-studio-inspect-");
    dirs.push(root);

    const file = path.join(root, "triangle.txt");
    await fs.writeFile(file, "hello");

    await expect(inspectAsset(file)).rejects.toThrow("Unsupported file type");
  });
});
