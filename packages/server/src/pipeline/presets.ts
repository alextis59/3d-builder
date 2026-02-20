import type { Document } from "@gltf-transform/core";
import { dedup, prune, weld } from "@gltf-transform/functions";
import type { ExportPreset } from "@gltf-studio/shared";

export async function applyPreset(doc: Document, preset: ExportPreset): Promise<void> {
  if (preset === "raw-edit") return;

  if (preset === "preview-web") {
    await doc.transform(prune(), dedup(), weld());
    return;
  }
}
