# 3d-builder (`gltf-studio`)

Local glTF/GLB viewer/editor with an AI-agent friendly CLI.

This repository is a pnpm monorepo with four packages:

- `@gltf-studio/server`: Fastify API for asset indexing, inspection, secure file serving, and export.
- `@gltf-studio/web`: React + React Three Fiber UI for interactive viewing/editing and headless render pages.
- `@gltf-studio/cli`: `gltf-studio` command for local serving, inspection, export, and screenshot rendering.
- `@gltf-studio/shared`: Shared Zod schemas and TypeScript types for ops/export payloads.

## Quick start

```bash
pnpm install
pnpm -C packages/web build
pnpm -C packages/cli exec playwright install chromium
pnpm -C packages/cli dev serve . --open
```

## Common workflows

### Start the local app (UI + API)

```bash
pnpm -C packages/web build
pnpm -C packages/cli dev serve /path/to/assets --open
```

### Explore assets from CLI

```bash
gltf-studio list /path/to/assets
gltf-studio inspect models/robot.glb --root /path/to/assets
```

### Export with edit ops

```bash
gltf-studio export models/robot.glb \
  --root /path/to/assets \
  --ops ops/robot.json \
  --out models/robot.edited.glb \
  --preset preview-web
```

### Render screenshots (single + turntable)

```bash
# Single frame

gltf-studio render models/robot.glb \
  --root /path/to/assets \
  --out shots/robot.png \
  --size 1024x1024

# Turntable sequence (robot_000.png ... robot_015.png)

gltf-studio render models/robot.glb \
  --root /path/to/assets \
  --out shots/robot.png \
  --turntable 16 \
  --size 768x768
```

## Developer docs

For onboarding and implementation details, see:

- [`docs/developer-guide.md`](docs/developer-guide.md): architecture, package responsibilities, API/CLI contracts, ops schema, and development/testing workflows.

## Monorepo scripts

Run from repository root:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm test:coverage
```
