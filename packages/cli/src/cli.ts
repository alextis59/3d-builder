import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import open from "open";
import { chromium } from "playwright";
import { exportRequestSchema, opsDocSchema, type OpsDoc } from "@gltf-studio/shared";
import {
  inspectAsset as defaultInspectAsset,
  resolveUnderRoot as defaultResolveUnderRoot,
  scanAssets as defaultScanAssets,
  startServer as defaultStartServer
} from "@gltf-studio/server";

export type CliDeps = {
  startServer: typeof defaultStartServer;
  scanAssets: typeof defaultScanAssets;
  inspectAsset: typeof defaultInspectAsset;
  resolveUnderRoot: typeof defaultResolveUnderRoot;
  openUrl: (url: string) => Promise<unknown>;
  launchBrowser: () => ReturnType<typeof chromium.launch>;
  resolveDefaultWebDist: () => Promise<string | null>;
  fetchImpl: typeof fetch;
  log: (message: string) => void;
};

export function parseSize(value: string): { w: number; h: number } {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error("Invalid --size. Expected WxH format, e.g. 1024x1024.");
  }
  return {
    w: Number(match[1]),
    h: Number(match[2])
  };
}

async function ensureDirForFile(filePath: string) {
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

export async function resolveDefaultWebDist(): Promise<string | null> {
  const selfDir = path.dirname(fileURLToPath(import.meta.url));
  const candidate = path.resolve(selfDir, "../../web/dist");
  try {
    const stat = await fs.stat(candidate);
    return stat.isDirectory() ? candidate : null;
  } catch {
    return null;
  }
}

function defaultDeps(): CliDeps {
  return {
    startServer: defaultStartServer,
    scanAssets: defaultScanAssets,
    inspectAsset: defaultInspectAsset,
    resolveUnderRoot: defaultResolveUnderRoot,
    openUrl: (url: string) => open(url),
    launchBrowser: () => chromium.launch(),
    resolveDefaultWebDist,
    fetchImpl: fetch,
    log: (message: string) => {
      console.log(message);
    }
  };
}

export function buildProgram(deps: Partial<CliDeps> = {}) {
  const d: CliDeps = { ...defaultDeps(), ...deps };

  const program = new Command();
  program.name("gltf-studio").description("Local glTF/GLB viewer/editor with AI-agent friendly CLI").version("0.1.0");

  program
    .command("serve")
    .argument("[rootDir]", "Root folder containing assets", ".")
    .option("--port <port>", "Port to bind", "7341")
    .option("--host <host>", "Host to bind", "127.0.0.1")
    .option("--open", "Open browser", false)
    .option("--web-dist <dir>", "Serve built web bundle (defaults to packages/web/dist when available)")
    .action(async (rootDir, opts) => {
      const root = path.resolve(rootDir);
      const port = Number(opts.port);
      const host = String(opts.host);

      const defaultWebDist = await d.resolveDefaultWebDist();
      const webDistDir = opts.webDist ? path.resolve(String(opts.webDist)) : defaultWebDist ?? undefined;

      const { host: actualHost, port: actualPort } = await d.startServer({
        rootDir: root,
        port,
        host,
        webDistDir
      });

      const url = `http://${actualHost}:${actualPort}/`;
      if (opts.open) await d.openUrl(url);

      d.log(
        JSON.stringify(
          {
            ok: true,
            root,
            url,
            webDistDir: webDistDir ?? null
          },
          null,
          2
        )
      );
    });

  program
    .command("list")
    .argument("[rootDir]", "Root folder containing assets", ".")
    .action(async (rootDir) => {
      const root = path.resolve(rootDir);
      const assets = await d.scanAssets(root);
      d.log(JSON.stringify({ root, assets }, null, 2));
    });

  program
    .command("inspect")
    .argument("<assetPath>", "Asset path relative to root (or absolute)")
    .option("--root <rootDir>", "Root folder (defaults to cwd)", ".")
    .action(async (assetPath, opts) => {
      const root = path.resolve(String(opts.root));
      const relPath = path.isAbsolute(assetPath) ? path.relative(root, assetPath) : assetPath;
      const absPath = d.resolveUnderRoot(root, relPath);
      const stats = await fs.stat(absPath);
      const info = await d.inspectAsset(absPath);

      d.log(
        JSON.stringify(
          {
            path: relPath,
            bytes: stats.size,
            ...info
          },
          null,
          2
        )
      );
    });

  program
    .command("export")
    .argument("<assetPath>", "Asset path relative to root (or absolute)")
    .requiredOption("--out <file>", "Output file path relative to root (or absolute)")
    .option("--root <rootDir>", "Root folder (defaults to cwd)", ".")
    .option("--ops <file>", "Ops JSON file path")
    .option("--preset <name>", "Export preset: raw-edit|preview-web", "raw-edit")
    .option("--format <format>", "Output format: glb|gltf")
    .option("--server <url>", "Existing API server URL. Must expose /api/export.")
    .action(async (assetPath, opts) => {
      const root = path.resolve(String(opts.root));
      const relAssetPath = path.isAbsolute(assetPath) ? path.relative(root, assetPath) : assetPath;
      const relOutPath = path.isAbsolute(String(opts.out)) ? path.relative(root, String(opts.out)) : String(opts.out);

      let ops: OpsDoc = { version: 1, ops: [] };
      if (opts.ops) {
        const raw = await fs.readFile(path.resolve(String(opts.ops)), "utf8");
        const json = JSON.parse(raw) as unknown;
        ops = opsDocSchema.parse(json);
      }

      const payload = exportRequestSchema.parse({
        assetPath: relAssetPath,
        outPath: relOutPath,
        format: opts.format ? String(opts.format) : undefined,
        preset: String(opts.preset),
        ops
      });

      let baseUrl = opts.server ? String(opts.server).replace(/\/+$/, "") : null;
      let closeServer: (() => Promise<void>) | null = null;

      if (!baseUrl) {
        const { app, host, port } = await d.startServer({ rootDir: root, port: 0, host: "127.0.0.1", logger: false });
        baseUrl = `http://${host}:${port}`;
        closeServer = async () => {
          await app.close();
        };
      }

      try {
        const res = await d.fetchImpl(`${baseUrl}/api/export`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });

        const body = (await res.json()) as unknown;
        if (!res.ok) {
          throw new Error(`Export failed: ${JSON.stringify(body)}`);
        }

        d.log(JSON.stringify(body, null, 2));
      } finally {
        if (closeServer) await closeServer();
      }
    });

  program
    .command("render")
    .argument("<assetPath>", "Asset path relative to root (or absolute)")
    .requiredOption("--out <file>", "Output image file, e.g. shots/model.png")
    .option("--root <rootDir>", "Root folder (defaults to cwd)", ".")
    .option("--size <WxH>", "Output image size", "1024x1024")
    .option("--camera <mode>", "Camera mode: auto|front|top|iso", "auto")
    .option("--bg <mode>", "Background mode: solid|transparent", "solid")
    .option("--anim <name>", "Animation clip name")
    .option("--time <seconds>", "Animation time in seconds")
    .option("--turntable <n>", "Turntable frame count (e.g. 16)")
    .option("--elev <deg>", "Elevation degrees for turntable camera", "15")
    .option("--radius <mul>", "Radius multiplier for turntable camera", "1")
    .option("--server <url>", "Existing render server URL. Must expose /render and /asset routes.")
    .option("--web-dist <dir>", "Built web bundle directory if auto-starting server")
    .action(async (assetPath, opts) => {
      const root = path.resolve(String(opts.root));
      const relPath = path.isAbsolute(assetPath) ? path.relative(root, assetPath) : assetPath;
      const { w, h } = parseSize(String(opts.size));

      const turntable = opts.turntable != null ? Number(opts.turntable) : null;
      const elev = opts.elev != null ? Number(opts.elev) : 15;
      const radius = opts.radius != null ? Number(opts.radius) : 1;
      const camera = String(opts.camera);
      const bg = String(opts.bg);
      const anim = opts.anim != null ? String(opts.anim) : null;
      const time = opts.time != null ? Number(opts.time) : null;

      let baseUrl = opts.server ? String(opts.server).replace(/\/+$/, "") : null;
      let closeServer: (() => Promise<void>) | null = null;

      if (!baseUrl) {
        const defaultWebDist = await d.resolveDefaultWebDist();
        const webDistDir = opts.webDist ? path.resolve(String(opts.webDist)) : defaultWebDist;
        if (!webDistDir) {
          throw new Error("No built web dist found. Run `pnpm -C packages/web build`, pass --web-dist, or pass --server.");
        }

        const { app, host, port } = await d.startServer({ rootDir: root, port: 0, host: "127.0.0.1", webDistDir, logger: false });
        baseUrl = `http://${host}:${port}`;
        closeServer = async () => {
          await app.close();
        };
      }

      const browser = await d.launchBrowser();
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1
      });

      const renderOne = async (outPath: string, orbitDeg: number | null) => {
        const query = new URLSearchParams();
        query.set("asset", relPath);
        query.set("size", `${w}x${h}`);
        query.set("camera", camera);
        query.set("bg", bg);
        if (anim) query.set("anim", anim);
        if (typeof time === "number" && !Number.isNaN(time)) query.set("time", String(time));
        if (orbitDeg !== null) {
          query.set("orbit", String(orbitDeg));
          query.set("elev", String(elev));
          query.set("radius", String(radius));
        }

        const url = `${baseUrl}/render?${query.toString()}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => (window as any).__RENDER_READY__ === true, null, {
          timeout: 60_000
        });

        await ensureDirForFile(outPath);
        await page.screenshot({
          path: outPath,
          omitBackground: bg === "transparent"
        });

        return url;
      };

      const urls: string[] = [];
      try {
        if (turntable && Number.isFinite(turntable) && turntable > 1) {
          const out = String(opts.out);
          const ext = path.extname(out) || ".png";
          const base = ext ? out.slice(0, -ext.length) : out;

          for (let i = 0; i < turntable; i += 1) {
            const orbitDeg = (i * 360) / turntable;
            const outPath = `${base}_${String(i).padStart(3, "0")}${ext}`;
            urls.push(await renderOne(outPath, orbitDeg));
          }

          d.log(
            JSON.stringify(
              {
                ok: true,
                mode: "turntable",
                frames: turntable,
                outBase: base,
                urls
              },
              null,
              2
            )
          );
        } else {
          const outPath = String(opts.out);
          const url = await renderOne(outPath, null);
          d.log(
            JSON.stringify(
              {
                ok: true,
                mode: "single",
                out: outPath,
                url
              },
              null,
              2
            )
          );
        }
      } finally {
        await page.close();
        await browser.close();
        if (closeServer) await closeServer();
      }
    });

  return program;
}

export async function runCli(argv = process.argv, deps: Partial<CliDeps> = {}) {
  const program = buildProgram(deps);
  await program.parseAsync(argv);
}
