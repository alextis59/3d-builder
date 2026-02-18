# Conversation with ChatGPT

**Date:** 2026-02-18
**Source:** [chat.openai.com](https://chatgpt.com/c/6992145f-ba64-8396-9a9a-82f92e405088)

---

### **You**

# Web 3D asset viewer/editor

The goal of this project will be to create a web application able to view/edit 3D gltf assets.

It will starts by launching a command in a folder containing assets which launch the application and display the list of gltf assets present in this folder and sub-folder.

The user will then be able to select an asset to render it in the browser, move the camera, rotate the view, zoom and be able to play animations if any.

Start by doing a study on how to implement this project: which tech to use, which processing can be done in UI and which in backend, which editing features can be implemented, etc...
It will be run on Linux/ubuntu with nodeJS

---

### **ChatGPT**

# Web 3D asset viewer/editor

The goal of this project will be to create a web application able to view/edit 3D gltf assets.

It will starts by launching a command in a folder containing assets which launch the application and display the list of gltf assets present in this folder and sub-folder.

The user will then be able to select an asset to render it in the browser, move the camera, rotate the view, zoom and be able to play animations if any.

Start by doing a study on how to implement this project: which tech to use, which processing can be done in UI and which in backend, which editing features can be implemented, etc...
It will be run on Linux/ubuntu with nodeJS

---

### **You**

Here’s a solid “implementation study” for a local (Linux/Ubuntu) Node.js web app that can discover glTF/GLB files in a folder tree, preview them in-browser, and progressively add editing + export.

1) What you’re building (scope in 2 phases)
Phase A — Viewer (fast to ship)

CLI command run inside an “assets folder”

Launches a local web app

Scans folder + subfolders for .gltf / .glb

UI shows list + search

Select asset → render with orbit controls (rotate/zoom/pan)

Show scene graph (nodes/meshes/materials)

Animation player if any (play/pause, speed, select clip)

Phase B — Editor (careful design)

Non-destructive edits with “dirty state”

Export updated .glb or .gltf + bin + textures

Optional optimization/compression pipeline

2) Recommended tech stack
UI (renderer)
You have two strong choices:
Option 1 — Three.js + React Three Fiber (R3F)

Great for custom editor UIs and interactions.

Huge ecosystem: controls, helpers, gizmos, etc.

Plenty of existing glTF viewer code to borrow patterns from (e.g. Don McCurdy’s three-gltf-viewer). GitHub

Option 2 — Babylon.js (Viewer + Inspector tooling)

Babylon has a very strong “inspector” and tooling story for debugging scenes. doc.babylonjs.com+1

If you want a “ready-made” feel fast, Babylon can be extremely productive.

If your end goal is a real editor UI (scene graph, gizmos, property panels), I’d lean R3F because you’ll be building lots of custom interaction anyway.
Backend (local Node.js)

Vite dev server (or production build) for the UI.

Express/Fastify server for APIs + file access.

chokidar for watching asset folder changes (auto-refresh list).

Optional WebSocket/SSE to push file list updates to UI.

glTF processing / editing library
Use glTF-Transform as your “document model” for edits + export:

It’s designed to read/edit/write glTF/GLB safely and reproducibly. GitHub+1

Has a CLI and functions for inspection/optimization. npmjs.com+1

For deeper optimization, consider gltfpack (meshoptimizer pipeline). meshoptimizer.org+1

3) Architecture: what runs in UI vs backend
What the UI should do (interactive, low-latency)

Rendering (WebGL)

Camera controls (orbit/pan/zoom)

Scene picking (click a mesh to select)

Animation playback (THREE.AnimationMixer / Babylon animation system)

Lightweight property editing that doesn’t require re-encoding assets:

node visibility toggles

transform edits (position/rotation/scale)

camera framing

basic material param tweaks (color/metalness/roughness), if you can re-export later

What the backend should do (file system + heavy transforms)

Folder scanning + indexing (and filtering ignored folders)

Serve glTF dependencies (textures, bins) safely

Save/export updated assets

Run heavy processing:

texture resize/format conversion

KTX2/Basis compression, WebP

Draco / Meshopt compression

deduplication / instancing transforms

generating reports (polycount, drawcalls, texture sizes)

Why: browsers can do some of this, but the Node backend is simpler, faster, and avoids browser sandbox limitations. Also some tools are easier to run on Linux binaries (e.g., gltfpack).

4) Key “editor” features you can realistically implement
Think in layers: safe edits first, “dangerous” edits later.
Safe / practical edits (high value, low risk)

Transform editing with gizmos

Move/rotate/scale nodes (with local/world toggle)

Rename nodes / reorganize scene tree

Visibility + selection sets

Material property editing

BaseColor factor, metal/rough, emissive

Texture assignment (swap file paths)

Animation tools (basic)

Clip selection, speed, looping

Preview skeleton/bones

Validation + inspection report

Run a report using glTF-Transform “inspect”-style info or Khronos validator integration concepts (even if you run it locally). glTF Transform+1

“Pipeline/editor” features (still realistic, but backend-heavy)

Optimization presets

“Web preview” preset: texture compress + meshopt + prune unused

Using glTF-Transform CLI/functions. npmjs.com+1

Export variants

export .glb

export .gltf separate resources

LOD generation (simple)

Start with “external” LOD generation (e.g., call a simplifier tool), then write LOD nodes / MSFT\_lod extension (more advanced)

Hard / “3D DCC territory” (avoid early)

Authoring new geometry, remeshing, UV editing

Complex animation editing/retargeting

Boolean operations, sculpting, etc.

Your editor can be excellent without becoming Blender.

5) CLI workflow (how “run a command in a folder” should work)
Example UX:

User runs: gltf-studio . (or npx gltf-studio)

The CLI:

resolves absolute root folder

starts local server on an available port

opens browser (optional)

watches for file changes

exposes API endpoints like:

GET /api/assets → list of assets (path, size, modified time)

GET /api/asset?path=... → metadata/inspection

POST /api/export → apply patch ops + write output

Important: don’t serve arbitrary filesystem paths; restrict to the chosen root folder.

6) Data model for editing (don’t directly mutate Three.js scene)
Best practice:

UI scene = rendering representation

Asset document (source of truth) = glTF-Transform Document (backend)

Flow:

UI loads asset for viewing.

User edits properties (transform/material/etc.).

UI records edits as operations (a patch log).

When user hits Save/Export:

send ops to backend

backend applies them to glTF-Transform Document

backend writes .glb/.gltf back to disk

This avoids “drift” between what’s rendered and what’s saved, and keeps exports deterministic.
There’s even a library specifically meant to sync a glTF-Transform Document to a three.js scene graph for editor-like apps (@gltf-transform/view), which is relevant inspiration. GitHub

7) Rendering details you’ll need (glTF realities)
To robustly view real-world glTFs, plan support for:

Draco meshes

Meshopt compression

KTX2 textures
Meshopt decode is generally faster than Draco decode (but both are common). glTF Transform+1

8) Suggested MVP plan (practical milestones)
Milestone 1 — “Local viewer”

Node server + folder scan + list UI

Click → viewer + orbit controls + animation player

Basic overlay stats: triangles, materials, textures

Milestone 2 — “Inspector”

Scene graph panel

Select mesh by clicking

Show selected node/material properties

Milestone 3 — “Editor basics”

Transform gizmo editing + reset

Material color/roughness/metalness editing

Export to new file (model.edited.glb)

Milestone 4 — “Pipeline”

Optimize/export presets using glTF-Transform optimize / selected functions npmjs.com+1

Optional gltfpack integration meshoptimizer.org

Validation report output

If you want, I can follow up with a concrete repo layout (CLI package + server + Vite UI), plus a proposed API schema for patch operations (transform/material/visibility) and an “export preset” pipeline that chains glTF-Transform + optional gltfpack.

---

### **ChatGPT**

Yes please

---

### **ChatGPT**

Cool — here’s a concrete, buildable blueprint: monorepo layout + CLI + server + Vite UI, plus an API schema for patch ops and an export pipeline (glTF-Transform first, optional gltfpack).

Repo layout (monorepo, pnpm)

```
gltf-studio/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json

  packages/
    cli/
      src/
        index.ts
      package.json

    server/
      src/
        index.ts
        assetIndex.ts
        routes/
          assets.ts
          export.ts
        ops/
          applyOps.ts
          ops.types.ts
        pipeline/
          exportPipeline.ts
          presets.ts
      package.json

    web/
      index.html
      vite.config.ts
      src/
        main.tsx
        App.tsx
        api/client.ts
        state/store.ts
        viewer/
          ViewerCanvas.tsx
          useGltf.ts
          AnimationPanel.tsx
          SceneTree.tsx
          Gizmo.tsx
        editor/
          ops.ts   // create patch ops
          PropertyPanel.tsx
      package.json
```

Why this structure

cli owns the “run in a folder” experience

server owns filesystem access + export/transforms

web owns rendering and UX; it never touches the real filesystem directly

Runtime flow (what happens when user runs the command)

gltf-studio . resolves an absolute rootDir

Starts server on an available port, passing rootDir

Server:

scans for .glb/.gltf

exposes /api/assets

serves asset bytes through /asset/\* (restricted to rootDir)

UI:

loads list

loads selected asset by URL (/asset/...)

records edits as patch ops

On Export, UI sends { assetPath, ops, preset, outPath }

Server applies ops on a glTF-Transform Document, runs pipeline, writes output

CLI package (minimal, solid UX)
packages/cli/src/index.ts

parse args: root folder, --port, --no-open

spawn server (Node API import or child process)

optionally open browser

Suggested implementation approach:

Simpler: CLI imports server as a library and calls startServer({ rootDir, port })

More isolated: CLI spawns node packages/server/dist/index.js --root ...

I’d do import-as-library so you don’t fight child-process logs and env.

Server design
Server responsibilities

Safe static asset serving from rootDir

Asset indexing + file watcher (optional)

Export endpoint: apply ops + write file + return result stats

Core endpoints
1) List assets
GET /api/assets
Response:

```json
{
  "root": "/abs/path/to/root",
  "assets": [
    {
      "path": "characters/zombie.glb",
      "type": "glb",
      "bytes": 12345678,
      "mtimeMs": 1739570000000
    }
  ]
}
```

2) Load asset bytes (viewer)
GET /asset/:path(\*)

Example: /asset/characters/zombie.glb

Must prevent path traversal: normalize + ensure it stays within rootDir.

3) Export (apply edits + pipeline)
POST /api/export
Body:

```json
{
  "assetPath": "characters/zombie.glb",
  "ops": [ /\* patch ops \*/ ],
  "preset": "preview-web",
  "outPath": "characters/zombie.edited.glb",
  "format": "glb"
}
```

Response:

```json
{
  "ok": true,
  "outPath": "characters/zombie.edited.glb",
  "report": {
    "bytesBefore": 12345678,
    "bytesAfter": 8450000,
    "meshes": 12,
    "materials": 8,
    "textures": 5
  }
}
```

Patch ops schema (simple, extensible, deterministic)
You want ops that are:

easy to generate from UI

easy to apply on backend

stable across re-renders

robust even if node order changes

Node addressing strategy
Prefer to address nodes by stable key:

If glTF nodes have names, use them (with collision handling).

Better: backend builds an index of nodes and injects stable IDs in memory:

nodeKey = path-like string (e.g. SceneRoot/Armature/Hips/Spine)

or (name + index path) when names collide.

For MVP: use node path derived from traversal order + names; for exports, ops apply on freshly loaded doc, same traversal → stable enough.
ops.types.ts
Example ops:

```ts
export type Op =
  | { op: "node.setTransform"; target: NodeRef; value: Transform }
  | { op: "node.setVisible"; target: NodeRef; value: boolean }
  | { op: "node.rename"; target: NodeRef; value: string }
  | { op: "material.setPBR"; target: MaterialRef; value: PBRPatch }
  | { op: "material.setBaseColorFactor"; target: MaterialRef; value: [number, number, number, number] }
  | { op: "material.setTexture"; target: TextureSlotRef; value: TextureRef | null }
  ;

export type NodeRef = { kind: "nodePath"; path: string }; // "Root/Armature/Hips"
export type MaterialRef = { kind: "materialName"; name: string };

export type Transform = {
  translation?: [number, number, number];
  rotation?: [number, number, number, number]; // quat
  scale?: [number, number, number];
};

export type PBRPatch = {
  metallicFactor?: number;
  roughnessFactor?: number;
  emissiveFactor?: [number, number, number];
};

export type TextureSlotRef = {
  kind: "materialTextureSlot";
  material: MaterialRef;
  slot: "baseColor" | "metallicRoughness" | "normal" | "occlusion" | "emissive";
};

export type TextureRef = { kind: "assetFile"; path: string }; // relative to rootDir
```

MVP ops to implement first

node.setTransform

node.setVisible

material.setBaseColorFactor

material.setPBR (metal/rough)

later: texture swapping

Backend: applying ops with glTF-Transform
applyOps.ts (high level logic)
Pseudo-flow:

Load document from assetPath (.glb or .gltf)

Build lookup maps:

nodePath -> Node

materialName -> Material

Apply each op:

set node transforms

set visibility (usually via extras or removing from scene? see note below)

set material factors / textures

Run export pipeline preset

Write to outPath

Note on “visibility”
glTF doesn’t have a native visible flag like three.js. Common approaches:

Store extras.visible=false and have your runtime respect it

Or move nodes out of the default scene / detach primitives (destructive)
For an editor: use extras. It’s reversible, and your viewer can honor it.

Export pipeline presets
Goals

“Just save edits” (no heavy transforms)

“Preview web” (reduce size, improve decode speed)

“Quest/perf” (more aggressive but safe)

Preset design

Each preset is a function that receives a glTF-Transform Document

It runs a sequence of transforms

It returns a report

Example presets

raw-edit

apply ops, write output, no further changes

preview-web

prune unused

dedupe

meshopt (if you want)

texture compression optional (bigger topic)

aggressive

use gltfpack (external) after writing a temp file

Pipeline implementation (glTF-Transform + optional gltfpack)
A) glTF-Transform transforms (in-process Node)
Typical chain:

prune() remove unused accessors/nodes/materials/textures

dedup() remove duplicates

flatten() (optional) reduce node nesting (can break rigs; avoid by default)

instance() (optional) create EXT\_mesh\_gpu\_instancing (depends)

compressMeshopt() if you choose meshopt route

This is the clean “pure JS” path.
B) gltfpack (external binary)

Very effective for size+runtime perf

Run on Linux easily

Pipeline:

write temp .glb

run gltfpack -i temp.glb -o out.glb ...flags...

replace output
This becomes your “aggressive” preset.

Web UI structure (viewer/editor)
UI panels (good MVP UX)

Left sidebar: asset list + search

Middle: canvas viewer

Right sidebar: tabs

Scene Tree (nodes + meshes)

Materials (list + selected props)

Animations (clips, play controls)

Bottom: timeline-ish (later), or simple animation controls

Viewer tech choices

R3F + drei:

OrbitControls

TransformControls for gizmo (or custom)

Use Three.js GLTFLoader + decoders (draco/meshopt/ktx2) as needed.

State model (important)

selectedAssetPath

selectedNodePath

ops[] (patch log)

previewSceneOverrides (apply ops live in three.js for preview)

dirty flag

When user changes transform:

UI applies it to three.js object (instant feedback)

UI appends/replaces a node.setTransform op for that node (so ops don’t grow unbounded)

“Ops compaction” strategy (so you don’t spam)
Instead of appending 500 ops while dragging gizmo:

Keep a map keyed by op + target, last-write-wins.

Example key: node.setTransform|Root/Armature/Hips

Update value continuously

When exporting, send the compacted list

Security/safety (local app, still worth doing)

Restrict all file reads/writes to rootDir

Normalize paths, block ..

Don’t allow exporting outside rootDir unless explicitly enabled

Bind server to 127.0.0.1 by default

“Next step” I can generate for you immediately
If you want, I’ll output:

package.json + pnpm-workspace.yaml

a minimal server (Express/Fastify) with /api/assets, /asset/\*, /api/export

a minimal web (Vite+React+R3F) with list + viewer + animation player

an example ops roundtrip with transform editing + export

Just tell me if you prefer Express or Fastify, and whether you want R3F (React Three Fiber) or Babylon for the viewer.

---

### **ChatGPT**

Use the techs you deem the fittest for the project and here is an additional requirement I would like for the project: to be AI agent friendly. 
Maybe through cli commands that allow the same features as the web application (including the possibility to generate screenshots of rendered assets to give agent a visual feedback)

---

### **ChatGPT**

Got it. I’d design this as a local “3D asset studio” with two equal front-doors:

Web app for humans (viewer/editor UI)

CLI + machine-friendly JSON for agents/automation — including deterministic screenshots/renders for visual feedback

Below is the stack I’d pick, plus a concrete CLI/API design that keeps everything scriptable.

Tech stack I’d pick (fit + long-term editor ergonomics)
UI (best fit for an editor)

React + Vite + TypeScript

React Three Fiber (R3F) + three.js

@react-three/drei for orbit controls, helpers, environment, etc.

three-stdlib / built-in loaders + decoders

Why: R3F is excellent for building “inspector/editor” UI (scene tree, property panels, gizmos) without fighting the rendering loop.
Backend (local, Node.js)

Fastify (TypeScript) for APIs + static serving

chokidar for watching filesystem changes

Strict rootDir sandbox (only serve/read/write under the folder you launched in)

glTF editing & export (source of truth)

glTF-Transform for safe, deterministic document edits and export (GLB/GLTF)

Optional “aggressive optimize” via gltfpack (external binary) behind a preset

Agent-friendly rendering/screenshots

Playwright (Chromium) to load the viewer route headlessly and take screenshots

It reuses your real renderer (same shaders, same loaders, same camera code)

Works great for “agent sees what a human sees”

Optional: ffmpeg for turntables / animation clips → mp4/gif

On Linux servers without a real display, you can run Chromium headless; if you hit GPU/WebGL issues, provide a documented fallback using xvfb-run (still fully automatable).

Core principle for “AI agent friendly”
Every important feature must be doable via:

CLI subcommands (non-interactive)

Output in JSON (optionally newline-delimited JSON for streams)

Deterministic inputs (camera presets, seeds, fixed resolution, fixed time/frame for animations)

Easy to pipe into other tools (jq, scripts, agents)

The web app becomes “just another client” of the same capabilities.

CLI design (single binary, scriptable)
Command name: gltf-studio
1) Start UI

```bash
gltf-studio serve . --port 7341 --open
```

2) List assets (agent can discover candidates)

```bash
gltf-studio list . --json
```

JSON output

```json
{
  "root": "/abs/path",
  "assets": [
    { "path": "characters/zombie.glb", "bytes": 123456, "mtimeMs": 1739 }
  ]
}
```

3) Inspect metadata (triangles, materials, animations, texture sizes)

```bash
gltf-studio inspect characters/zombie.glb --json
```

4) Render screenshot (the big one)

```bash
gltf-studio render characters/zombie.glb \\
  --out shots/zombie.png \\
  --size 1024x1024 \\
  --camera auto \\
  --bg transparent \\
  --frame 0
```

Other useful modes:

turntable contact sheet (great for agents)

```bash
gltf-studio render characters/zombie.glb \\
  --out shots/zombie\_turntable/ \\
  --turntable 16 \\
  --size 768x768 \\
  --camera auto
```

animation frame (agent can “see” a pose)

```bash
gltf-studio render characters/zombie.glb \\
  --out shots/zombie\_walk\_f120.png \\
  --anim "Walk" --time 4.0 \\
  --camera auto
```

animation clip mp4/gif (optional, uses ffmpeg)

```bash
gltf-studio render characters/zombie.glb \\
  --out shots/zombie\_walk.mp4 \\
  --anim "Walk" --fps 30 --duration 3.0 \\
  --size 720x720
```

5) Apply edits via ops (same edits as UI)

```bash
gltf-studio export characters/zombie.glb \\
  --ops ops/zombie\_edits.json \\
  --preset preview-web \\
  --out characters/zombie.edited.glb \\
  --json
```

6) “Quick ops” flags (agent doesn’t even need JSON sometimes)

```bash
gltf-studio export characters/zombie.glb \\
  --set-node-transform "Root/Hips" "t=0,1,0;r=0,0,0,1;s=1,1,1" \\
  --set-basecolor "ZombieMat" "0.2,0.8,0.2,1.0" \\
  --out characters/zombie.green.glb
```

How screenshots work (reliable + same as UI)
Approach: Headless Playwright hitting a “render route”
You implement a special URL in the web app, e.g.
/render?asset=characters/zombie.glb&size=1024x1024&camera=auto&anim=Walk&time=2.0&bg=transparent
The CLI render subcommand:

starts the server if not running (or uses --server http://127.0.0.1:7341)

launches Playwright

loads /render?...

waits for window.\_\_RENDER\_READY\_\_ = true

calls page.screenshot({ path })

This is agent-perfect because:

it’s deterministic (same URL params → same result)

it uses the real renderer, not a separate “offline” renderer

it automatically supports whatever features the viewer supports (lighting presets, decoders, postprocessing)

Determinism knobs (important for agents)

fixed resolution

fixed DPR (e.g. --dpr 1)

fixed camera preset (auto, front, top, isometric, or explicit position/target)

explicit animation clip + time OR frame index

fixed environment/lighting preset

Ops schema (shared by UI + CLI)
Keep this exactly the same as before (simple, stable), but add a couple fields that help automation:

meta (optional): who/what generated it

version: for future-proofing

Example ops.json:

```json
{
  "version": 1,
  "ops": [
    { "op": "node.setTransform", "target": { "kind": "nodePath", "path": "Root/Hips" },
      "value": { "translation": [0, 1, 0] } },
    { "op": "material.setBaseColorFactor", "target": { "kind": "materialName", "name": "ZombieMat" },
      "value": [0.2, 0.8, 0.2, 1.0] }
  ]
}
```

Agents can:

create ops directly

or ask the system to generate ops based on inspection

then export and render before/after screenshots to verify

API routes (web app is just a client)
Make the backend the “truth”:

GET /api/assets

GET /api/inspect?path=...

POST /api/export { assetPath, ops, preset, outPath }

POST /api/render optional (but I prefer render-via-URL in the UI for Playwright)

The UI calls these APIs; the CLI can call them too (or call the same internal functions).

Bonus: “agent loop” workflow (super effective)
A typical agent pipeline becomes:

list → find candidates

inspect → choose best asset / detect animations

render --camera auto → screenshot

propose edits → write ops.json

export → produce edited GLB

render edited.glb → compare screenshot(s)

You can even add:

render --compare before.png after.png --out diff.png (simple image diff for automated validation)

What I’d implement first (MVP, but agent-ready)

serve, list, inspect

viewer with /render route

render CLI (Playwright)

ops apply + export preset raw-edit

basic UI editor: transform gizmo + material baseColor + export button

add preview-web preset (prune/dedup, optional meshopt/gltfpack later)

If you want the next step, I can output the exact command/argument spec (flags, defaults, JSON schemas) and a starter implementation skeleton (TypeScript) for:

gltf-studio render using Playwright

/render route in the web app that loads an asset + applies params + signals ready

Just say “generate the skeleton code”, and I’ll drop a clean, copy-pasteable project scaffold.

---

### **ChatGPT**

Let's go 🚀

---

### **ChatGPT**

Alright — here’s a copy-pasteable starter scaffold for a Linux/Node.js project that is:

Web viewer/editor (React + Vite + R3F)

Local backend (Fastify) that scans assets + serves bytes securely

AI/agent-friendly CLI (commander) with:

serve

list

inspect (basic)

render (headless Playwright → screenshot using the same web renderer)

It’s intentionally minimal but correctly structured so you can extend it without rewrites.

0) Create repo

```bash
mkdir gltf-studio && cd gltf-studio
pnpm init -y
```

Create workspace file:
pnpm-workspace.yaml

```yaml
packages:
  - "packages/\*"
```

Root TS config:
tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": true
  }
}
```

Root package:
package.json

```json
{
  "name": "gltf-studio",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "pnpm -r dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  }
}
```

1) Packages
1.1 Server (Fastify)

```bash
mkdir -p packages/server/src
pnpm -C packages/server init -y
pnpm -C packages/server add fastify @fastify/static chokidar fast-glob zod
pnpm -C packages/server add -D typescript tsx @types/node
```

packages/server/package.json

```json
{
  "name": "@gltf-studio/server",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@fastify/static": "^7.0.0",
    "chokidar": "^3.6.0",
    "fast-glob": "^3.3.2",
    "fastify": "^4.26.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.6.0"
  }
}
```

packages/server/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

Server code
packages/server/src/paths.ts

```ts
import path from "node:path";

export function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

/\*\*
 \* Resolve a user-supplied relative path against rootDir safely.
 \* Throws if traversal escapes rootDir.
 \*/
export function resolveUnderRoot(rootDir: string, relPath: string): string {
  const cleanRel = relPath.replace(/^\\/+/, ""); // no leading /
  const abs = path.resolve(rootDir, cleanRel);
  const root = path.resolve(rootDir);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error("Path escapes rootDir");
  }
  return abs;
}
```

packages/server/src/assetIndex.ts

```ts
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { toPosixPath } from "./paths.js";

export type AssetInfo = {
  path: string;     // POSIX relative path
  type: "glb" | "gltf";
  bytes: number;
  mtimeMs: number;
};

export async function scanAssets(rootDir: string): Promise<AssetInfo[]> {
  const entries = await fg(["\*\*/\*.glb", "\*\*/\*.gltf"], {
    cwd: rootDir,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  const out: AssetInfo[] = [];
  for (const rel of entries) {
    const abs = path.join(rootDir, rel);
    const st = await fs.stat(abs);
    const ext = rel.toLowerCase().endsWith(".glb") ? "glb" : "gltf";
    out.push({
      path: toPosixPath(rel),
      type: ext,
      bytes: st.size,
      mtimeMs: st.mtimeMs
    });
  }

  // deterministic order for agents
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
```

packages/server/src/inspect.ts

```ts
import fs from "node:fs/promises";
import path from "node:path";

/\*\*
 \* Very lightweight inspection:
 \* - detects extension
 \* - gltf: counts animations by parsing JSON (best-effort)
 \* - glb: returns unknown (we’ll extend later with glTF-Transform)
 \*/
export async function inspectAsset(absPath: string) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === ".gltf") {
    const txt = await fs.readFile(absPath, "utf8");
    const json = JSON.parse(txt);
    const animations = Array.isArray(json.animations) ? json.animations.length : 0;
    const meshes = Array.isArray(json.meshes) ? json.meshes.length : 0;
    const materials = Array.isArray(json.materials) ? json.materials.length : 0;
    return { kind: "gltf", animations, meshes, materials };
  }
  if (ext === ".glb") {
    // MVP: we’ll upgrade later using glTF-Transform to parse glb properly.
    return { kind: "glb", animations: null, meshes: null, materials: null };
  }
  throw new Error("Unsupported file type");
}
```

packages/server/src/index.ts

```ts
import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { scanAssets } from "./assetIndex.js";
import { resolveUnderRoot } from "./paths.js";
import { inspectAsset } from "./inspect.js";

export type StartServerOpts = {
  rootDir: string;
  port?: number;
  host?: string; // default 127.0.0.1
  webDistDir?: string; // built web output for prod
  webDevProxy?: string; // e.g. http://127.0.0.1:5173 for dev (optional)
};

export async function startServer(opts: StartServerOpts) {
  const rootDir = path.resolve(opts.rootDir);
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 7341;

  const app = Fastify({ logger: true });

  // Serve assets from rootDir under /asset/\* (with traversal protection).
  app.get("/asset/\*", async (req, reply) => {
    const rel = (req.params as any)["\*"] as string;
    try {
      const abs = resolveUnderRoot(rootDir, rel);
      // basic allowlist
      if (!abs.toLowerCase().endsWith(".glb") && !abs.toLowerCase().endsWith(".gltf") &&
          !abs.toLowerCase().match(/\\.(png|jpg|jpeg|webp|ktx2|bin)$/)) {
        reply.code(403).send({ error: "Forbidden file type" });
        return;
      }
      const buf = await fs.readFile(abs);
      reply.header("Cache-Control", "no-cache");
      reply.send(buf);
    } catch (e: any) {
      reply.code(400).send({ error: e?.message ?? "Bad request" });
    }
  });

  // API: list assets
  app.get("/api/assets", async () => {
    const assets = await scanAssets(rootDir);
    return { root: rootDir, assets };
  });

  // API: inspect
  app.get("/api/inspect", async (req, reply) => {
    const schema = z.object({ path: z.string().min(1) });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

    try {
      const abs = resolveUnderRoot(rootDir, parsed.data.path);
      const st = await fs.stat(abs);
      const info = await inspectAsset(abs);
      return { path: parsed.data.path, bytes: st.size, ...info };
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? "Inspect failed" });
    }
  });

  // Web app hosting:
  // - In prod: serve built web dist
  // - In dev: you can run Vite separately and just open that URL.
  if (opts.webDistDir) {
    app.register(staticPlugin, {
      root: path.resolve(opts.webDistDir),
      prefix: "/"
    });

    app.setNotFoundHandler(async (\_req, reply) => {
      // SPA fallback
      reply.type("text/html").send(await fs.readFile(path.join(opts.webDistDir!, "index.html")));
    });
  }

  await app.listen({ port, host });
  return { app, rootDir, port, host };
}

// allow running server directly
if (import.meta.url === \`file://${process.argv[1]}\`) {
  const root = process.env.GLTF\_STUDIO\_ROOT ?? process.cwd();
  const port = process.env.GLTF\_STUDIO\_PORT ? Number(process.env.GLTF\_STUDIO\_PORT) : 7341;
  await startServer({ rootDir: root, port });
}
```

1.2 Web (Vite + React + R3F render route)

```bash
mkdir -p packages/web/src
pnpm -C packages/web init -y
pnpm -C packages/web add react react-dom three @react-three/fiber @react-three/drei
pnpm -C packages/web add -D vite typescript @types/react @types/react-dom
```

packages/web/package.json

```json
{
  "name": "@gltf-studio/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "vite build"
  },
  "dependencies": {
    "@react-three/drei": "^9.115.0",
    "@react-three/fiber": "^8.17.10",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

packages/web/vite.config.ts

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true
  }
});
```

Install plugin-react:

```bash
pnpm -C packages/web add -D @vitejs/plugin-react
```

packages/web/index.html

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>gltf-studio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

packages/web/src/main.tsx

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

App routing (includes /render headless route)
packages/web/src/App.tsx

```tsx
import React from "react";
import ViewerPage from "./ViewerPage";
import RenderPage from "./RenderPage";

function getPath() {
  return window.location.pathname;
}

export default function App() {
  const path = getPath();
  if (path === "/render") return <RenderPage />;
  return <ViewerPage />;
}
```

Minimal viewer page (list + click to view)
packages/web/src/api.ts

```ts
export type AssetInfo = { path: string; type: "glb" | "gltf"; bytes: number; mtimeMs: number };

export async function fetchAssets() {
  const res = await fetch("/api/assets");
  if (!res.ok) throw new Error("Failed to fetch assets");
  return (await res.json()) as { root: string; assets: AssetInfo[] };
}
```

packages/web/src/ViewerPage.tsx

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchAssets } from "./api";
import ViewerCanvas from "./viewer/ViewerCanvas";

export default function ViewerPage() {
  const [assets, setAssets] = useState<{ path: string }[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets().then(d => {
      setAssets(d.assets.map(a => ({ path: a.path })));
      if (d.assets[0]) setSelected(d.assets[0].path);
    }).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return assets;
    return assets.filter(a => a.path.toLowerCase().includes(qq));
  }, [assets, q]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      <div style={{ borderRight: "1px solid #222", padding: 12, overflow: "auto" }}>
        <h3 style={{ margin: "0 0 8px" }}>Assets</h3>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search..."
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(a => (
            <button
              key={a.path}
              onClick={() => setSelected(a.path)}
              style={{
                textAlign: "left",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #333",
                background: selected === a.path ? "#1d2a3a" : "#111",
                color: "#eee",
                cursor: "pointer"
              }}
            >
              {a.path}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        {selected ? (
          <ViewerCanvas assetPath={selected} />
        ) : (
          <div style={{ padding: 24 }}>No asset selected.</div>
        )}
      </div>
    </div>
  );
}
```

Viewer Canvas (R3F + OrbitControls + animations)
packages/web/src/viewer/ViewerCanvas.tsx

```tsx
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import \* as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Props = {
  assetPath: string;
  camera?: "auto" | "front" | "top" | "iso";
  animName?: string | null;
  time?: number | null;
  background?: "solid" | "transparent";
  onReady?: () => void; // used by /render route
};

function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov \* Math.PI) / 180;
  let cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2));
  cameraZ \*= 2.2;

  camera.position.set(center.x, center.y + maxDim \* 0.2, center.z + cameraZ);
  camera.near = Math.max(0.01, maxDim / 100);
  camera.far = cameraZ \* 50;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  return { center, maxDim };
}

function GltfModel({ url, animName, time, onLoaded }: {
  url: string;
  animName?: string | null;
  time?: number | null;
  onLoaded?: (gltf: any, root: THREE.Object3D) => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const [gltf, setGltf] = useState<any>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(url, (g) => {
      setGltf(g);
      mixer.current = g.animations?.length ? new THREE.AnimationMixer(g.scene) : null;
      onLoaded?.(g, g.scene);
    });
  }, [url]);

  useEffect(() => {
    if (!gltf || !mixer.current) return;
    mixer.current.stopAllAction();
    activeAction.current = null;

    const clips: THREE.AnimationClip[] = gltf.animations ?? [];
    if (!clips.length) return;

    const clip = animName
      ? clips.find(c => c.name === animName) ?? clips[0]
      : clips[0];

    const action = mixer.current.clipAction(clip);
    action.reset().play();
    activeAction.current = action;
  }, [gltf, animName]);

  useFrame((\_, dt) => {
    if (!gltf) return;
    if (mixer.current) {
      if (typeof time === "number" && activeAction.current) {
        // deterministic pose: set time directly
        activeAction.current.time = time;
        mixer.current.update(0);
      } else {
        mixer.current.update(dt);
      }
    }
  });

  return gltf ? <primitive ref={group} object={gltf.scene} /> : null;
}

export default function ViewerCanvas(props: Props) {
  const url = useMemo(() => \`/asset/${props.assetPath}\`, [props.assetPath]);

  return (
    <Canvas
      dpr={1}
      gl={{ antialias: true, alpha: props.background === "transparent" }}
      camera={{ fov: 50, position: [0, 1, 3] }}
      onCreated={({ gl }) => {
        // determinism: stable output, no toneMapping surprises
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ width: "100%", height: "100%", background: props.background === "transparent" ? "transparent" : "#0b0e12" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <SceneContent {...props} url={url} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

function SceneContent(props: Props & { url: string }) {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [loadedRoot, setLoadedRoot] = useState<THREE.Object3D | null>(null);

  return (
    <>
      <PerspectiveCameraCapture onCamera={(cam) => (cameraRef.current = cam)} />
      <GltfModel
        url={props.url}
        animName={props.animName}
        time={props.time}
        onLoaded={(\_gltf, root) => {
          setLoadedRoot(root);
          // Fit camera after next tick so bounds are valid
          setTimeout(() => {
            if (cameraRef.current) fitCameraToObject(cameraRef.current, root);
            props.onReady?.();
          }, 0);
        }}
      />
      {loadedRoot ? <GroundShadow target={loadedRoot} /> : null}
    </>
  );
}

function PerspectiveCameraCapture({ onCamera }: { onCamera: (cam: THREE.PerspectiveCamera) => void }) {
  useFrame(({ camera }) => {
    if (camera && (camera as any).isPerspectiveCamera) onCamera(camera as THREE.PerspectiveCamera);
  });
  return null;
}

function GroundShadow({ target }: { target: THREE.Object3D }) {
  // tiny ground plane for context; keep simple for deterministic renders
  const box = new THREE.Box3().setFromObject(target);
  const center = new THREE.Vector3();
  box.getCenter(center);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[center.x, box.min.y - 0.001, center.z]}>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial transparent opacity={0.15} />
    </mesh>
  );
}
```

Headless /render route for Playwright
packages/web/src/RenderPage.tsx

```tsx
import React, { useEffect, useMemo, useState } from "react";
import ViewerCanvas from "./viewer/ViewerCanvas";

function parseSize(s: string | null): { w: number; h: number } {
  const m = (s ?? "").match(/^(\\d+)x(\\d+)$/);
  if (!m) return { w: 1024, h: 1024 };
  return { w: Math.max(1, Number(m[1])), h: Math.max(1, Number(m[2])) };
}

export default function RenderPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const asset = params.get("asset") ?? "";
  const size = parseSize(params.get("size"));
  const camera = (params.get("camera") ?? "auto") as any;
  const bg = (params.get("bg") ?? "solid") as any;

  const anim = params.get("anim"); // optional
  const timeParam = params.get("time");
  const time = timeParam != null ? Number(timeParam) : null;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    (window as any).\_\_RENDER\_READY\_\_ = false;
  }, []);

  useEffect(() => {
    if (ready) (window as any).\_\_RENDER\_READY\_\_ = true;
  }, [ready]);

  // Render page is just canvas on a fixed-size viewport.
  return (
    <div style={{ width: size.w, height: size.h, margin: 0, padding: 0, overflow: "hidden" }}>
      <ViewerCanvas
        assetPath={asset}
        camera={camera}
        background={bg === "transparent" ? "transparent" : "solid"}
        animName={anim}
        time={typeof time === "number" && !Number.isNaN(time) ? time : null}
        onReady={() => setReady(true)}
      />
    </div>
  );
}
```

1.3 CLI (serve/list/inspect/render)

```bash
mkdir -p packages/cli/src
pnpm -C packages/cli init -y
pnpm -C packages/cli add commander execa open
pnpm -C packages/cli add playwright
pnpm -C packages/cli add -D typescript tsx @types/node
pnpm -C packages/cli add @gltf-studio/server@workspace:\*  # link workspace package
```

After installing Playwright, run once:

```bash
pnpm -C packages/cli exec playwright install chromium
```

packages/cli/package.json

```json
{
  "name": "@gltf-studio/cli",
  "private": true,
  "type": "module",
  "bin": {
    "gltf-studio": "dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@gltf-studio/server": "workspace:\*",
    "commander": "^12.1.0",
    "execa": "^9.5.0",
    "open": "^10.1.0",
    "playwright": "^1.48.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.6.0"
  }
}
```

packages/cli/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

CLI code
packages/cli/src/index.ts

```ts
#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import fs from "node:fs/promises";
import open from "open";
import { chromium } from "playwright";
import { startServer } from "@gltf-studio/server";

function parseSize(s: string): { w: number; h: number } {
  const m = s.match(/^(\\d+)x(\\d+)$/);
  if (!m) throw new Error("Invalid --size, expected WxH like 1024x1024");
  return { w: Number(m[1]), h: Number(m[2]) };
}

async function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

const program = new Command();

program
  .name("gltf-studio")
  .description("Local glTF/GLB viewer/editor with agent-friendly CLI")
  .version("0.0.1");

program
  .command("serve")
  .argument("[rootDir]", "Root folder containing assets", ".")
  .option("--port <port>", "Port", "7341")
  .option("--host <host>", "Host", "127.0.0.1")
  .option("--open", "Open browser", false)
  .action(async (rootDir, opts) => {
    const root = path.resolve(rootDir);
    const port = Number(opts.port);
    const host = String(opts.host);

    const { port: actualPort, host: actualHost } = await startServer({ rootDir: root, port, host });
    const url = \`http://${actualHost}:${actualPort}/\`;

    if (opts.open) await open(url);
    console.log(JSON.stringify({ ok: true, url, root }, null, 2));
  });

program
  .command("list")
  .argument("[rootDir]", "Root folder", ".")
  .option("--json", "JSON output", true)
  .action(async (rootDir) => {
    // Use a lightweight in-process server scan via /api would require server running.
    // For MVP: start server briefly? Better: call server scan directly later.
    // For now: start ephemeral server and query it.
    const root = path.resolve(rootDir);
    const { app, host, port } = await startServer({ rootDir: root, port: 0, host: "127.0.0.1" } as any);
    const url = \`http://${host}:${(app.server.address() as any).port}/api/assets\`;

    const res = await fetch(url);
    const json = await res.json();
    await app.close();
    console.log(JSON.stringify(json, null, 2));
  });

program
  .command("inspect")
  .argument("<assetPath>", "Asset path relative to root (or absolute)")
  .option("--root <rootDir>", "Root folder (default cwd)", ".")
  .action(async (assetPath, opts) => {
    const root = path.resolve(opts.root);
    const rel = path.isAbsolute(assetPath) ? path.relative(root, assetPath) : assetPath;

    const { app, host, port } = await startServer({ rootDir: root, port: 0, host: "127.0.0.1" } as any);
    const actualPort = (app.server.address() as any).port;
    const url = \`http://${host}:${actualPort}/api/inspect?path=${encodeURIComponent(rel)}\`;

    const res = await fetch(url);
    const json = await res.json();
    await app.close();
    console.log(JSON.stringify(json, null, 2));
  });

program
  .command("render")
  .argument("<assetPath>", "Asset path relative to root (or absolute)")
  .requiredOption("--out <file>", "Output image file, e.g. shots/zombie.png")
  .option("--root <rootDir>", "Root folder (default cwd)", ".")
  .option("--size <WxH>", "Viewport size", "1024x1024")
  .option("--camera <mode>", "Camera: auto|front|top|iso", "auto")
  .option("--bg <mode>", "Background: solid|transparent", "solid")
  .option("--anim <name>", "Animation clip name")
  .option("--time <seconds>", "Animation time in seconds (deterministic pose)")
  .option("--server <url>", "Use existing server base URL (e.g. http://127.0.0.1:7341)")
  .action(async (assetPath, opts) => {
    const root = path.resolve(opts.root);
    const rel = path.isAbsolute(assetPath) ? path.relative(root, assetPath) : assetPath;

    const { w, h } = parseSize(String(opts.size));
    const camera = String(opts.camera);
    const bg = String(opts.bg);
    const anim = opts.anim ? String(opts.anim) : null;
    const time = opts.time != null ? Number(opts.time) : null;

    let baseUrl = opts.server ? String(opts.server).replace(/\\/+$/, "") : null;
    let closeServer: (() => Promise<void>) | null = null;

    if (!baseUrl) {
      const { app, host } = await startServer({ rootDir: root, port: 0, host: "127.0.0.1" } as any);
      const actualPort = (app.server.address() as any).port;
      baseUrl = \`http://${host}:${actualPort}\`;
      closeServer = async () => app.close();
    }

    const qp = new URLSearchParams();
    qp.set("asset", rel);
    qp.set("size", \`${w}x${h}\`);
    qp.set("camera", camera);
    qp.set("bg", bg);
    if (anim) qp.set("anim", anim);
    if (typeof time === "number" && !Number.isNaN(time)) qp.set("time", String(time));

    const url = \`${baseUrl}/render?${qp.toString()}\`;

    await ensureDirForFile(String(opts.out));

    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1
    });

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Wait for render readiness signal
    await page.waitForFunction(() => (window as any).\_\_RENDER\_READY\_\_ === true, null, { timeout: 60\_000 });

    await page.screenshot({ path: String(opts.out) });

    await browser.close();
    if (closeServer) await closeServer();

    console.log(JSON.stringify({ ok: true, out: opts.out, url }, null, 2));
  });

await program.parseAsync(process.argv);
```

2) Wire dev scripts at workspace level
Add these convenience scripts in each package:
packages/server/package.json already has dev.
packages/web/package.json has dev.
Now run:

```bash
pnpm install
```

3) Run it (dev mode)
Terminal A: start server (serves /api + /asset)

```bash
pnpm -C packages/server dev
```

Terminal B: start web (Vite)

```bash
pnpm -C packages/web dev
```

Open the Vite URL (usually http://127.0.0.1:5173).

Note: in dev, the web app is served by Vite, and the API is on 7341.
Right now the web calls /api/assets relative to its origin, so in dev you’ll want a Vite proxy. Add this:

packages/web/vite.config.ts (update)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:7341",
      "/asset": "http://127.0.0.1:7341"
    }
  }
});
```

Restart Vite.

4) Use CLI (agent-friendly)
From repo root:
Serve from an assets folder

```bash
pnpm -C packages/cli dev serve /path/to/assets --open
```

Render a screenshot (headless, deterministic)

```bash
pnpm -C packages/cli dev render characters/zombie.glb \\
  --root /path/to/assets \\
  --out shots/zombie.png \\
  --size 1024x1024 \\
  --camera auto \\
  --bg solid
```

Render a specific animation pose

```bash
pnpm -C packages/cli dev render characters/zombie.glb \\
  --root /path/to/assets \\
  --out shots/zombie\_walk\_t2.png \\
  --anim "Walk" --time 2.0
```

5) What’s next (I’d implement in this order)

Turntable rendering (--turntable 16) → loop camera around bounds and output numbered PNGs

Proper GLB inspection (animations/meshes/materials) using glTF-Transform

Ops + export endpoint (POST /api/export) and gltf-studio export ...

UI editor basics:

selection by click

transform gizmo

material baseColor/metal/rough sliders

export button (writes \*.edited.glb)

Optional “aggressive optimize” preset via gltfpack

If you say “next: turntable + GLB inspect”, I’ll drop the exact code additions for:

render --turntable N

inspect via glTF-Transform (works for glb + gltf)

---

### **ChatGPT**

Go

---

### **ChatGPT**

Let’s do it — turntable rendering + real GLB/GLTF inspection via glTF-Transform.
Below are drop-in changes/additions. Follow in order.

1) Upgrade server: real inspection (GLB + GLTF) with glTF-Transform
1.1 Install deps

```bash
pnpm -C packages/server add @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions
```

1.2 Replace packages/server/src/inspect.ts with this

```ts
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL\_EXTENSIONS } from "@gltf-transform/extensions";

/\*\*
 \* Full inspection for GLB/GLTF using glTF-Transform.
 \* Deterministic + works for both formats.
 \*/
export async function inspectAsset(absPath: string) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext !== ".glb" && ext !== ".gltf") throw new Error("Unsupported file type");

  const io = new NodeIO().registerExtensions(ALL\_EXTENSIONS);
  const doc = await io.read(absPath);
  const root = doc.getRoot();

  const scenes = root.listScenes().length;
  const nodes = root.listNodes().length;
  const meshes = root.listMeshes().length;
  const materials = root.listMaterials().length;
  const textures = root.listTextures().length;
  const animations = root.listAnimations().length;
  const skins = root.listSkins().length;

  // Primitive + triangle estimate (best-effort)
  let primitives = 0;
  let triangles = 0;

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      primitives++;

      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");

      if (idx) {
        const count = idx.getCount();
        triangles += Math.floor(count / 3);
      } else if (pos) {
        // Non-indexed: assume triangles
        const count = pos.getCount();
        triangles += Math.floor(count / 3);
      }
    }
  }

  // Animation clip names
  const animationNames = root.listAnimations().map(a => a.getName() || "");

  return {
    kind: ext === ".glb" ? "glb" : "gltf",
    scenes,
    nodes,
    meshes,
    primitives,
    materials,
    textures,
    animations,
    skins,
    triangles,
    animationNames
  };
}
```

That’s enough to make inspect useful for agents (they can pick assets with animations, high polycount, etc.).

2) Add orbit/turntable support to the headless render route
We’ll add query params for /render:

orbit = yaw degrees around the model center (0..360)

elev = elevation degrees (default ~15)

radius = multiplier (default 1)

Then the CLI can loop orbit = i \* 360/N.
2.1 Update packages/web/src/viewer/ViewerCanvas.tsx
A) Extend props
Find type Props = { ... } and update it to include orbit controls:

```tsx
type Props = {
  assetPath: string;
  camera?: "auto" | "front" | "top" | "iso";
  animName?: string | null;
  time?: number | null;
  background?: "solid" | "transparent";
  orbitDeg?: number | null;   // NEW
  elevDeg?: number | null;    // NEW
  radiusMul?: number | null;  // NEW
  onReady?: () => void;
};
```

B) Replace fitCameraToObject with a version that returns center+distance

```tsx
function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov \* Math.PI) / 180;
  let distance = Math.abs((maxDim / 2) / Math.tan(fov / 2));
  distance \*= 2.2;

  camera.near = Math.max(0.01, maxDim / 100);
  camera.far = distance \* 50;
  camera.updateProjectionMatrix();

  // default position, can be overridden later
  camera.position.set(center.x, center.y + maxDim \* 0.2, center.z + distance);
  camera.lookAt(center);

  return { center, maxDim, distance };
}
```

C) In SceneContent, after fit, apply orbit if provided
Find the onLoaded handler inside SceneContent and replace the setTimeout block with:

```tsx
setTimeout(() => {
  const cam = cameraRef.current;
  if (cam) {
    const { center, distance } = fitCameraToObject(cam, root);

    // Apply orbit/elevation overrides (used by /render turntable)
    const orbitDeg = typeof props.orbitDeg === "number" ? props.orbitDeg : null;
    const elevDeg = typeof props.elevDeg === "number" ? props.elevDeg : 15;
    const radiusMul = typeof props.radiusMul === "number" ? props.radiusMul : 1;

    if (orbitDeg !== null) {
      const yaw = (orbitDeg \* Math.PI) / 180;
      const elev = (elevDeg \* Math.PI) / 180;

      const r = distance \* radiusMul;
      const x = center.x + r \* Math.cos(elev) \* Math.sin(yaw);
      const y = center.y + r \* Math.sin(elev);
      const z = center.z + r \* Math.cos(elev) \* Math.cos(yaw);

      cam.position.set(x, y, z);
      cam.lookAt(center);
    }
  }

  props.onReady?.();
}, 0);
```

That’s it for the renderer side.

2.2 Update packages/web/src/RenderPage.tsx to read orbit params
Add parsing near the top:

```tsx
  const orbitParam = params.get("orbit");
  const elevParam = params.get("elev");
  const radiusParam = params.get("radius");

  const orbitDeg = orbitParam != null ? Number(orbitParam) : null;
  const elevDeg = elevParam != null ? Number(elevParam) : 15;
  const radiusMul = radiusParam != null ? Number(radiusParam) : 1;
```

Then pass into ViewerCanvas:

```tsx
      <ViewerCanvas
        assetPath={asset}
        camera={camera}
        background={bg === "transparent" ? "transparent" : "solid"}
        animName={anim}
        time={typeof time === "number" && !Number.isNaN(time) ? time : null}
        orbitDeg={typeof orbitDeg === "number" && !Number.isNaN(orbitDeg) ? orbitDeg : null}
        elevDeg={typeof elevDeg === "number" && !Number.isNaN(elevDeg) ? elevDeg : 15}
        radiusMul={typeof radiusMul === "number" && !Number.isNaN(radiusMul) ? radiusMul : 1}
        onReady={() => setReady(true)}
      />
```

3) Add --turntable N to the CLI render command
We’ll generate N images: basename\_000.png, basename\_001.png, …
3.1 Update packages/cli/src/index.ts
A) Add options to the render command
In the render command options, add:

```ts
  .option("--turntable <n>", "Turntable frames (e.g. 16)")
  .option("--elev <deg>", "Elevation degrees for orbit", "15")
  .option("--radius <mul>", "Radius multiplier for orbit distance", "1")
```

B) Update the action logic
Inside .action(async (assetPath, opts) => { ... }):

Parse new opts:

```ts
    const turntable = opts.turntable != null ? Number(opts.turntable) : null;
    const elev = opts.elev != null ? Number(opts.elev) : 15;
    const radius = opts.radius != null ? Number(opts.radius) : 1;
```

Replace the single screenshot logic with a loop if turntable is set.

Replace everything from const qp = new URLSearchParams(); down to the final console.log(...) with this:

```ts
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1
    });

    async function renderOne(outPath: string, orbitDeg: number | null) {
      const qp = new URLSearchParams();
      qp.set("asset", rel);
      qp.set("size", \`${w}x${h}\`);
      qp.set("camera", camera);
      qp.set("bg", bg);
      if (anim) qp.set("anim", anim);
      if (typeof time === "number" && !Number.isNaN(time)) qp.set("time", String(time));

      if (orbitDeg !== null) {
        qp.set("orbit", String(orbitDeg));
        qp.set("elev", String(elev));
        qp.set("radius", String(radius));
      }

      const url = \`${baseUrl}/render?${qp.toString()}\`;

      // Navigate (or re-navigate) and wait for readiness
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window as any).\_\_RENDER\_READY\_\_ === true, null, { timeout: 60\_000 });

      await ensureDirForFile(outPath);
      await page.screenshot({ path: outPath });

      return url;
    }

    let urls: string[] = [];

    if (turntable && Number.isFinite(turntable) && turntable > 1) {
      // output must be a folder OR a filename pattern base; we’ll treat it as a base filename
      const out = String(opts.out);
      const ext = path.extname(out) || ".png";
      const base = ext ? out.slice(0, -ext.length) : out;

      for (let i = 0; i < turntable; i++) {
        const orbitDeg = (i \* 360) / turntable;
        const outPath = \`${base}\_${String(i).padStart(3, "0")}${ext || ".png"}\`;
        const u = await renderOne(outPath, orbitDeg);
        urls.push(u);
      }

      console.log(JSON.stringify({ ok: true, mode: "turntable", frames: turntable, outBase: base, urls }, null, 2));
    } else {
      const u = await renderOne(String(opts.out), null);
      console.log(JSON.stringify({ ok: true, mode: "single", out: opts.out, url: u }, null, 2));
    }

    await browser.close();
    if (closeServer) await closeServer();
```

✅ Now your CLI supports both single-shot renders and multi-frame turntables.

4) Run it
Dev mode (recommended for now)
Terminal A:

```bash
pnpm -C packages/server dev
```

Terminal B:

```bash
pnpm -C packages/web dev
```

Inspect (GLB+GLTF)

```bash
pnpm -C packages/cli dev inspect characters/zombie.glb --root /path/to/assets
```

Single screenshot

```bash
pnpm -C packages/cli dev render characters/zombie.glb \\
  --root /path/to/assets \\
  --out shots/zombie.png \\
  --size 1024x1024
```

Turntable (16 frames)

```bash
pnpm -C packages/cli dev render characters/zombie.glb \\
  --root /path/to/assets \\
  --out shots/zombie.png \\
  --turntable 16 \\
  --size 768x768 \\
  --elev 15 \\
  --radius 1
```

This outputs:

shots/zombie\_000.png

…

shots/zombie\_015.png

5) Next “agent power-up” (tell me “next” and I’ll drop code)

render --contact-sheet (stitch turntable frames into a single PNG grid)

render --anim Walk --duration 2 --fps 30 --out walk.mp4 (ffmpeg integration)

export + ops + presets (raw-edit, preview-web, quest-perf)

Make /render accept an ops payload (URL points to opsId) to render “before/after” automatically

Say the word (“next: contact sheet + ffmpeg mp4”), and we’ll keep stacking.

---