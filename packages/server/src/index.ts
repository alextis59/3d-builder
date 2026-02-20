import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportRequestSchema, type ExportFormat, type ExportPreset, type OpsDoc } from "@gltf-studio/shared";
import { scanAssets } from "./assetIndex.js";
import { inspectAsset } from "./inspect.js";
import { runExportPipeline } from "./pipeline/exportPipeline.js";
import { resolveUnderRoot } from "./paths.js";

export type StartServerOpts = {
  rootDir: string;
  port?: number;
  host?: string;
  webDistDir?: string;
  logger?: boolean;
};

const ALLOWED_EXT = /\.(glb|gltf|bin|png|jpe?g|webp|ktx2|basis|hdr)$/i;

function guessContentType(absPath: string): string {
  const lower = absPath.toLowerCase();
  if (lower.endsWith(".gltf")) return "model/gltf+json";
  if (lower.endsWith(".glb")) return "model/gltf-binary";
  if (lower.endsWith(".bin")) return "application/octet-stream";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ktx2")) return "image/ktx2";
  return "application/octet-stream";
}

function inferExportFormat(outPath: string, format?: ExportFormat): ExportFormat {
  const ext = path.extname(outPath).toLowerCase();
  const fromPath = ext === ".glb" ? "glb" : ext === ".gltf" ? "gltf" : null;
  if (!fromPath) {
    throw new Error("Output path must end with .glb or .gltf");
  }
  if (format && format !== fromPath) {
    throw new Error(`Output format mismatch: format=${format} but outPath extension is .${fromPath}`);
  }
  return format ?? fromPath;
}

export async function startServer(opts: StartServerOpts) {
  const rootDir = path.resolve(opts.rootDir);
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 7341;

  const app = Fastify({ logger: opts.logger ?? true });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/assets", async () => {
    const assets = await scanAssets(rootDir);
    return { root: rootDir, assets };
  });

  app.get("/api/inspect", async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.code(400).send({ error: "Missing query param: path" });
    }

    try {
      const abs = resolveUnderRoot(rootDir, query.path);
      const st = await fs.stat(abs);
      const info = await inspectAsset(abs);
      return { path: query.path, bytes: st.size, ...info };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Inspect failed" });
    }
  });

  app.post("/api/export", async (req, reply) => {
    const parsed = exportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const body = parsed.data;
    const preset: ExportPreset = body.preset ?? "raw-edit";
    const ops: OpsDoc = body.ops ?? { version: 1, ops: [] };

    try {
      const sourceAbsPath = resolveUnderRoot(rootDir, body.assetPath);
      const outAbsPath = resolveUnderRoot(rootDir, body.outPath);
      const format = inferExportFormat(body.outPath, body.format);

      if (!body.overwrite && sourceAbsPath === outAbsPath) {
        return reply.code(400).send({ error: "Refusing to overwrite source asset without overwrite=true" });
      }

      const report = await runExportPipeline({
        sourceAbsPath,
        outAbsPath,
        ops,
        preset
      });

      return {
        ok: true,
        outPath: body.outPath,
        format,
        preset,
        report
      };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Export failed" });
    }
  });

  app.get("/asset/*", async (req, reply) => {
    const rel = (req.params as { "*": string })["*"];
    try {
      const abs = resolveUnderRoot(rootDir, rel);
      if (!ALLOWED_EXT.test(abs)) {
        return reply.code(403).send({ error: "Forbidden file type" });
      }
      const buf = await fs.readFile(abs);
      reply.header("Cache-Control", "no-cache");
      reply.type(guessContentType(abs));
      return reply.send(buf);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Bad request" });
    }
  });

  if (opts.webDistDir) {
    const webDistDir = path.resolve(opts.webDistDir);
    app.register(staticPlugin, {
      root: webDistDir,
      prefix: "/"
    });

    app.setNotFoundHandler(async (_req, reply) => {
      try {
        const html = await fs.readFile(path.join(webDistDir, "index.html"));
        reply.type("text/html").send(html);
      } catch {
        reply.code(404).send({ error: "Not found" });
      }
    });
  }

  await app.listen({ host, port });

  const address = app.server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    app,
    rootDir,
    host,
    port: actualPort
  };
}

export { scanAssets, inspectAsset, resolveUnderRoot };

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entryPath) {
  const root = process.env.GLTF_STUDIO_ROOT ?? process.cwd();
  const port = process.env.GLTF_STUDIO_PORT ? Number(process.env.GLTF_STUDIO_PORT) : 7341;
  const webDist = process.env.GLTF_STUDIO_WEB_DIST;
  await startServer({ rootDir: root, port, webDistDir: webDist });
}
