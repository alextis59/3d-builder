import { useEffect, useMemo, useState } from "react";
import type { ExportPreset, Op } from "@gltf-studio/shared";
import { fetchAssets, fetchInspect, postExport, type AssetInfo, type ExportResponse, type InspectInfo } from "./api";
import { toOpsDoc, upsertMaterialBaseColorOp, upsertMaterialPbrOp, upsertNodeTransformOp } from "./editor/ops";
import ViewerCanvas, { type MaterialInfo, type SceneData, type SelectionInfo, type Vec3 } from "./viewer/ViewerCanvas";

function defaultOutPath(assetPath: string): string {
  if (assetPath.endsWith(".glb")) return assetPath.replace(/\.glb$/i, ".edited.glb");
  if (assetPath.endsWith(".gltf")) return assetPath.replace(/\.gltf$/i, ".edited.gltf");
  return `${assetPath}.edited.glb`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rgbToHex(rgb: [number, number, number]): string {
  const channels = rgb.map((value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, "0"));
  return `#${channels.join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return [1, 1, 1];
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255
  ];
}

function withVec3Value(vec: Vec3, axis: 0 | 1 | 2, value: number): Vec3 {
  const next: Vec3 = [...vec];
  next[axis] = value;
  return next;
}

function deriveMaterial(materialName: string, sceneData: SceneData | null, ops: Op[]): MaterialInfo | null {
  const base = sceneData?.materials.find((material) => material.name === materialName);
  if (!base) return null;

  const current: MaterialInfo = {
    ...base,
    baseColorFactor: [...base.baseColorFactor],
    emissiveFactor: [...base.emissiveFactor]
  };

  for (const op of ops) {
    if (op.op === "material.setBaseColorFactor" && op.target.name === materialName) {
      current.baseColorFactor = [...op.value];
    }

    if (op.op === "material.setPBR" && op.target.name === materialName) {
      if (typeof op.value.metallicFactor === "number") {
        current.metallicFactor = op.value.metallicFactor;
      }
      if (typeof op.value.roughnessFactor === "number") {
        current.roughnessFactor = op.value.roughnessFactor;
      }
      if (op.value.emissiveFactor) {
        current.emissiveFactor = [...op.value.emissiveFactor];
      }
    }
  }

  return current;
}

export default function ViewerPage() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<InspectInfo | null>(null);
  const [animName, setAnimName] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);

  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [selectedMaterialName, setSelectedMaterialName] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [ops, setOps] = useState<Op[]>([]);

  const [outPath, setOutPath] = useState("");
  const [preset, setPreset] = useState<ExportPreset>("raw-edit");
  const [overwrite, setOverwrite] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);

  useEffect(() => {
    void fetchAssets()
      .then((data) => {
        setAssets(data.assets);
        if (data.assets[0]) setSelected(data.assets[0].path);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  useEffect(() => {
    if (!selected) {
      setInspect(null);
      setAnimName(null);
      return;
    }

    void fetchInspect(selected)
      .then((info) => {
        setInspect(info);
        setAnimName(info.animationNames[0] ?? null);
      })
      .catch((err) => {
        console.error(err);
        setInspect(null);
      });
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setOutPath("");
      setSceneData(null);
      setSelectedNodePath(null);
      setSelection(null);
      setSelectedMaterialName(null);
      setOps([]);
      return;
    }

    setOutPath(defaultOutPath(selected));
    setSceneData(null);
    setSelectedNodePath(null);
    setSelection(null);
    setSelectedMaterialName(null);
    setOps([]);
    setExportError(null);
    setExportResult(null);
  }, [selected]);

  useEffect(() => {
    if (!selection || selection.materialNames.length === 0) {
      setSelectedMaterialName(null);
      return;
    }

    setSelectedMaterialName((current) => {
      if (current && selection.materialNames.includes(current)) return current;
      return selection.materialNames[0] ?? null;
    });
  }, [selection]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => asset.path.toLowerCase().includes(q));
  }, [assets, query]);

  const currentMaterial = useMemo(() => {
    if (!selectedMaterialName) return null;
    return deriveMaterial(selectedMaterialName, sceneData, ops);
  }, [selectedMaterialName, sceneData, ops]);

  const isDirty = ops.length > 0;

  function onTransformAxisChange(axis: 0 | 1 | 2, nextValue: number) {
    if (!selection) return;

    const nextTransform = {
      ...selection.transform,
      translation: withVec3Value(selection.transform.translation, axis, nextValue)
    };

    setSelection({
      ...selection,
      transform: nextTransform
    });

    setOps((currentOps) => upsertNodeTransformOp(currentOps, selection.path, nextTransform));
  }

  function onScaleAxisChange(axis: 0 | 1 | 2, nextValue: number) {
    if (!selection) return;

    const nextTransform = {
      ...selection.transform,
      scale: withVec3Value(selection.transform.scale, axis, nextValue)
    };

    setSelection({
      ...selection,
      transform: nextTransform
    });

    setOps((currentOps) => upsertNodeTransformOp(currentOps, selection.path, nextTransform));
  }

  async function onExport() {
    if (!selected || !outPath) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const result = await postExport({
        assetPath: selected,
        outPath,
        preset,
        overwrite,
        ops: toOpsDoc(ops)
      });
      setExportResult(result);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
      setExportResult(null);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 360px",
        height: "100vh",
        color: "#ebedf0",
        background: "#10141b"
      }}
    >
      <aside style={{ borderRight: "1px solid #232a35", padding: 12, overflow: "auto" }}>
        <h3 style={{ margin: "0 0 8px" }}>Assets</h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{ width: "100%", padding: 8, marginBottom: 10, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {filtered.map((asset) => (
            <button
              key={asset.path}
              onClick={() => setSelected(asset.path)}
              style={{
                textAlign: "left",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #364154",
                background: selected === asset.path ? "#243349" : "#131922",
                color: "#ebedf0",
                cursor: "pointer"
              }}
            >
              {asset.path}
            </button>
          ))}
        </div>

        {inspect ? (
          <div style={{ borderTop: "1px solid #232a35", paddingTop: 10, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              <div>Triangles: {inspect.triangles.toLocaleString()}</div>
              <div>Meshes: {inspect.meshes}</div>
              <div>Materials: {inspect.materials}</div>
              <div>Textures: {inspect.textures}</div>
              <div>Animations: {inspect.animations}</div>
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12 }}>Animation</span>
              <select
                value={animName ?? ""}
                onChange={(e) => setAnimName(e.target.value || null)}
                disabled={inspect.animationNames.length === 0}
                style={{
                  width: "100%",
                  padding: 7,
                  borderRadius: 6,
                  border: "1px solid #364154",
                  background: "#0f131b",
                  color: "#ebedf0"
                }}
              >
                {inspect.animationNames.length === 0 ? <option value="">No animations</option> : null}
                {inspect.animationNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setPlaying((v) => !v)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #364154",
                  background: "#1a2535",
                  color: "#ebedf0",
                  cursor: "pointer"
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                Speed
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: 64, padding: 6, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
                />
              </label>
            </div>
          </div>
        ) : null}
      </aside>

      <main style={{ minWidth: 0, position: "relative" }}>
        {selected ? (
          <ViewerCanvas
            assetPath={selected}
            animName={animName}
            play={playing}
            playbackSpeed={playbackSpeed}
            ops={ops}
            selectedNodePath={selectedNodePath}
            transformMode={transformMode}
            onNodePick={(path) => setSelectedNodePath(path)}
            onSelectionChange={(nextSelection) => setSelection(nextSelection)}
            onTransformCommit={(nextSelection) => {
              setSelection(nextSelection);
              setOps((currentOps) => upsertNodeTransformOp(currentOps, nextSelection.path, nextSelection.transform));
            }}
            onSceneData={(data) => setSceneData(data)}
          />
        ) : (
          <div style={{ padding: 20 }}>No asset selected.</div>
        )}
      </main>

      <aside style={{ borderLeft: "1px solid #232a35", padding: 12, overflow: "auto", display: "grid", gap: 12 }}>
        <section style={{ border: "1px solid #30394a", borderRadius: 8, padding: 10, display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Scene</h3>
          <div style={{ maxHeight: 220, overflow: "auto", display: "grid", gap: 4 }}>
            {sceneData?.nodes.map((node) => (
              <button
                key={node.path}
                onClick={() => setSelectedNodePath(node.path)}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #364154",
                  background: selectedNodePath === node.path ? "#2a3f5f" : "#131922",
                  color: "#ebedf0",
                  cursor: "pointer",
                  paddingLeft: 8 + node.depth * 14
                }}
              >
                {node.name}
              </button>
            ))}
            {!sceneData || sceneData.nodes.length === 0 ? <div style={{ fontSize: 12, opacity: 0.75 }}>No nodes loaded.</div> : null}
          </div>
        </section>

        <section style={{ border: "1px solid #30394a", borderRadius: 8, padding: 10, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Transform</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {(["translate", "rotate", "scale"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTransformMode(mode)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #364154",
                  background: transformMode === mode ? "#2a3f5f" : "#131922",
                  color: "#ebedf0",
                  cursor: "pointer"
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, opacity: 0.8 }}>Click mesh or tree item, then drag gizmo in viewport.</div>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Position XYZ</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {[0, 1, 2].map((axis) => (
                <input
                  key={`pos-${axis}`}
                  type="number"
                  step="0.01"
                  disabled={!selection}
                  value={selection ? selection.transform.translation[axis] : 0}
                  onChange={(event) => onTransformAxisChange(axis as 0 | 1 | 2, Number(event.target.value) || 0)}
                  style={{ padding: 6, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
                />
              ))}
            </div>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Scale XYZ</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {[0, 1, 2].map((axis) => (
                <input
                  key={`scale-${axis}`}
                  type="number"
                  step="0.01"
                  disabled={!selection}
                  value={selection ? selection.transform.scale[axis] : 1}
                  onChange={(event) => onScaleAxisChange(axis as 0 | 1 | 2, Number(event.target.value) || 0)}
                  style={{ padding: 6, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
                />
              ))}
            </div>
          </label>
        </section>

        <section style={{ border: "1px solid #30394a", borderRadius: 8, padding: 10, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Material</h3>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Target material</span>
            <select
              value={selectedMaterialName ?? ""}
              disabled={!selection || selection.materialNames.length === 0}
              onChange={(event) => setSelectedMaterialName(event.target.value || null)}
              style={{ width: "100%", padding: 7, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
            >
              {selection?.materialNames.length ? null : <option value="">No material on selection</option>}
              {selection?.materialNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Base color</span>
            <input
              type="color"
              disabled={!selectedMaterialName || !currentMaterial}
              value={currentMaterial ? rgbToHex([currentMaterial.baseColorFactor[0], currentMaterial.baseColorFactor[1], currentMaterial.baseColorFactor[2]]) : "#ffffff"}
              onChange={(event) => {
                if (!selectedMaterialName || !currentMaterial) return;
                const rgb = hexToRgb(event.target.value);
                setOps((currentOps) =>
                  upsertMaterialBaseColorOp(currentOps, selectedMaterialName, [rgb[0], rgb[1], rgb[2], currentMaterial.baseColorFactor[3]])
                );
              }}
              style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #364154", background: "#0f131b" }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Opacity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              disabled={!selectedMaterialName || !currentMaterial}
              value={currentMaterial?.baseColorFactor[3] ?? 1}
              onChange={(event) => {
                if (!selectedMaterialName || !currentMaterial) return;
                const alpha = clamp01(Number(event.target.value));
                setOps((currentOps) =>
                  upsertMaterialBaseColorOp(currentOps, selectedMaterialName, [
                    currentMaterial.baseColorFactor[0],
                    currentMaterial.baseColorFactor[1],
                    currentMaterial.baseColorFactor[2],
                    alpha
                  ])
                );
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Metallic</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              disabled={!selectedMaterialName || !currentMaterial}
              value={currentMaterial?.metallicFactor ?? 0}
              onChange={(event) => {
                if (!selectedMaterialName || !currentMaterial) return;
                const metallic = clamp01(Number(event.target.value));
                setOps((currentOps) =>
                  upsertMaterialPbrOp(currentOps, selectedMaterialName, {
                    metallicFactor: metallic,
                    roughnessFactor: currentMaterial.roughnessFactor
                  })
                );
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Roughness</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              disabled={!selectedMaterialName || !currentMaterial}
              value={currentMaterial?.roughnessFactor ?? 1}
              onChange={(event) => {
                if (!selectedMaterialName || !currentMaterial) return;
                const roughness = clamp01(Number(event.target.value));
                setOps((currentOps) =>
                  upsertMaterialPbrOp(currentOps, selectedMaterialName, {
                    metallicFactor: currentMaterial.metallicFactor,
                    roughnessFactor: roughness
                  })
                );
              }}
            />
          </label>
        </section>

        <section style={{ border: "1px solid #30394a", borderRadius: 8, padding: 10, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Export</h3>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Dirty ops: {ops.length}</div>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Output path</span>
            <input
              value={outPath}
              onChange={(event) => setOutPath(event.target.value)}
              style={{ width: "100%", padding: 7, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12 }}>Preset</span>
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as ExportPreset)}
              style={{ width: "100%", padding: 7, borderRadius: 6, border: "1px solid #364154", background: "#0f131b", color: "#ebedf0" }}
            >
              <option value="raw-edit">raw-edit</option>
              <option value="preview-web">preview-web</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
            Overwrite existing output
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setOps([])}
              disabled={!isDirty}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid #364154",
                background: "#131922",
                color: "#ebedf0",
                cursor: isDirty ? "pointer" : "not-allowed"
              }}
            >
              Reset edits
            </button>
            <button
              onClick={() => void onExport()}
              disabled={!selected || !outPath || isExporting}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid #364154",
                background: "#1c3550",
                color: "#ebedf0",
                cursor: "pointer"
              }}
            >
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>

          {exportError ? <div style={{ color: "#ff8787", fontSize: 12 }}>{exportError}</div> : null}
          {exportResult ? (
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              <div>Saved: {exportResult.outPath}</div>
              <div>
                Size: {exportResult.report.bytesBefore.toLocaleString()} -&gt; {exportResult.report.bytesAfter.toLocaleString()} bytes
              </div>
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
