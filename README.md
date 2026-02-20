# 3d-builder

Local glTF/GLB viewer/editor with an AI-agent friendly CLI.

## Workspace

- `packages/server`: Fastify API + secure asset serving + glTF inspection.
- `packages/web`: Vite + React + React Three Fiber viewer and `/render` route.
- `packages/cli`: `gltf-studio` CLI (`serve`, `list`, `inspect`, `render`, `--turntable`).

## Quick start

```bash
pnpm install
pnpm -C packages/web build
pnpm -C packages/cli exec playwright install chromium
pnpm -C packages/cli dev serve . --open
```

## CLI examples

```bash
# List assets recursively under current folder
gltf-studio list .

# Inspect one asset
gltf-studio inspect models/robot.glb --root .

# Single screenshot
gltf-studio render models/robot.glb --root . --out shots/robot.png --size 1024x1024

# Turntable screenshots (robot_000.png ... robot_015.png)
gltf-studio render models/robot.glb --root . --out shots/robot.png --turntable 16 --size 768x768

# Export with patch ops
gltf-studio export models/robot.glb --root . --ops ops/robot.json --out models/robot.edited.glb --preset preview-web
```
