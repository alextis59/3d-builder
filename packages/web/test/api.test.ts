import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAssets, fetchInspect, postExport } from "../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAssets", () => {
  it("returns parsed asset payload", async () => {
    const payload = { root: "/tmp/assets", assets: [{ path: "model.glb", type: "glb", bytes: 1, mtimeMs: 1 }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAssets()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/assets");
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false
      })
    );

    await expect(fetchAssets()).rejects.toThrow("Failed to fetch assets");
  });
});

describe("fetchInspect", () => {
  it("requests inspect endpoint with encoded path and returns payload", async () => {
    const payload = {
      path: "models/robot.glb",
      bytes: 10,
      kind: "glb",
      scenes: 1,
      nodes: 1,
      meshes: 1,
      primitives: 1,
      materials: 0,
      textures: 0,
      animations: 0,
      skins: 0,
      triangles: 1,
      animationNames: []
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchInspect("models/robot.glb")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/inspect?path=models%2Frobot.glb");
  });

  it("throws on inspect failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false
      })
    );

    await expect(fetchInspect("bad.gltf")).rejects.toThrow("Failed to inspect asset");
  });
});

describe("postExport", () => {
  it("posts export payload and returns parsed response", async () => {
    const payload = {
      ok: true as const,
      outPath: "models/robot.edited.glb",
      format: "glb" as const,
      preset: "raw-edit" as const,
      report: {
        bytesBefore: 10,
        bytesAfter: 9,
        scenes: 1,
        nodes: 1,
        meshes: 1,
        materials: 1,
        textures: 0,
        animations: 0
      }
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postExport({
        assetPath: "models/robot.glb",
        outPath: "models/robot.edited.glb",
        ops: { version: 1, ops: [] }
      })
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/export",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" }
      })
    );
  });

  it("throws server message on export failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "bad output path" })
      })
    );

    await expect(
      postExport({
        assetPath: "models/robot.glb",
        outPath: "../bad.glb"
      })
    ).rejects.toThrow("bad output path");
  });
});
