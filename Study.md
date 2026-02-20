# Study: Next Features From `Chat.md`

## 1) Purpose and scope

This document focuses on **what is still missing** from the feature roadmap discussed in `Chat.md`, and gives a practical plan to implement those features in the current codebase.

Already implemented (baseline):
- Monorepo structure (`packages/server`, `packages/web`, `packages/cli`)
- Asset discovery/listing
- Secure asset serving under root dir
- GLB/GLTF inspection via glTF-Transform
- Web viewer with animation playback controls
- Headless render route and CLI screenshot rendering
- Turntable rendering (`--turntable`)

This study covers the **next feature set** explicitly discussed in `Chat.md`:
- Export pipeline with ops (`/api/export`, CLI export)
- Editor basics in web UI (selection, transform, material edits, export)
- Optimization presets (including optional `gltfpack`)
- Agent power-ups (contact sheet, ffmpeg output, before/after rendering)
- Agent-friendly parity between UI and CLI

---

## 2) Remaining features from `Chat.md`

## 2.1 Export endpoint and ops pipeline

### Feature
Implement backend export flow:
- `POST /api/export`
- Input: `{ assetPath, ops, preset, outPath, format }`
- Apply ops to a glTF-Transform document
- Optionally apply preset transforms (optimize/compress)
- Write result and return report

### Why it matters
This is the core bridge between "viewer" and "editor": without export, UI changes are transient. It is also required for AI-agent workflows where edits are script-generated.

### Proposed server design
Add these files:
- `packages/server/src/ops/ops.types.ts`
- `packages/server/src/ops/applyOps.ts`
- `packages/server/src/pipeline/presets.ts`
- `packages/server/src/pipeline/exportPipeline.ts`

Keep API wiring in:
- `packages/server/src/index.ts`

### Suggested ops schema (MVP)
Versioned payload:

```json
{
  "version": 1,
  "ops": [
    {
      "op": "node.setTransform",
      "target": { "kind": "nodePath", "path": "Root/Hips" },
      "value": { "translation": [0, 1, 0] }
    },
    {
      "op": "material.setBaseColorFactor",
      "target": { "kind": "materialName", "name": "ZombieMat" },
      "value": [0.2, 0.8, 0.2, 1.0]
    }
  ]
}
```

MVP operations:
- `node.setTransform`
- `node.setVisible`
- `node.rename`
- `material.setBaseColorFactor`
- `material.setPBR` (metallic/roughness/emissive)

### Node/material targeting strategy
- Node target: `nodePath` built from scene traversal (`Scene/Parent/Child`)
- Material target: name-based (`materialName`)

Important caveat:
- Name/path stability can break across large scene edits. For MVP this is acceptable if export starts from original source each time.
- Later improvement: assign stable UUID metadata map during inspect and reuse it across edit sessions.

### Export API contract
Request:

```json
{
  "assetPath": "characters/zombie.glb",
  "format": "glb",
  "outPath": "characters/zombie.edited.glb",
  "preset": "raw-edit",
  "ops": {
    "version": 1,
    "ops": []
  }
}
```

Response:

```json
{
  "ok": true,
  "outPath": "characters/zombie.edited.glb",
  "report": {
    "bytesBefore": 1234567,
    "bytesAfter": 1100344,
    "meshes": 4,
    "materials": 2,
    "textures": 3,
    "animations": 4
  }
}
```

### Implementation steps
1. Parse/validate request with `zod`.
2. Resolve `assetPath` and `outPath` under root sandbox.
3. Read source with `NodeIO`.
4. Build lookup maps for nodes/materials.
5. Apply ops in order (deterministic).
6. Run preset transform chain.
7. Write output (`.glb` or `.gltf`).
8. Return report with before/after stats.

### Security constraints
- Disallow writing outside `rootDir`.
- Optionally enforce output extension and deny overwriting input file unless explicit `overwrite` flag.

---

## 2.2 CLI export command (agent parity)

### Feature
Add `gltf-studio export`:
- `--ops <file>`
- `--preset <name>`
- `--out <file>`
- `--root <dir>`
- `--server <url>` optional
- `--json` output

Also add quick-op flags (optional second step):
- `--set-node-transform`
- `--set-basecolor`

### Why it matters
Agents should not depend on UI for edits. CLI export enables fully automated loops:
- inspect -> generate ops -> export -> render -> compare

### Implementation steps
1. Add `export` command in `packages/cli/src/index.ts`.
2. Read ops JSON file.
3. Validate with same schema (reuse shared package or duplicate initial schema).
4. Call `/api/export` (or invoke server function directly if local mode).
5. Print deterministic JSON response.

### Recommendation
Create a small shared package:
- `packages/shared` containing `ops.types.ts` and `ops.schema.ts`

This avoids API/CLI schema drift.

---

## 2.3 Web editor basics

### Features from `Chat.md`
- Selection by click
- Transform gizmo
- Material sliders (baseColor/metal/rough)
- Export button writing `*.edited.glb`

### Why it matters
This is the minimum UI needed to call the project an editor, not only a viewer.

### Proposed web architecture additions
Add files:
- `packages/web/src/state/editorStore.ts` (Zustand or React context)
- `packages/web/src/viewer/SceneTree.tsx`
- `packages/web/src/viewer/SelectionBridge.tsx` (raycast -> selected node)
- `packages/web/src/viewer/Gizmo.tsx` (TransformControls)
- `packages/web/src/editor/PropertyPanel.tsx`
- `packages/web/src/editor/ops.ts` (derive ops payload)
- `packages/web/src/editor/ExportPanel.tsx`

### Practical implementation notes

#### Selection by click
- Add pointer handler on meshes in loaded scene.
- Store selected node path (not object reference only).
- Highlight selected mesh with outline/emissive overlay.

#### Scene tree
- Build node tree once model loads.
- Clicking tree item updates selected node in canvas.

#### Transform gizmo
- Use `TransformControls` from `drei`/`three-stdlib`.
- Modes: translate/rotate/scale.
- Write deltas to editor state as patch ops.

#### Material controls
- When selected node has material, expose:
  - baseColor factor
  - metallic factor
  - roughness factor
- Apply live preview in scene.
- Also record equivalent ops in dirty state.

#### Dirty state
- Keep source-of-truth ops list (append/replace by target+op type).
- Track `isDirty` and support reset.

#### Export button
- UI sends `POST /api/export` with:
  - current selected asset
  - current ops payload
  - preset + output filename
- Show success/failure and result report.

---

## 2.4 Presets and optimization pipeline

### Feature
Support export presets discussed in `Chat.md`:
- `raw-edit` (only apply ops)
- `preview-web` (safe optimization)
- optional `aggressive` with `gltfpack`

### Recommended preset behavior

#### `raw-edit`
- No optimization
- Preserve content as much as possible

#### `preview-web`
- `prune()`
- `dedup()`
- `weld()` optionally
- texture resize/compress optional (future)

#### `aggressive` (optional)
- Execute `gltfpack` as post-step
- Use conservative defaults first
- Provide warning that output may alter fidelity/compatibility

### Implementation details
- Implement preset pipeline in `packages/server/src/pipeline/exportPipeline.ts`.
- Use `@gltf-transform/functions` for transforms.
- For `gltfpack`, spawn command and capture stdout/stderr in report.

### Risk
- `gltfpack` availability differs by machine.

### Mitigation
- Detect binary on startup.
- If unavailable, return clear error + fallback suggestion.

---

## 2.5 Render power-ups for agents

## 2.5.1 Contact sheet

### Feature
`render --contact-sheet`
- After turntable frames are generated, stitch into one PNG grid.

### Implementation options
- Use `sharp` (recommended) for image compositing.
- Inputs: frame list, columns/rows, tile size.

### CLI flags
- `--contact-sheet`
- `--sheet-cols <n>` default 4
- `--sheet-out <file>` default derived from `--out`

---

## 2.5.2 Animation video output (ffmpeg)

### Feature
`render --anim Walk --duration 3 --fps 30 --out walk.mp4`

### Implementation strategy
1. Render temporary frame sequence (`tmp/frame_%04d.png`).
2. Invoke ffmpeg:
   - `ffmpeg -framerate 30 -i frame_%04d.png -pix_fmt yuv420p out.mp4`
3. Cleanup temp frames unless `--keep-frames`.

### Flags
- `--fps <n>`
- `--duration <seconds>`
- `--codec <libx264|libvpx-vp9|gif>`

### Risk
ffmpeg may be missing.

### Mitigation
- Preflight check (`ffmpeg -version`)
- Return actionable error if unavailable.

---

## 2.5.3 Render with ops (before/after)

### Feature
Enable visual validation of edits without exporting manually first.

Two implementation approaches:

#### A. Temporary exported asset (recommended first)
- `/api/export` to temp file
- render original + temp
- optionally output diff image

#### B. Render route accepts `opsId`
- POST ops to server -> cache document/asset by id
- `/render?asset=...&opsId=...`
- Harder but avoids temp files.

### Recommendation
Start with A for simplicity and reliability.

---

## 2.6 Extra inspect metadata

### Feature
`inspect` currently reports structural counts; extend with:
- texture dimensions + bytes
- approximate memory footprint
- draw-call estimate

### Implementation
- Traverse textures and image resources in glTF-Transform doc.
- Include in `InspectInfo` and CLI output.

This supports smarter agent decision-making before edits.

---

## 2.7 File watching / live asset refresh

### Feature
`chokidar` watch on root assets folder.

### Behavior
- Server emits updates via SSE (`/api/events`) or websocket.
- Web list auto-refreshes on create/delete/rename.

### Why now
Improves UX significantly during asset iteration with low complexity.

---

## 3) Recommended implementation order

## Milestone 1: Export core (highest value)
- Server `/api/export`
- Ops schema + applyOps
- Presets: `raw-edit`, `preview-web`
- CLI `export`

Outcome: first complete edit pipeline.

## Milestone 2: Web editor MVP
- Selection + scene tree
- Transform gizmo
- Material basic edits
- Export UI wiring

Outcome: parity between web and CLI for basic edits.

## Milestone 3: Agent render power-ups
- `--contact-sheet`
- ffmpeg output mode
- before/after helper flow

Outcome: stronger automated visual feedback loop.

## Milestone 4: Optimization + live updates
- optional `gltfpack` preset
- file watcher and UI live refresh
- inspect metadata expansion

Outcome: production-oriented workflow.

---

## 4) Testing strategy

## 4.1 Unit tests
- `resolveUnderRoot` traversal cases
- ops schema validation
- op application logic per op type
- preset selection/dispatch

## 4.2 Integration tests
- `/api/export` success path
- `/api/export` invalid target path blocked
- export + inspect comparison

## 4.3 CLI tests
- `export` JSON output contract
- render turntable count correctness
- contact sheet generation

## 4.4 End-to-end smoke flows
- list -> inspect -> export -> render
- before/after visual artifacts generated

---

## 5) Key risks and mitigations

- **Node path instability**
  - Mitigation: path + fallback index strategy; later stable IDs.

- **External tool dependencies (`ffmpeg`, `gltfpack`)**
  - Mitigation: capability detection and explicit fallback/error messages.

- **Large assets / memory pressure**
  - Mitigation: stream where possible, temp-file lifecycle management, configurable limits.

- **UI/CLI schema drift**
  - Mitigation: shared schema package.

- **Non-deterministic renders**
  - Mitigation: fixed DPR, fixed camera params, explicit animation time/frame.

---

## 6) Concrete near-term task list (actionable)

1. Add `packages/shared` with ops types + zod schema.
2. Implement `packages/server/src/ops/applyOps.ts`.
3. Implement `packages/server/src/pipeline/presets.ts` + `exportPipeline.ts`.
4. Add `POST /api/export` in `packages/server/src/index.ts`.
5. Add `export` command in `packages/cli/src/index.ts`.
6. Add web editor store + basic selection + property panel.
7. Wire export button in web UI.
8. Add `render --contact-sheet`.
9. Add `render --fps/--duration` ffmpeg mode.
10. Add SSE watcher and auto-refresh in asset list.

---

## 7) Definition of done for the next phase

The next phase is complete when all are true:
- A user can edit transform/material in web UI and export an updated GLB.
- The same edits can be done headlessly via CLI `export` + ops file.
- CLI can produce single render, turntable set, and contact sheet.
- `inspect` includes enough metadata for agent selection decisions.
- All major commands return stable machine-readable JSON.

