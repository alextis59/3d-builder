import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type CliRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function makeTempDir(prefix = "gltf-studio-cli-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function runCli(args: string[]): Promise<CliRunResult> {
  return new Promise((resolve) => {
    const cliDir = path.resolve(__dirname, "..");

    const child = spawn("pnpm", ["exec", "tsx", "src/index.ts", ...args], {
      cwd: cliDir,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

const dirs: string[] = [];
const cleanupPaths: string[] = [];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const fixtureAssetPath = "data/scene.gltf";

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  await Promise.all(cleanupPaths.splice(0).map((entry) => fs.rm(entry, { recursive: true, force: true })));
});

describe("gltf-studio CLI", () => {
  it("lists assets recursively", async () => {
    const root = await makeTempDir();
    dirs.push(root);

    await fs.mkdir(path.join(root, "nested"), { recursive: true });
    await fs.writeFile(path.join(root, "nested", "one.gltf"), "{}");
    await fs.writeFile(path.join(root, "two.glb"), "glb");

    const result = await runCli(["list", root]);
    expect(result.code).toBe(0);

    const body = JSON.parse(result.stdout) as { root: string; assets: Array<{ path: string }> };
    expect(body.root).toBe(root);
    expect(body.assets.map((asset) => asset.path)).toEqual(["nested/one.gltf", "two.glb"]);
  }, 20_000);

  it("inspects a valid asset", async () => {
    await fs.stat(path.join(repoRoot, fixtureAssetPath));

    const result = await runCli(["inspect", fixtureAssetPath, "--root", repoRoot]);
    expect(result.code).toBe(0);

    const body = JSON.parse(result.stdout) as {
      path: string;
      kind: string;
      meshes: number;
      primitives: number;
      triangles: number;
    };

    expect(body.path).toBe(fixtureAssetPath);
    expect(body.kind).toBe("gltf");
    expect(body.meshes).toBeGreaterThan(0);
    expect(body.primitives).toBeGreaterThan(0);
    expect(body.triangles).toBeGreaterThan(0);
  }, 20_000);

  it("fails on invalid render size format", async () => {
    await fs.stat(path.join(repoRoot, fixtureAssetPath));

    const result = await runCli(["render", fixtureAssetPath, "--root", repoRoot, "--out", "shot.png", "--size", "bad"]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("Invalid --size");
  }, 20_000);

  it("exports an asset with default ops", async () => {
    await fs.stat(path.join(repoRoot, fixtureAssetPath));

    const outRelative = `.tmp/cli-export-${Date.now()}.glb`;
    cleanupPaths.push(path.join(repoRoot, outRelative));

    const result = await runCli([
      "export",
      fixtureAssetPath,
      "--root",
      repoRoot,
      "--out",
      outRelative
    ]);

    expect(result.code).toBe(0);

    const jsonStart = result.stdout.lastIndexOf('{\n  "ok"');
    expect(jsonStart).toBeGreaterThanOrEqual(0);

    const body = JSON.parse(result.stdout.slice(jsonStart)) as {
      ok: boolean;
      outPath: string;
      format: string;
      report: { bytesBefore: number; bytesAfter: number };
    };

    expect(body.ok).toBe(true);
    expect(body.outPath).toBe(outRelative);
    expect(body.format).toBe("glb");
    expect(body.report.bytesBefore).toBeGreaterThan(0);
    expect(body.report.bytesAfter).toBeGreaterThan(0);

    await fs.stat(path.join(repoRoot, outRelative));
  }, 30_000);
});
