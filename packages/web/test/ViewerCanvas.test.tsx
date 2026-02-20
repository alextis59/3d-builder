// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  frameCallbacks: [] as Array<(state: any, delta: number) => void>,
  loadedUrls: [] as string[],
  orbitProps: [] as any[],
  transformProps: [] as any[],
  gl: { outputColorSpace: null as any },
  camera: null as THREE.PerspectiveCamera | null,
  currentGltf: null as any
}));

vi.mock("@react-three/fiber", async () => {
  const React = await import("react");

  return {
    Canvas: ({ children, onCreated, style }: any) => {
      React.useEffect(() => {
        onCreated?.({ gl: mockState.gl });
        if (mockState.camera) {
          for (const cb of mockState.frameCallbacks) {
            cb({ camera: mockState.camera }, 0.5);
          }
        }
      });

      return React.createElement("div", { "data-testid": "mock-canvas", style }, children);
    },
    useFrame: (callback: (state: any, delta: number) => void) => {
      mockState.frameCallbacks.push(callback);
    }
  };
});

vi.mock("@react-three/drei", async () => {
  const React = await import("react");

  return {
    OrbitControls: (props: any) => {
      mockState.orbitProps.push(props);
      return React.createElement("div", { "data-testid": "orbit-controls" });
    },
    TransformControls: (props: any) => {
      mockState.transformProps.push(props);
      return React.createElement("div", { "data-testid": "transform-controls" });
    }
  };
});

vi.mock("three-stdlib", () => {
  class MockGLTFLoader {
    load(url: string, onLoad: (gltf: any) => void) {
      mockState.loadedUrls.push(url);
      onLoad(mockState.currentGltf);
    }
  }

  return {
    GLTFLoader: MockGLTFLoader
  };
});

import ViewerCanvas from "../src/viewer/ViewerCanvas";

function createGltf(options?: { center?: THREE.Vector3; animations?: THREE.AnimationClip[] }) {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  if (options?.center) mesh.position.copy(options.center);
  scene.add(mesh);

  return {
    scene,
    scenes: [scene],
    animations: options?.animations ?? []
  };
}

function runFrame(delta = 0.5) {
  if (!mockState.camera) throw new Error("Camera is not initialized");
  for (const cb of mockState.frameCallbacks) {
    cb({ camera: mockState.camera }, delta);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});

  mockState.frameCallbacks = [];
  mockState.loadedUrls = [];
  mockState.orbitProps = [];
  mockState.transformProps = [];
  mockState.gl.outputColorSpace = null;
  mockState.currentGltf = null;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  (camera as any).isPerspectiveCamera = true;
  vi.spyOn(camera, "lookAt");
  vi.spyOn(camera, "updateProjectionMatrix");
  mockState.camera = camera;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ViewerCanvas", () => {
  it("loads asset URL, configures canvas, and signals ready", async () => {
    mockState.currentGltf = createGltf();
    const onReady = vi.fn();

    const { container } = render(
      <ViewerCanvas assetPath="models/test.glb" background="transparent" onReady={onReady} />
    );

    await vi.runAllTimersAsync();

    expect(mockState.loadedUrls).toEqual(["/asset/models/test.glb"]);
    expect(mockState.gl.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect((container.firstElementChild as HTMLElement).style.background).toBe("transparent");

    const orbitProps = mockState.orbitProps.at(-1);
    expect(orbitProps).toEqual(
      expect.objectContaining({
        makeDefault: true,
        enableDamping: true,
        dampingFactor: 0.08,
        enabled: true
      })
    );

    expect(container.querySelector("planegeometry")).toBeTruthy();
  });

  it("applies front camera mode after model load", async () => {
    mockState.currentGltf = createGltf({ center: new THREE.Vector3(1, 2, 3) });

    render(<ViewerCanvas assetPath="a.glb" camera="front" onReady={vi.fn()} />);

    await vi.runAllTimersAsync();

    const camera = mockState.camera as THREE.PerspectiveCamera;
    expect(camera.position.x).toBeCloseTo(1, 4);
    expect(camera.position.y).toBeCloseTo(2, 4);
    expect(camera.position.z).toBeGreaterThan(3);
    expect(camera.lookAt).toHaveBeenCalled();
  });

  it("applies top and iso camera modes", async () => {
    mockState.currentGltf = createGltf({ center: new THREE.Vector3(1, 2, 3) });

    const { rerender } = render(<ViewerCanvas assetPath="a.glb" camera="top" onReady={vi.fn()} />);
    await vi.runAllTimersAsync();

    let camera = mockState.camera as THREE.PerspectiveCamera;
    expect(camera.position.x).toBeCloseTo(1, 4);
    expect(camera.position.y).toBeGreaterThan(2);
    expect(camera.position.z).toBeCloseTo(3, 4);

    mockState.currentGltf = createGltf({ center: new THREE.Vector3(1, 2, 3) });
    rerender(<ViewerCanvas assetPath="b.glb" camera="iso" onReady={vi.fn()} />);
    await vi.runAllTimersAsync();

    camera = mockState.camera as THREE.PerspectiveCamera;
    expect(camera.position.x).toBeGreaterThan(1);
    expect(camera.position.y).toBeGreaterThan(2);
    expect(camera.position.z).toBeGreaterThan(3);
  });

  it("applies orbit camera parameters", async () => {
    mockState.currentGltf = createGltf({ center: new THREE.Vector3(1, 2, 3) });

    render(
      <ViewerCanvas
        assetPath="orbit.glb"
        orbitDeg={90}
        elevDeg={0}
        radiusMul={1}
        onReady={vi.fn()}
      />
    );

    await vi.runAllTimersAsync();

    const camera = mockState.camera as THREE.PerspectiveCamera;
    expect(camera.position.x).toBeGreaterThan(5);
    expect(camera.position.y).toBeCloseTo(2, 4);
    expect(camera.position.z).toBeCloseTo(3, 4);
  });

  it("updates animation mixer in playback and fixed-time modes, and stops on cleanup", async () => {
    const clip = new THREE.AnimationClip("Walk", 2, []);
    mockState.currentGltf = createGltf({ animations: [clip] });

    const updateSpy = vi.spyOn(THREE.AnimationMixer.prototype, "update");
    const stopSpy = vi.spyOn(THREE.AnimationMixer.prototype, "stopAllAction");

    const { rerender, unmount } = render(
      <ViewerCanvas assetPath="anim.glb" animName="Walk" play playbackSpeed={2} onReady={vi.fn()} />
    );

    await vi.runAllTimersAsync();
    runFrame(0.5);
    expect(updateSpy).toHaveBeenCalledWith(1);

    updateSpy.mockClear();
    rerender(<ViewerCanvas assetPath="anim.glb" animName="Walk" time={3} onReady={vi.fn()} />);
    await vi.runAllTimersAsync();
    runFrame(0.5);
    expect(updateSpy).toHaveBeenCalledWith(0);

    unmount();
    expect(stopSpy).toHaveBeenCalled();
  });
});
