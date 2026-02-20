import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProgram, parseSize, type CliDeps } from "../src/cli";

function createMockDeps(overrides: Partial<CliDeps> = {}) {
  const logs: string[] = [];

  const deps: Partial<CliDeps> = {
    startServer: vi.fn(),
    scanAssets: vi.fn(),
    inspectAsset: vi.fn(),
    resolveUnderRoot: vi.fn(),
    openUrl: vi.fn(async () => undefined),
    launchBrowser: vi.fn(),
    resolveDefaultWebDist: vi.fn(async () => null),
    fetchImpl: vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }) as any),
    log: (message: string) => {
      logs.push(message);
    },
    ...overrides
  };

  return { deps, logs };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("parseSize", () => {
  it("parses WxH values", () => {
    expect(parseSize("640x480")).toEqual({ w: 640, h: 480 });
  });

  it("throws on invalid values", () => {
    expect(() => parseSize("640")).toThrow("Invalid --size");
  });
});

describe("buildProgram", () => {
  it("runs list command and logs JSON payload", async () => {
    const scanAssets = vi.fn(async () => [{ path: "a.glb", type: "glb", bytes: 10, mtimeMs: 100 }]);
    const { deps, logs } = createMockDeps({ scanAssets });

    const program = buildProgram(deps);
    await program.parseAsync(["node", "gltf-studio", "list", "/tmp/assets"]);

    expect(scanAssets).toHaveBeenCalledWith(path.resolve("/tmp/assets"));
    expect(JSON.parse(logs[0] ?? "{}")).toEqual({
      root: path.resolve("/tmp/assets"),
      assets: [{ path: "a.glb", type: "glb", bytes: 10, mtimeMs: 100 }]
    });
  });

  it("runs inspect command and logs inspection", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gltf-studio-cli-unit-"));
    tempDirs.push(dir);
    const file = path.join(dir, "asset.glb");
    await fs.writeFile(file, "binary");

    const resolveUnderRoot = vi.fn(() => file);
    const inspectAsset = vi.fn(async () => ({
      kind: "glb" as const,
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
    }));

    const { deps, logs } = createMockDeps({ resolveUnderRoot, inspectAsset });

    const program = buildProgram(deps);
    await program.parseAsync(["node", "gltf-studio", "inspect", "asset.glb", "--root", dir]);

    expect(resolveUnderRoot).toHaveBeenCalledWith(path.resolve(dir), "asset.glb");
    expect(inspectAsset).toHaveBeenCalledWith(file);

    const body = JSON.parse(logs[0] ?? "{}");
    expect(body.path).toBe("asset.glb");
    expect(body.kind).toBe("glb");
    expect(body.meshes).toBe(1);
    expect(body.triangles).toBe(1);
    expect(body.bytes).toBeGreaterThan(0);
  });

  it("runs serve command and opens browser when requested", async () => {
    const startServer = vi.fn(async () => ({ app: { close: async () => undefined }, rootDir: "/tmp/x", host: "127.0.0.1", port: 8123 }));
    const openUrl = vi.fn(async () => undefined);
    const { deps, logs } = createMockDeps({
      startServer,
      openUrl,
      resolveDefaultWebDist: vi.fn(async () => "/tmp/web-dist")
    });

    const program = buildProgram(deps);
    await program.parseAsync(["node", "gltf-studio", "serve", "/tmp/root", "--host", "0.0.0.0", "--port", "8123", "--open"]);

    expect(startServer).toHaveBeenCalledWith({
      rootDir: path.resolve("/tmp/root"),
      port: 8123,
      host: "0.0.0.0",
      webDistDir: path.resolve("/tmp/web-dist")
    });
    expect(openUrl).toHaveBeenCalledWith("http://127.0.0.1:8123/");

    const body = JSON.parse(logs[0] ?? "{}");
    expect(body.ok).toBe(true);
    expect(body.url).toBe("http://127.0.0.1:8123/");
  });

  it("fails render when size is invalid", async () => {
    const { deps } = createMockDeps();
    const program = buildProgram(deps);

    await expect(
      program.parseAsync([
        "node",
        "gltf-studio",
        "render",
        "asset.glb",
        "--out",
        "shot.png",
        "--server",
        "http://localhost:7341",
        "--size",
        "bad"
      ])
    ).rejects.toThrow("Invalid --size");
  });

  it("renders single frame with server URL", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gltf-studio-cli-unit-"));
    tempDirs.push(tempDir);
    const outPath = path.join(tempDir, "shots", "one.png");

    const gotoUrls: string[] = [];
    const screenshotArgs: Array<{ path: string; omitBackground: boolean }> = [];
    const closePage = vi.fn(async () => undefined);
    const closeBrowser = vi.fn(async () => undefined);

    const page = {
      goto: vi.fn(async (url: string) => {
        gotoUrls.push(url);
      }),
      waitForFunction: vi.fn(async () => undefined),
      screenshot: vi.fn(async (opts: { path: string; omitBackground: boolean }) => {
        screenshotArgs.push(opts);
      }),
      close: closePage
    };

    const browser = {
      newPage: vi.fn(async () => page),
      close: closeBrowser
    };

    const { deps, logs } = createMockDeps({
      launchBrowser: vi.fn(async () => browser as any)
    });

    const program = buildProgram(deps);
    await program.parseAsync([
      "node",
      "gltf-studio",
      "render",
      "models/robot.glb",
      "--out",
      outPath,
      "--root",
      "/tmp/root",
      "--size",
      "320x200",
      "--camera",
      "top",
      "--bg",
      "transparent",
      "--anim",
      "Walk",
      "--time",
      "1.5",
      "--server",
      "http://127.0.0.1:7341/"
    ]);

    expect(gotoUrls).toHaveLength(1);
    expect(gotoUrls[0]).toContain("http://127.0.0.1:7341/render?");
    expect(gotoUrls[0]).toContain("asset=models%2Frobot.glb");
    expect(gotoUrls[0]).toContain("size=320x200");
    expect(gotoUrls[0]).toContain("camera=top");
    expect(gotoUrls[0]).toContain("bg=transparent");
    expect(gotoUrls[0]).toContain("anim=Walk");
    expect(gotoUrls[0]).toContain("time=1.5");

    expect(screenshotArgs).toEqual([{ path: outPath, omitBackground: true }]);
    expect(closePage).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);

    const body = JSON.parse(logs[0] ?? "{}");
    expect(body.mode).toBe("single");
    expect(body.out).toBe(outPath);
  });

  it("renders turntable frames and appends orbit params", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gltf-studio-cli-unit-"));
    tempDirs.push(tempDir);
    const outPath = path.join(tempDir, "turntable.png");

    const gotoUrls: string[] = [];
    const screenshotPaths: string[] = [];

    const page = {
      goto: vi.fn(async (url: string) => {
        gotoUrls.push(url);
      }),
      waitForFunction: vi.fn(async () => undefined),
      screenshot: vi.fn(async (opts: { path: string }) => {
        screenshotPaths.push(opts.path);
      }),
      close: vi.fn(async () => undefined)
    };

    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined)
    };

    const { deps, logs } = createMockDeps({
      launchBrowser: vi.fn(async () => browser as any)
    });

    const program = buildProgram(deps);
    await program.parseAsync([
      "node",
      "gltf-studio",
      "render",
      "asset.glb",
      "--out",
      outPath,
      "--server",
      "http://127.0.0.1:7341",
      "--turntable",
      "3",
      "--elev",
      "20",
      "--radius",
      "1.2"
    ]);

    expect(gotoUrls).toHaveLength(3);
    expect(gotoUrls[0]).toContain("orbit=0");
    expect(gotoUrls[1]).toContain("orbit=120");
    expect(gotoUrls[2]).toContain("orbit=240");
    expect(gotoUrls[0]).toContain("elev=20");
    expect(gotoUrls[0]).toContain("radius=1.2");

    expect(screenshotPaths[0]).toContain("turntable_000.png");
    expect(screenshotPaths[1]).toContain("turntable_001.png");
    expect(screenshotPaths[2]).toContain("turntable_002.png");

    const body = JSON.parse(logs[0] ?? "{}");
    expect(body.mode).toBe("turntable");
    expect(body.frames).toBe(3);
    expect(body.urls).toHaveLength(3);
  });

  it("fails render when auto-starting server without available web dist", async () => {
    const { deps } = createMockDeps({
      resolveDefaultWebDist: vi.fn(async () => null)
    });
    const program = buildProgram(deps);

    await expect(
      program.parseAsync([
        "node",
        "gltf-studio",
        "render",
        "asset.glb",
        "--out",
        "shot.png"
      ])
    ).rejects.toThrow("No built web dist found");
  });

  it("exports asset by auto-starting API server", async () => {
    const startServer = vi.fn(async () => ({ app: { close: async () => undefined }, rootDir: "/tmp/root", host: "127.0.0.1", port: 7450 }));
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        outPath: "models/a.edited.glb",
        preset: "raw-edit",
        format: "glb",
        report: { bytesBefore: 1, bytesAfter: 2, scenes: 1, nodes: 1, meshes: 1, materials: 1, textures: 0, animations: 0 }
      })
    })) as any;

    const { deps, logs } = createMockDeps({ startServer, fetchImpl });
    const program = buildProgram(deps);

    await program.parseAsync([
      "node",
      "gltf-studio",
      "export",
      "models/a.glb",
      "--root",
      "/tmp/root",
      "--out",
      "models/a.edited.glb",
      "--preset",
      "raw-edit"
    ]);

    expect(startServer).toHaveBeenCalledWith({ rootDir: path.resolve("/tmp/root"), port: 0, host: "127.0.0.1", logger: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:7450/api/export");
    expect(init.method).toBe("POST");

    const payload = JSON.parse(String(init.body)) as { assetPath: string; outPath: string; preset: string; ops: { version: number; ops: unknown[] } };
    expect(payload).toEqual({
      assetPath: "models/a.glb",
      outPath: "models/a.edited.glb",
      preset: "raw-edit",
      ops: { version: 1, ops: [] }
    });

    const body = JSON.parse(logs[0] ?? "{}");
    expect(body.ok).toBe(true);
    expect(body.outPath).toBe("models/a.edited.glb");
  });

  it("loads ops file for export and uses provided server URL", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gltf-studio-cli-unit-"));
    tempDirs.push(tempDir);

    const opsPath = path.join(tempDir, "ops.json");
    await fs.writeFile(
      opsPath,
      JSON.stringify({
        version: 1,
        ops: [
          {
            op: "node.rename",
            target: { kind: "nodePath", path: "Scene/Root" },
            value: { name: "Renamed" }
          }
        ]
      })
    );

    const startServer = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, outPath: "x" }) })) as any;
    const { deps } = createMockDeps({ startServer, fetchImpl });
    const program = buildProgram(deps);

    await program.parseAsync([
      "node",
      "gltf-studio",
      "export",
      "models/a.glb",
      "--out",
      "models/a.edited.glb",
      "--ops",
      opsPath,
      "--server",
      "http://localhost:7341/"
    ]);

    expect(startServer).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:7341/api/export",
      expect.objectContaining({ method: "POST" })
    );
  });
});
