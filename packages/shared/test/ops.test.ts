import { describe, expect, it } from "vitest";
import { exportRequestSchema, opsDocSchema } from "../src/ops.js";

describe("opsDocSchema", () => {
  it("accepts valid transform/material operations", () => {
    const parsed = opsDocSchema.parse({
      version: 1,
      ops: [
        {
          op: "node.setTransform",
          target: { kind: "nodePath", path: "Scene/Root" },
          value: { translation: [0, 1, 0] }
        },
        {
          op: "material.setPBR",
          target: { kind: "materialName", name: "Body" },
          value: { metallicFactor: 0.25, roughnessFactor: 0.8 }
        }
      ]
    });

    expect(parsed.ops).toHaveLength(2);
  });

  it("rejects empty transform patch", () => {
    expect(() =>
      opsDocSchema.parse({
        version: 1,
        ops: [
          {
            op: "node.setTransform",
            target: { kind: "nodePath", path: "Scene/Root" },
            value: {}
          }
        ]
      })
    ).toThrow("At least one of translation/rotation/scale must be provided");
  });
});

describe("exportRequestSchema", () => {
  it("parses a minimal export request", () => {
    const parsed = exportRequestSchema.parse({
      assetPath: "models/a.glb",
      outPath: "models/a.edited.glb"
    });

    expect(parsed.assetPath).toBe("models/a.glb");
    expect(parsed.outPath).toBe("models/a.edited.glb");
  });

  it("rejects unknown keys", () => {
    expect(() =>
      exportRequestSchema.parse({
        assetPath: "models/a.glb",
        outPath: "models/a.edited.glb",
        foo: "bar"
      })
    ).toThrow();
  });
});
