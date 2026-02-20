# Developer Guide

This guide is for new contributors who need to understand how `gltf-studio` is structured and how to safely add features.

## 1) Repository layout

```text
packages/
  cli/      # gltf-studio command (serve/list/inspect/export/render)
  server/   # Fastify API, asset serving, inspect/export pipeline
  shared/   # shared zod schemas + types
  web/      # React + R3F UI + /render page used by CLI screenshots
```

### Package responsibilities

- `packages/shared`
  - Defines the canonical operation schemas (`OpsDoc`, `Op`) and export request schema (`exportRequestSchema`) used by both server and client/CLI.
- `packages/server`
  - Exposes API endpoints under `/api/*`.
  - Restricts filesystem access to the configured root using `resolveUnderRoot`.
  - Runs glTF-Transform based inspect/export logic.
- `packages/web`
  - Default browser app for browsing assets, editing transforms/material values, and exporting edits.
  - Exposes `/render` page that the CLI drives with Playwright for screenshots.
- `packages/cli`
  - User-facing command runner.
  - Can attach to an existing server or spawn its own temporary server for export/render operations.

## 2) Runtime architecture and data flow

### Serving and UI flow

1. CLI `serve` starts Fastify with a root directory and optional built web dist.
2. Browser UI calls API endpoints:
   - `GET /api/assets`
   - `GET /api/inspect?path=...`
   - `POST /api/export`
3. Viewer models are fetched from `GET /asset/*`, with path checks and extension allow-list enforcement.

### Edit/export flow

1. UI captures edits as an op list (`Op[]`).
2. UI/CLI sends `ExportRequest` payload to `/api/export`.
3. Server validates payload using shared schema.
4. Server reads source glTF/GLB with glTF-Transform.
5. Server applies ops, then applies preset transforms.
6. Server writes output and returns an export report.

This keeps export deterministic and aligned across UI and CLI.

## 3) API endpoints (server)

Base implementation: `packages/server/src/index.ts`.

- `GET /api/health`
  - Returns `{ ok: true }`.

- `GET /api/assets`
  - Returns `{ root, assets }` where assets are discovered recursively under root.

- `GET /api/inspect?path=<asset-relative-path>`
  - Resolves path under root.
  - Returns counts for scenes/nodes/meshes/materials/textures/animations/triangles.

- `POST /api/export`
  - Validates request with `exportRequestSchema`.
  - Resolves source/output paths under root.
  - Applies edit ops + preset pipeline.
  - Returns `{ ok, outPath, format, preset, report }`.

- `GET /asset/*`
  - Securely serves model and dependency files (`glb`, `gltf`, `bin`, common image/texture formats).

## 4) Ops schema and semantics

Canonical schemas are in `packages/shared/src/ops.ts`.

### Document envelope

```json
{
  "version": 1,
  "ops": []
}
```

### Supported ops

- `node.setTransform`
  - Target: `{ kind: "nodePath", path }`
  - Value: partial of `translation`, `rotation`, `scale`

- `node.setVisible`
  - Target: `{ kind: "nodePath", path }`
  - Value: `{ visible: boolean }`

- `node.rename`
  - Target: `{ kind: "nodePath", path }`
  - Value: `{ name }`

- `material.setBaseColorFactor`
  - Target: `{ kind: "materialName", name }`
  - Value: `[r, g, b, a]`

- `material.setPBR`
  - Target: `{ kind: "materialName", name }`
  - Value: partial of `metallicFactor`, `roughnessFactor`, `emissiveFactor`

### Targeting notes

- Node targeting uses stable-at-load path labels (e.g. `Scene0/Root/Hips`).
- Material targeting is by material name and must be unambiguous.
- Duplicate material names cause export errors (by design) to avoid accidental edits.

## 5) Export presets

Preset implementation is in `packages/server/src/pipeline/presets.ts`.

- `raw-edit`
  - No optimization transform.

- `preview-web`
  - Applies `prune()`, `dedup()`, and `weld()` transforms from glTF-Transform.

Add new presets in this file and include them in shared schema enums so API and clients stay in sync.

## 6) CLI command reference

Implementation: `packages/cli/src/cli.ts`.

- `gltf-studio serve [rootDir]`
  - Options: `--port`, `--host`, `--open`, `--web-dist`

- `gltf-studio list [rootDir]`
  - Prints indexed assets as JSON.

- `gltf-studio inspect <assetPath> --root <rootDir>`
  - Prints inspection JSON for one asset.

- `gltf-studio export <assetPath> --out <file> [options]`
  - Options: `--root`, `--ops`, `--preset`, `--format`, `--server`

- `gltf-studio render <assetPath> --out <file> [options]`
  - Options: `--root`, `--size`, `--camera`, `--bg`, `--anim`, `--time`, `--turntable`, `--elev`, `--radius`, `--server`, `--web-dist`

### Render mode details

- If `--server` is omitted, CLI starts a temporary local server.
- CLI opens Chromium with Playwright and navigates to `/render`.
- For turntables, output files are suffixed `_000`, `_001`, etc.

## 7) Web app details

Important files:

- `packages/web/src/ViewerPage.tsx`
  - Main UI orchestration (asset list, inspect panel, export controls, material + transform editing).
- `packages/web/src/viewer/ViewerCanvas.tsx`
  - Three.js scene loading, orbit controls, transform controls, picking, material edits, animation playback.
- `packages/web/src/RenderPage.tsx`
  - Headless render route for CLI screenshots.
- `packages/web/src/editor/ops.ts`
  - Helpers that upsert operation patches from UI actions.

## 8) Local development workflows

From repository root:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Target specific package:

```bash
pnpm -C packages/server test
pnpm -C packages/web test
pnpm -C packages/cli test
pnpm -C packages/shared test
```

Run app locally with sample data in this repository:

```bash
pnpm -C packages/web build
pnpm -C packages/cli exec playwright install chromium
pnpm -C packages/cli dev serve . --open
```

## 9) Contributing guidance

- Keep shared request/ops schemas in `packages/shared` as source-of-truth.
- If API contracts change, update all three surfaces together:
  1. shared schema/types
  2. server handlers
  3. web/cli callers and tests
- Maintain root-directory sandboxing for any filesystem reads/writes.
- Prefer deterministic JSON output in CLI commands to stay automation-friendly.
- Add or update tests in the package that owns the behavior.

## 10) Common troubleshooting

- **`render` fails with missing web dist**
  - Build web package first (`pnpm -C packages/web build`) or pass `--web-dist`.

- **`render` fails due to missing browser**
  - Install chromium for CLI package (`pnpm -C packages/cli exec playwright install chromium`).

- **export fails on material operation**
  - Verify material names are unique in source asset.

- **asset load fails with forbidden type**
  - Ensure dependencies use allowed extensions and are served under root path.
