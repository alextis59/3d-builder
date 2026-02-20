// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ViewerPage from "../src/ViewerPage";

const fetchAssetsMock = vi.fn();
const fetchInspectMock = vi.fn();
const postExportMock = vi.fn();
let lastViewerProps: any = null;

vi.mock("../src/api", () => ({
  fetchAssets: (...args: any[]) => fetchAssetsMock(...args),
  fetchInspect: (...args: any[]) => fetchInspectMock(...args),
  postExport: (...args: any[]) => postExportMock(...args)
}));

vi.mock("../src/viewer/ViewerCanvas", () => ({
  default: (props: any) => {
    lastViewerProps = props;
    return <div data-testid="viewer-canvas">{props.assetPath}</div>;
  }
}));

function makeInspect(path: string, animationNames: string[]) {
  return {
    path,
    bytes: 10,
    kind: "glb" as const,
    scenes: 1,
    nodes: 1,
    meshes: 1,
    primitives: 1,
    materials: 1,
    textures: 0,
    animations: animationNames.length,
    skins: 0,
    triangles: 12,
    animationNames
  };
}

describe("ViewerPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    fetchAssetsMock.mockReset();
    fetchInspectMock.mockReset();
    postExportMock.mockReset();
    lastViewerProps = null;
  });

  it("loads assets, inspects selected asset, and updates controls", async () => {
    fetchAssetsMock.mockResolvedValue({
      root: "/tmp/root",
      assets: [
        { path: "first.glb", type: "glb", bytes: 100, mtimeMs: 1 },
        { path: "second.glb", type: "glb", bytes: 200, mtimeMs: 2 }
      ]
    });

    fetchInspectMock.mockImplementation(async (assetPath: string) => {
      if (assetPath === "second.glb") return makeInspect(assetPath, ["Run", "Jump"]);
      return makeInspect(assetPath, ["Idle"]);
    });

    render(<ViewerPage />);

    await screen.findByRole("button", { name: "first.glb" });
    await waitFor(() => {
      expect(fetchInspectMock).toHaveBeenCalledWith("first.glb");
    });

    await waitFor(() => {
      expect(lastViewerProps.assetPath).toBe("first.glb");
      expect(lastViewerProps.animName).toBe("Idle");
      expect(lastViewerProps.play).toBe(true);
      expect(lastViewerProps.playbackSpeed).toBe(1);
    });

    const searchInput = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "second" } });

    expect(screen.queryByRole("button", { name: "first.glb" })).toBeNull();
    expect(screen.getByRole("button", { name: "second.glb" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "second.glb" }));

    await waitFor(() => {
      expect(fetchInspectMock).toHaveBeenCalledWith("second.glb");
      expect(lastViewerProps.assetPath).toBe("second.glb");
      expect(lastViewerProps.animName).toBe("Run");
    });

    const animSelect = screen.getByLabelText("Animation") as HTMLSelectElement;
    fireEvent.change(animSelect, { target: { value: "Jump" } });
    expect(lastViewerProps.animName).toBe("Jump");

    const pauseButton = screen.getByRole("button", { name: "Pause" });
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
      expect(lastViewerProps.play).toBe(false);
    });

    const speedInput = screen.getByLabelText("Speed") as HTMLInputElement;
    fireEvent.change(speedInput, { target: { value: "2.5" } });
    expect(lastViewerProps.playbackSpeed).toBe(2.5);
  });

  it("builds ops from panel edits and submits export payload", async () => {
    fetchAssetsMock.mockResolvedValue({
      root: "/tmp/root",
      assets: [{ path: "first.glb", type: "glb", bytes: 100, mtimeMs: 1 }]
    });
    fetchInspectMock.mockResolvedValue(makeInspect("first.glb", []));
    postExportMock.mockResolvedValue({
      ok: true,
      outPath: "first.edited.glb",
      format: "glb",
      preset: "raw-edit",
      report: {
        bytesBefore: 100,
        bytesAfter: 90,
        scenes: 1,
        nodes: 1,
        meshes: 1,
        materials: 1,
        textures: 0,
        animations: 0
      }
    });

    render(<ViewerPage />);

    await waitFor(() => {
      expect(lastViewerProps.assetPath).toBe("first.glb");
    });

    lastViewerProps.onSceneData({
      nodes: [
        {
          path: "Scene0/Root",
          name: "Root",
          depth: 0,
          materialNames: ["Body"],
          transform: {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1]
          },
          visible: true
        }
      ],
      materials: [
        {
          name: "Body",
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.5,
          roughnessFactor: 0.5,
          emissiveFactor: [0, 0, 0]
        }
      ]
    });
    lastViewerProps.onNodePick("Scene0/Root");
    lastViewerProps.onSelectionChange({
      path: "Scene0/Root",
      materialNames: ["Body"],
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1]
      },
      visible: true
    });

    lastViewerProps.onTransformCommit({
      path: "Scene0/Root",
      materialNames: ["Body"],
      transform: {
        translation: [2, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1]
      },
      visible: true
    });
    await screen.findByText("Dirty ops: 1");

    const exportButton = screen.getByRole("button", { name: "Export" });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(postExportMock).toHaveBeenCalledTimes(1);
    });

    const body = postExportMock.mock.calls[0][0];
    expect(body.assetPath).toBe("first.glb");
    expect(body.outPath).toBe("first.edited.glb");
    expect(body.ops.version).toBe(1);
    expect(body.ops.ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "node.setTransform",
          target: { kind: "nodePath", path: "Scene0/Root" }
        })
      ])
    );
  });
});
