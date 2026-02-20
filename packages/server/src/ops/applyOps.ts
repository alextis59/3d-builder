import type { Document, Material, Node, Scene } from "@gltf-transform/core";
import type { Op } from "@gltf-studio/shared";

function sceneLabel(scene: Scene, index: number): string {
  const name = scene.getName().trim();
  return name || `Scene${index}`;
}

function nodeLabel(node: Node, index: number): string {
  const name = node.getName().trim();
  return name || `Node${index}`;
}

function collectNodePaths(doc: Document): Map<string, Node> {
  const root = doc.getRoot();
  const map = new Map<string, Node>();

  const appendNode = (node: Node, basePath: string, siblingIndex: number) => {
    const label = nodeLabel(node, siblingIndex);
    const nextPath = `${basePath}/${label}`;
    if (!map.has(nextPath)) {
      map.set(nextPath, node);
    }
    node.listChildren().forEach((child, childIndex) => appendNode(child, nextPath, childIndex));
  };

  root.listScenes().forEach((scene, sceneIndex) => {
    const base = sceneLabel(scene, sceneIndex);
    scene.listChildren().forEach((node, childIndex) => appendNode(node, base, childIndex));
  });

  return map;
}

function collectMaterials(doc: Document): Map<string, Material> {
  const map = new Map<string, Material>();
  for (const material of doc.getRoot().listMaterials()) {
    const name = material.getName().trim();
    if (!name) continue;
    if (map.has(name)) {
      throw new Error(`Duplicate material name "${name}" found; target by name is ambiguous.`);
    }
    map.set(name, material);
  }
  return map;
}

function setNodeVisibility(node: Node, visible: boolean) {
  const extras = { ...node.getExtras() };
  const studio =
    typeof extras.gltfStudio === "object" && extras.gltfStudio !== null
      ? { ...(extras.gltfStudio as Record<string, unknown>) }
      : {};
  studio.visible = visible;
  extras.gltfStudio = studio;
  node.setExtras(extras);
}

export function applyOps(doc: Document, ops: Op[]): void {
  if (ops.length === 0) return;

  const nodePathMap = collectNodePaths(doc);
  const materialNameMap = collectMaterials(doc);

  for (const op of ops) {
    if (op.op === "node.setTransform") {
      const node = nodePathMap.get(op.target.path);
      if (!node) throw new Error(`Node path not found: ${op.target.path}`);
      if (op.value.translation) node.setTranslation(op.value.translation);
      if (op.value.rotation) node.setRotation(op.value.rotation);
      if (op.value.scale) node.setScale(op.value.scale);
      continue;
    }

    if (op.op === "node.setVisible") {
      const node = nodePathMap.get(op.target.path);
      if (!node) throw new Error(`Node path not found: ${op.target.path}`);
      setNodeVisibility(node, op.value.visible);
      continue;
    }

    if (op.op === "node.rename") {
      const node = nodePathMap.get(op.target.path);
      if (!node) throw new Error(`Node path not found: ${op.target.path}`);
      node.setName(op.value.name);
      continue;
    }

    if (op.op === "material.setBaseColorFactor") {
      const material = materialNameMap.get(op.target.name);
      if (!material) throw new Error(`Material name not found: ${op.target.name}`);
      material.setBaseColorFactor(op.value);
      continue;
    }

    if (op.op === "material.setPBR") {
      const material = materialNameMap.get(op.target.name);
      if (!material) throw new Error(`Material name not found: ${op.target.name}`);
      if (typeof op.value.metallicFactor === "number") material.setMetallicFactor(op.value.metallicFactor);
      if (typeof op.value.roughnessFactor === "number") material.setRoughnessFactor(op.value.roughnessFactor);
      if (op.value.emissiveFactor) material.setEmissiveFactor(op.value.emissiveFactor);
      continue;
    }
  }
}
