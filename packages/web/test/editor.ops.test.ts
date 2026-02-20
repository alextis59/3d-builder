import { describe, expect, it } from "vitest";
import { toOpsDoc, upsertMaterialBaseColorOp, upsertMaterialPbrOp, upsertNodeTransformOp } from "../src/editor/ops";

describe("editor ops helpers", () => {
  it("creates versioned ops document", () => {
    const op = {
      op: "node.setTransform" as const,
      target: { kind: "nodePath" as const, path: "Scene0/Root" },
      value: { translation: [1, 2, 3] as [number, number, number] }
    };

    expect(toOpsDoc([op])).toEqual({
      version: 1,
      ops: [op]
    });
  });

  it("upserts node transform op by target path", () => {
    const first = upsertNodeTransformOp([], "Scene0/Root", {
      translation: [0, 1, 2]
    });
    const second = upsertNodeTransformOp(first, "Scene0/Root", {
      translation: [3, 4, 5],
      scale: [1, 2, 3]
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0]).toEqual({
      op: "node.setTransform",
      target: { kind: "nodePath", path: "Scene0/Root" },
      value: { translation: [3, 4, 5], scale: [1, 2, 3] }
    });
  });

  it("upserts material ops by material name", () => {
    let ops = upsertMaterialBaseColorOp([], "Body", [0.2, 0.3, 0.4, 1]);
    ops = upsertMaterialBaseColorOp(ops, "Body", [0.5, 0.6, 0.7, 0.8]);
    ops = upsertMaterialPbrOp(ops, "Body", { metallicFactor: 0.2, roughnessFactor: 0.9 });
    ops = upsertMaterialPbrOp(ops, "Body", { metallicFactor: 0.7, roughnessFactor: 0.1 });

    expect(ops).toHaveLength(2);
    expect(ops[0]).toEqual({
      op: "material.setBaseColorFactor",
      target: { kind: "materialName", name: "Body" },
      value: [0.5, 0.6, 0.7, 0.8]
    });
    expect(ops[1]).toEqual({
      op: "material.setPBR",
      target: { kind: "materialName", name: "Body" },
      value: { metallicFactor: 0.7, roughnessFactor: 0.1 }
    });
  });
});

