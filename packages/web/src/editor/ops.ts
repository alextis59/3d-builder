import type { Op, OpsDoc, PbrPatch, Transform } from "@gltf-studio/shared";

function replaceAt<T>(items: T[], index: number, value: T): T[] {
  return [...items.slice(0, index), value, ...items.slice(index + 1)];
}

export function toOpsDoc(ops: Op[]): OpsDoc {
  return {
    version: 1,
    ops
  };
}

export function upsertNodeTransformOp(ops: Op[], path: string, value: Transform): Op[] {
  const nextOp: Op = {
    op: "node.setTransform",
    target: { kind: "nodePath", path },
    value
  };
  const idx = ops.findIndex((item) => item.op === "node.setTransform" && item.target.path === path);
  if (idx === -1) return [...ops, nextOp];
  return replaceAt(ops, idx, nextOp);
}

export function upsertMaterialBaseColorOp(ops: Op[], materialName: string, value: [number, number, number, number]): Op[] {
  const nextOp: Op = {
    op: "material.setBaseColorFactor",
    target: { kind: "materialName", name: materialName },
    value
  };
  const idx = ops.findIndex(
    (item) => item.op === "material.setBaseColorFactor" && item.target.name === materialName
  );
  if (idx === -1) return [...ops, nextOp];
  return replaceAt(ops, idx, nextOp);
}

export function upsertMaterialPbrOp(ops: Op[], materialName: string, value: PbrPatch): Op[] {
  const nextOp: Op = {
    op: "material.setPBR",
    target: { kind: "materialName", name: materialName },
    value
  };
  const idx = ops.findIndex((item) => item.op === "material.setPBR" && item.target.name === materialName);
  if (idx === -1) return [...ops, nextOp];
  return replaceAt(ops, idx, nextOp);
}

