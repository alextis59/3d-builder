import type { ExportFormat, ExportPreset, OpsDoc } from "@gltf-studio/shared";

export type AssetInfo = {
  path: string;
  type: "glb" | "gltf";
  bytes: number;
  mtimeMs: number;
};

export type InspectInfo = {
  path: string;
  bytes: number;
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

export type ExportResponse = {
  ok: true;
  outPath: string;
  format: ExportFormat;
  preset: ExportPreset;
  report: ExportReport;
};

export async function fetchAssets() {
  const res = await fetch("/api/assets");
  if (!res.ok) throw new Error("Failed to fetch assets");
  return (await res.json()) as { root: string; assets: AssetInfo[] };
}

export async function fetchInspect(assetPath: string) {
  const qp = new URLSearchParams();
  qp.set("path", assetPath);
  const res = await fetch(`/api/inspect?${qp.toString()}`);
  if (!res.ok) throw new Error("Failed to inspect asset");
  return (await res.json()) as InspectInfo;
}

export async function postExport(body: {
  assetPath: string;
  outPath: string;
  format?: ExportFormat;
  preset?: ExportPreset;
  overwrite?: boolean;
  ops?: OpsDoc;
}) {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let message = "Failed to export asset";
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Keep default message for malformed JSON.
    }
    throw new Error(message);
  }

  return (await res.json()) as ExportResponse;
}
