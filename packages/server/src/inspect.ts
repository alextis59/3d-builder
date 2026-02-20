import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

export type InspectInfo = {
  kind: "glb" | "gltf";
  scenes: number;
  nodes: number;
  meshes: number;
  primitives: number;
  materials: number;
  textures: number;
  animations: number;
  skins: number;
  triangles: number;
  animationNames: string[];
};

/**
 * Full inspection for GLB/GLTF using glTF-Transform.
 */
export async function inspectAsset(absPath: string): Promise<InspectInfo> {
  const ext = path.extname(absPath).toLowerCase();
  if (ext !== ".glb" && ext !== ".gltf") {
    throw new Error("Unsupported file type");
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(absPath);
  const root = doc.getRoot();

  let primitives = 0;
  let triangles = 0;

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      primitives += 1;
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      if (idx) {
        triangles += Math.floor(idx.getCount() / 3);
      } else if (pos) {
        triangles += Math.floor(pos.getCount() / 3);
      }
    }
  }

  const animationNames = root
    .listAnimations()
    .map((anim) => anim.getName() || "")
    .filter((name) => name.length > 0);

  return {
    kind: ext === ".glb" ? "glb" : "gltf",
    scenes: root.listScenes().length,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    primitives,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    animations: root.listAnimations().length,
    skins: root.listSkins().length,
    triangles,
    animationNames
  };
}
