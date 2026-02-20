import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Accessor, Document, NodeIO } from "@gltf-transform/core";

function createTriangleDocument(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();

  const positions = doc
    .createAccessor("positions")
    .setType(Accessor.Type.VEC3)
    .setArray(
      new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ])
    )
    .setBuffer(buffer);

  const indices = doc
    .createAccessor("indices")
    .setType(Accessor.Type.SCALAR)
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer);

  const primitive = doc.createPrimitive().setAttribute("POSITION", positions).setIndices(indices);
  const mesh = doc.createMesh("TriangleMesh").addPrimitive(primitive);
  const node = doc.createNode("TriangleNode").setMesh(mesh);
  doc.createScene("Scene").addChild(node);

  return doc;
}

function createEditableDocument(): Document {
  const doc = createTriangleDocument();
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const node = root.listNodes()[0];
  const mesh = root.listMeshes()[0];
  const primitive = mesh.listPrimitives()[0];

  scene.setName("Scene");
  node.setName("Root");

  const material = doc.createMaterial("Mat").setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0.5).setRoughnessFactor(0.5);
  primitive.setMaterial(material);

  return doc;
}

export async function makeTempDir(prefix = "gltf-studio-test-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function writeTriangleGlb(absPath: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const io = new NodeIO();
  await io.write(absPath, createTriangleDocument());
}

export async function writeTriangleGltf(absPath: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const io = new NodeIO();
  await io.write(absPath, createTriangleDocument());
}

export async function writeEditableGlb(absPath: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const io = new NodeIO();
  await io.write(absPath, createEditableDocument());
}
