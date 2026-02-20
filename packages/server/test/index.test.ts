import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "../src/index.js";
import { makeTempDir, writeEditableGlb, writeTriangleGlb } from "./fixtures.js";

let rootDir: string;
let app: Awaited<ReturnType<typeof startServer>>["app"];

beforeAll(async () => {
  rootDir = await makeTempDir("gltf-studio-api-");

  await writeTriangleGlb(path.join(rootDir, "models", "triangle.glb"));
  await writeEditableGlb(path.join(rootDir, "models", "editable.glb"));
  await fs.writeFile(path.join(rootDir, "models", "forbidden.txt"), "forbidden");

  const server = await startServer({ rootDir, host: "127.0.0.1", port: 0 });
  app = server.app;
});

afterAll(async () => {
  await app.close();
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe("HTTP API", () => {
  it("returns health response", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("lists assets", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { root: string; assets: Array<{ path: string; type: string }> };
    expect(body.root).toBe(rootDir);
    expect(body.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "models/triangle.glb", type: "glb" }),
        expect.objectContaining({ path: "models/editable.glb", type: "glb" })
      ])
    );
  });

  it("validates inspect query", async () => {
    const res = await app.inject({ method: "GET", url: "/api/inspect" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Missing query param: path" });
  });

  it("inspects a valid asset", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/inspect",
      query: { path: "models/triangle.glb" }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(
      expect.objectContaining({
        path: "models/triangle.glb",
        kind: "glb",
        meshes: 1,
        primitives: 1,
        triangles: 1
      })
    );
  });

  it("serves allowed asset file types", async () => {
    const res = await app.inject({ method: "GET", url: "/asset/models/triangle.glb" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("model/gltf-binary");
    expect(res.rawPayload.byteLength).toBeGreaterThan(0);
  });

  it("blocks disallowed file types", async () => {
    const res = await app.inject({ method: "GET", url: "/asset/models/forbidden.txt" });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "Forbidden file type" });
  });

  it("blocks path traversal in inspect API", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/inspect",
      query: { path: "../../etc/passwd" }
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toContain("Path escapes rootDir");
  });

  it("exports edited asset with ops", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/export",
      payload: {
        assetPath: "models/editable.glb",
        outPath: "models/editable.edited.glb",
        preset: "raw-edit",
        ops: {
          version: 1,
          ops: [
            {
              op: "node.rename",
              target: { kind: "nodePath", path: "Scene/Root" },
              value: { name: "RenamedRoot" }
            },
            {
              op: "material.setBaseColorFactor",
              target: { kind: "materialName", name: "Mat" },
              value: [0.2, 0.8, 0.2, 1]
            }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      ok: boolean;
      outPath: string;
      report: { bytesBefore: number; bytesAfter: number; materials: number };
    };
    expect(body.ok).toBe(true);
    expect(body.outPath).toBe("models/editable.edited.glb");
    expect(body.report.bytesBefore).toBeGreaterThan(0);
    expect(body.report.bytesAfter).toBeGreaterThan(0);
    expect(body.report.materials).toBe(1);

    const io = new NodeIO();
    const doc = await io.read(path.join(rootDir, "models", "editable.edited.glb"));
    const root = doc.getRoot();
    expect(root.listNodes()[0].getName()).toBe("RenamedRoot");
    expect(root.listMaterials()[0].getBaseColorFactor()).toEqual([0.2, 0.8, 0.2, 1]);
  });

  it("blocks path traversal in export output path", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/export",
      payload: {
        assetPath: "models/editable.glb",
        outPath: "../outside.glb"
      }
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toContain("Path escapes rootDir");
  });

  it("returns a helpful error when export target is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/export",
      payload: {
        assetPath: "models/editable.glb",
        outPath: "models/editable.missing-target.glb",
        ops: {
          version: 1,
          ops: [
            {
              op: "material.setBaseColorFactor",
              target: { kind: "materialName", name: "DoesNotExist" },
              value: [1, 0, 0, 1]
            }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toContain("Material name not found");
  });
});
