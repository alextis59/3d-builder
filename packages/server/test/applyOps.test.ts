import fs from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { afterEach, describe, expect, it } from "vitest";
import { applyOps } from "../src/ops/applyOps.js";
import { makeTempDir, writeEditableGlb } from "./fixtures.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("applyOps", () => {
  it("applies transform, visibility, and PBR edits", async () => {
    const root = await makeTempDir("gltf-studio-ops-");
    dirs.push(root);

    const assetPath = path.join(root, "editable.glb");
    await writeEditableGlb(assetPath);

    const io = new NodeIO();
    const doc = await io.read(assetPath);

    applyOps(doc, [
      {
        op: "node.setTransform",
        target: { kind: "nodePath", path: "Scene/Root" },
        value: { translation: [1, 2, 3], scale: [2, 2, 2] }
      },
      {
        op: "node.setVisible",
        target: { kind: "nodePath", path: "Scene/Root" },
        value: { visible: false }
      },
      {
        op: "material.setPBR",
        target: { kind: "materialName", name: "Mat" },
        value: { metallicFactor: 0.1, roughnessFactor: 0.9, emissiveFactor: [0.5, 0.5, 0.5] }
      }
    ]);

    const node = doc.getRoot().listNodes()[0];
    const material = doc.getRoot().listMaterials()[0];

    expect(node.getTranslation()).toEqual([1, 2, 3]);
    expect(node.getScale()).toEqual([2, 2, 2]);
    expect(node.getExtras()).toMatchObject({ gltfStudio: { visible: false } });
    expect(material.getMetallicFactor()).toBe(0.1);
    expect(material.getRoughnessFactor()).toBe(0.9);
    expect(material.getEmissiveFactor()).toEqual([0.5, 0.5, 0.5]);
  });
});
