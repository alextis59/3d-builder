import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import type { Op } from "@gltf-studio/shared";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import type { GLTF } from "three-stdlib";

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type NodeTransformState = {
  translation: Vec3;
  rotation: Vec4;
  scale: Vec3;
};

export type SceneNodeInfo = {
  path: string;
  name: string;
  depth: number;
  materialNames: string[];
  transform: NodeTransformState;
  visible: boolean;
};

export type MaterialInfo = {
  name: string;
  baseColorFactor: Vec4;
  metallicFactor: number;
  roughnessFactor: number;
  emissiveFactor: Vec3;
};

export type SceneData = {
  nodes: SceneNodeInfo[];
  materials: MaterialInfo[];
};

export type SelectionInfo = {
  path: string;
  materialNames: string[];
  transform: NodeTransformState;
  visible: boolean;
};

type Props = {
  assetPath: string;
  camera?: "auto" | "front" | "top" | "iso";
  animName?: string | null;
  time?: number | null;
  play?: boolean;
  playbackSpeed?: number;
  background?: "solid" | "transparent";
  orbitDeg?: number | null;
  elevDeg?: number | null;
  radiusMul?: number | null;
  ops?: Op[];
  selectedNodePath?: string | null;
  transformMode?: "translate" | "rotate" | "scale";
  onSceneData?: (data: SceneData) => void;
  onNodePick?: (path: string | null) => void;
  onSelectionChange?: (selection: SelectionInfo | null) => void;
  onTransformCommit?: (selection: SelectionInfo) => void;
  onReady?: () => void;
};

type BaseNodeState = {
  translation: Vec3;
  rotation: Vec4;
  scale: Vec3;
  visible: boolean;
};

type BaseMaterialState = {
  baseColorFactor: Vec4;
  metallicFactor: number;
  roughnessFactor: number;
  emissiveFactor: Vec3;
};

type SceneMaps = {
  pathToObject: Map<string, THREE.Object3D>;
  objectToPath: Map<THREE.Object3D, string>;
  nodeBase: Map<string, BaseNodeState>;
  materialBase: Map<string, BaseMaterialState>;
  materialRefs: Map<string, THREE.MeshStandardMaterial[]>;
  data: SceneData;
};

function toVec3(source: THREE.Vector3): Vec3 {
  return [source.x, source.y, source.z];
}

function toVec4(source: THREE.Quaternion): Vec4 {
  return [source.x, source.y, source.z, source.w];
}

function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = (camera.fov * Math.PI) / 180;
  let distance = Math.abs((maxDim / 2) / Math.tan(fov / 2));
  distance *= 2.2;

  camera.near = Math.max(0.01, maxDim / 100);
  camera.far = distance * 50;
  camera.updateProjectionMatrix();

  camera.position.set(center.x, center.y + maxDim * 0.2, center.z + distance);
  camera.lookAt(center);

  return { center, maxDim, distance };
}

function applyCameraMode(
  camera: THREE.PerspectiveCamera,
  mode: Props["camera"],
  center: THREE.Vector3,
  distance: number,
  maxDim: number
) {
  if (mode === "front") {
    camera.position.set(center.x, center.y, center.z + distance);
  } else if (mode === "top") {
    camera.position.set(center.x, center.y + distance, center.z);
  } else if (mode === "iso") {
    const d = distance * 0.9;
    camera.position.set(center.x + d, center.y + d * 0.9, center.z + d);
  } else {
    camera.position.set(center.x, center.y + maxDim * 0.2, center.z + distance);
  }
  camera.lookAt(center);
}

function isPbrMaterial(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return (material as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
}

function collectMaterialNamesFromObject(object: THREE.Object3D): string[] {
  const names = new Set<string>();
  object.traverse((candidate) => {
    const mesh = candidate as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (isPbrMaterial(material) && material.name.trim()) {
        names.add(material.name.trim());
      }
    }
  });
  return [...names];
}

function sceneLabel(scene: THREE.Object3D, index: number): string {
  const name = scene.name.trim();
  return name || `Scene${index}`;
}

function nodeLabel(node: THREE.Object3D, index: number): string {
  const name = node.name.trim();
  return name || `Node${index}`;
}

function buildSceneMaps(gltf: GLTF): SceneMaps {
  const pathToObject = new Map<string, THREE.Object3D>();
  const objectToPath = new Map<THREE.Object3D, string>();
  const nodeBase = new Map<string, BaseNodeState>();
  const nodes: SceneNodeInfo[] = [];

  const sceneIndex = Math.max(0, gltf.scenes.indexOf(gltf.scene));
  const rootPath = sceneLabel(gltf.scene, sceneIndex);

  const appendNode = (node: THREE.Object3D, basePath: string, siblingIndex: number, depth: number) => {
    const label = nodeLabel(node, siblingIndex);
    const path = `${basePath}/${label}`;

    pathToObject.set(path, node);
    objectToPath.set(node, path);

    const transform: NodeTransformState = {
      translation: toVec3(node.position),
      rotation: toVec4(node.quaternion),
      scale: toVec3(node.scale)
    };

    nodeBase.set(path, {
      ...transform,
      visible: node.visible
    });

    nodes.push({
      path,
      name: label,
      depth,
      materialNames: collectMaterialNamesFromObject(node),
      transform,
      visible: node.visible
    });

    node.children.forEach((child, childIndex) => appendNode(child, path, childIndex, depth + 1));
  };

  gltf.scene.children.forEach((node, childIndex) => appendNode(node, rootPath, childIndex, 0));

  const materialBase = new Map<string, BaseMaterialState>();
  const materialRefs = new Map<string, THREE.MeshStandardMaterial[]>();

  gltf.scene.traverse((candidate) => {
    const mesh = candidate as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!isPbrMaterial(material)) continue;

      const name = material.name.trim();
      if (!name) continue;

      const refs = materialRefs.get(name) ?? [];
      refs.push(material);
      materialRefs.set(name, refs);

      if (!materialBase.has(name)) {
        materialBase.set(name, {
          baseColorFactor: [
            material.color.r,
            material.color.g,
            material.color.b,
            material.opacity
          ],
          metallicFactor: material.metalness,
          roughnessFactor: material.roughness,
          emissiveFactor: [
            material.emissive.r,
            material.emissive.g,
            material.emissive.b
          ]
        });
      }
    }
  });

  const materialData: MaterialInfo[] = [...materialBase.entries()].map(([name, base]) => ({
    name,
    baseColorFactor: base.baseColorFactor,
    metallicFactor: base.metallicFactor,
    roughnessFactor: base.roughnessFactor,
    emissiveFactor: base.emissiveFactor
  }));

  return {
    pathToObject,
    objectToPath,
    nodeBase,
    materialBase,
    materialRefs,
    data: {
      nodes,
      materials: materialData
    }
  };
}

function createSelection(path: string, maps: SceneMaps): SelectionInfo | null {
  const object = maps.pathToObject.get(path);
  if (!object) return null;

  return {
    path,
    materialNames: collectMaterialNamesFromObject(object),
    transform: {
      translation: toVec3(object.position),
      rotation: toVec4(object.quaternion),
      scale: toVec3(object.scale)
    },
    visible: object.visible
  };
}

function restoreFromBase(maps: SceneMaps) {
  for (const [path, state] of maps.nodeBase.entries()) {
    const object = maps.pathToObject.get(path);
    if (!object) continue;

    object.position.set(...state.translation);
    object.quaternion.set(...state.rotation);
    object.scale.set(...state.scale);
    object.visible = state.visible;
  }

  for (const [name, base] of maps.materialBase.entries()) {
    const refs = maps.materialRefs.get(name) ?? [];
    for (const material of refs) {
      material.color.setRGB(
        base.baseColorFactor[0],
        base.baseColorFactor[1],
        base.baseColorFactor[2]
      );
      material.opacity = base.baseColorFactor[3];
      material.transparent = material.opacity < 1;
      material.metalness = base.metallicFactor;
      material.roughness = base.roughnessFactor;
      material.emissive.setRGB(
        base.emissiveFactor[0],
        base.emissiveFactor[1],
        base.emissiveFactor[2]
      );
      material.needsUpdate = true;
    }
  }
}

function applyOpsToScene(maps: SceneMaps, ops: Op[]) {
  restoreFromBase(maps);

  for (const op of ops) {
    if (op.op === "node.setTransform") {
      const object = maps.pathToObject.get(op.target.path);
      if (!object) continue;
      if (op.value.translation) object.position.set(...op.value.translation);
      if (op.value.rotation) object.quaternion.set(...op.value.rotation);
      if (op.value.scale) object.scale.set(...op.value.scale);
      continue;
    }

    if (op.op === "node.setVisible") {
      const object = maps.pathToObject.get(op.target.path);
      if (!object) continue;
      object.visible = op.value.visible;
      continue;
    }

    if (op.op === "material.setBaseColorFactor") {
      const refs = maps.materialRefs.get(op.target.name) ?? [];
      for (const material of refs) {
        material.color.setRGB(op.value[0], op.value[1], op.value[2]);
        material.opacity = op.value[3];
        material.transparent = material.opacity < 1;
        material.needsUpdate = true;
      }
      continue;
    }

    if (op.op === "material.setPBR") {
      const refs = maps.materialRefs.get(op.target.name) ?? [];
      for (const material of refs) {
        if (typeof op.value.metallicFactor === "number") {
          material.metalness = op.value.metallicFactor;
        }
        if (typeof op.value.roughnessFactor === "number") {
          material.roughness = op.value.roughnessFactor;
        }
        if (op.value.emissiveFactor) {
          material.emissive.setRGB(
            op.value.emissiveFactor[0],
            op.value.emissiveFactor[1],
            op.value.emissiveFactor[2]
          );
        }
        material.needsUpdate = true;
      }
    }
  }
}

function resolvePathFromObject(object: THREE.Object3D, maps: SceneMaps): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const path = maps.objectToPath.get(current);
    if (path) return path;
    current = current.parent;
  }
  return null;
}

function GltfModel({
  url,
  animName,
  time,
  play,
  playbackSpeed,
  onLoaded,
  onPointerDown
}: {
  url: string;
  animName?: string | null;
  time?: number | null;
  play?: boolean;
  playbackSpeed?: number;
  onLoaded?: (gltf: GLTF, root: THREE.Object3D) => void;
  onPointerDown?: (event: { object: THREE.Object3D; stopPropagation: () => void }) => void;
}) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(url, (loaded: GLTF) => {
      if (disposed) return;
      setGltf(loaded);
      mixer.current = loaded.animations?.length ? new THREE.AnimationMixer(loaded.scene) : null;
      onLoaded?.(loaded, loaded.scene);
    });

    return () => {
      disposed = true;
      mixer.current?.stopAllAction();
      mixer.current = null;
      activeAction.current = null;
      setGltf(null);
    };
  }, [url]);

  useEffect(() => {
    if (!gltf || !mixer.current) return;
    mixer.current.stopAllAction();
    activeAction.current = null;

    const clips: THREE.AnimationClip[] = gltf.animations ?? [];
    if (clips.length === 0) return;

    const clip = animName ? clips.find((c) => c.name === animName) ?? clips[0] : clips[0];
    const action = mixer.current.clipAction(clip);
    action.reset().play();
    action.paused = !(play ?? true);
    activeAction.current = action;
  }, [gltf, animName, play]);

  useEffect(() => {
    if (!activeAction.current) return;
    activeAction.current.paused = !(play ?? true);
  }, [play]);

  useFrame((_, delta) => {
    const currentMixer = mixer.current;
    const action = activeAction.current;
    if (!currentMixer || !action) return;

    if (typeof time === "number") {
      const clipDuration = action.getClip().duration || 1;
      const normalized = ((time % clipDuration) + clipDuration) % clipDuration;
      action.time = normalized;
      currentMixer.update(0);
      return;
    }

    if (!play) return;
    const speed = typeof playbackSpeed === "number" ? playbackSpeed : 1;
    currentMixer.update(delta * speed);
  });

  return gltf ? <primitive object={gltf.scene} onPointerDown={onPointerDown as never} /> : null;
}

export default function ViewerCanvas(props: Props) {
  const url = useMemo(() => `/asset/${props.assetPath}`, [props.assetPath]);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  return (
    <Canvas
      dpr={1}
      gl={{ antialias: true, alpha: props.background === "transparent" }}
      camera={{ fov: 50, position: [0, 1, 3] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      onPointerMissed={() => props.onNodePick?.(null)}
      style={{
        width: "100%",
        height: "100%",
        background: props.background === "transparent" ? "transparent" : "#0b0e12"
      }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <Suspense fallback={null}>
        <SceneContent {...props} url={url} onDraggingChanged={(isDragging) => setOrbitEnabled(!isDragging)} />
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} enabled={orbitEnabled} />
    </Canvas>
  );
}

function SceneContent(
  props: Props & {
    url: string;
    onDraggingChanged: (isDragging: boolean) => void;
  }
) {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mapsRef = useRef<SceneMaps | null>(null);
  const [loadedRoot, setLoadedRoot] = useState<THREE.Object3D | null>(null);

  const selectedObject = useMemo(() => {
    if (!props.selectedNodePath) return null;
    return mapsRef.current?.pathToObject.get(props.selectedNodePath) ?? null;
  }, [props.selectedNodePath, loadedRoot]);

  useEffect(() => {
    const maps = mapsRef.current;
    if (!maps) return;

    applyOpsToScene(maps, props.ops ?? []);

    if (!props.selectedNodePath) {
      props.onSelectionChange?.(null);
      return;
    }

    const selection = createSelection(props.selectedNodePath, maps);
    props.onSelectionChange?.(selection);
  }, [props.ops, props.selectedNodePath]);

  return (
    <>
      <PerspectiveCameraCapture onCamera={(camera) => (cameraRef.current = camera)} />
      <GltfModel
        url={props.url}
        animName={props.animName}
        time={props.time}
        play={props.play}
        playbackSpeed={props.playbackSpeed}
        onPointerDown={(event) => {
          event.stopPropagation();
          const maps = mapsRef.current;
          if (!maps) return;

          const path = resolvePathFromObject(event.object, maps);
          if (path) {
            props.onNodePick?.(path);
            const selection = createSelection(path, maps);
            props.onSelectionChange?.(selection);
          }
        }}
        onLoaded={(gltf, root) => {
          setLoadedRoot(root);
          const maps = buildSceneMaps(gltf);
          mapsRef.current = maps;
          applyOpsToScene(maps, props.ops ?? []);
          props.onSceneData?.(maps.data);

          if (!props.selectedNodePath && maps.data.nodes[0]) {
            props.onNodePick?.(maps.data.nodes[0].path);
          }

          if (props.selectedNodePath) {
            const selection = createSelection(props.selectedNodePath, maps);
            props.onSelectionChange?.(selection);
          }

          setTimeout(() => {
            const camera = cameraRef.current;
            if (camera) {
              const { center, maxDim, distance } = fitCameraToObject(camera, root);
              const orbitDeg = typeof props.orbitDeg === "number" ? props.orbitDeg : null;
              const elevDeg = typeof props.elevDeg === "number" ? props.elevDeg : 15;
              const radiusMul = typeof props.radiusMul === "number" ? props.radiusMul : 1;

              if (orbitDeg !== null) {
                const yaw = (orbitDeg * Math.PI) / 180;
                const elev = (elevDeg * Math.PI) / 180;
                const radius = distance * radiusMul;
                const x = center.x + radius * Math.cos(elev) * Math.sin(yaw);
                const y = center.y + radius * Math.sin(elev);
                const z = center.z + radius * Math.cos(elev) * Math.cos(yaw);
                camera.position.set(x, y, z);
                camera.lookAt(center);
              } else {
                applyCameraMode(camera, props.camera, center, distance, maxDim);
              }
            }
            props.onReady?.();
          }, 0);
        }}
      />
      {selectedObject ? (
        <TransformControls
          object={selectedObject}
          mode={props.transformMode ?? "translate"}
          onMouseDown={() => props.onDraggingChanged(true)}
          onObjectChange={() => {
            if (!props.selectedNodePath) return;
            const maps = mapsRef.current;
            if (!maps) return;
            const selection = createSelection(props.selectedNodePath, maps);
            props.onSelectionChange?.(selection);
          }}
          onMouseUp={() => {
            props.onDraggingChanged(false);
            if (!props.selectedNodePath) return;
            const maps = mapsRef.current;
            if (!maps) return;
            const selection = createSelection(props.selectedNodePath, maps);
            if (selection) props.onTransformCommit?.(selection);
          }}
        />
      ) : null}
      {loadedRoot ? <GroundPlane target={loadedRoot} /> : null}
    </>
  );
}

function PerspectiveCameraCapture({ onCamera }: { onCamera: (camera: THREE.PerspectiveCamera) => void }) {
  useFrame(({ camera }) => {
    if ((camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) {
      onCamera(camera as THREE.PerspectiveCamera);
    }
  });
  return null;
}

function GroundPlane({ target }: { target: THREE.Object3D }) {
  const box = new THREE.Box3().setFromObject(target);
  const center = new THREE.Vector3();
  box.getCenter(center);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[center.x, box.min.y - 0.001, center.z]}>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial transparent opacity={0.15} color="#9aa7b9" />
    </mesh>
  );
}
