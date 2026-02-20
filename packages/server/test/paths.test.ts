import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUnderRoot, toPosixPath } from "../src/paths.js";

describe("toPosixPath", () => {
  it("converts platform separators to forward slashes", () => {
    const platformPath = ["assets", "nested", "model.glb"].join(path.sep);
    expect(toPosixPath(platformPath)).toBe("assets/nested/model.glb");
  });
});

describe("resolveUnderRoot", () => {
  it("resolves a normal relative path under root", () => {
    const root = path.resolve("/tmp/gltf-studio-root");
    const resolved = resolveUnderRoot(root, "models/robot.glb");
    expect(resolved).toBe(path.join(root, "models/robot.glb"));
  });

  it("normalizes leading slashes without escaping root", () => {
    const root = path.resolve("/tmp/gltf-studio-root");
    const resolved = resolveUnderRoot(root, "/models/robot.glb");
    expect(resolved).toBe(path.join(root, "models/robot.glb"));
  });

  it("throws for traversal attempts", () => {
    const root = path.resolve("/tmp/gltf-studio-root");
    expect(() => resolveUnderRoot(root, "../../etc/passwd")).toThrow("Path escapes rootDir");
  });
});
