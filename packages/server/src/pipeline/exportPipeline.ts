import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { ExportPreset, OpsDoc } from "@gltf-studio/shared";
import { applyOps } from "../ops/applyOps.js";
import { applyPreset } from "./presets.js";

export type ExportReport = {
  bytesBefore: number;
  bytesAfter: number;
  scenes: number;
  nodes: number;
  meshes: number;
  materials: number;
  textures: number;
  animations: number;
};

export async function runExportPipeline(params: {
  sourceAbsPath: string;
  outAbsPath: string;
  ops: OpsDoc;
  preset: ExportPreset;
}): Promise<ExportReport> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const before = await fs.stat(params.sourceAbsPath);
  const doc = await io.read(params.sourceAbsPath);

  applyOps(doc, params.ops.ops);
  await applyPreset(doc, params.preset);

  await fs.mkdir(path.dirname(path.resolve(params.outAbsPath)), { recursive: true });
  await io.write(params.outAbsPath, doc);
  const after = await fs.stat(params.outAbsPath);

  const root = doc.getRoot();
  return {
    bytesBefore: before.size,
    bytesAfter: after.size,
    scenes: root.listScenes().length,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    animations: root.listAnimations().length
  };
}
