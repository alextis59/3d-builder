// @vitest-environment jsdom
import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RenderPage from "../src/RenderPage";

let lastViewerProps: any = null;

vi.mock("../src/viewer/ViewerCanvas", () => ({
  default: (props: any) => {
    lastViewerProps = props;
    useEffect(() => {
      props.onReady?.();
    }, [props.onReady]);
    return <div data-testid="viewer-canvas" />;
  }
}));

function setSearch(search: string) {
  window.history.replaceState({}, "", `/render${search}`);
}

describe("RenderPage", () => {
  beforeEach(() => {
    lastViewerProps = null;
    (window as any).__RENDER_READY__ = undefined;
    setSearch("");
  });

  it("parses explicit render query params", async () => {
    setSearch("?asset=models/robot.glb&size=800x600&camera=top&bg=transparent&anim=Walk&time=1.25&orbit=90&elev=20&radius=1.5");

    const { container } = render(<RenderPage />);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(lastViewerProps.assetPath).toBe("models/robot.glb");
    expect(lastViewerProps.camera).toBe("top");
    expect(lastViewerProps.background).toBe("transparent");
    expect(lastViewerProps.animName).toBe("Walk");
    expect(lastViewerProps.time).toBe(1.25);
    expect(lastViewerProps.orbitDeg).toBe(90);
    expect(lastViewerProps.elevDeg).toBe(20);
    expect(lastViewerProps.radiusMul).toBe(1.5);
    expect(wrapper.style.width).toBe("800px");
    expect(wrapper.style.height).toBe("600px");

    await waitFor(() => {
      expect((window as any).__RENDER_READY__).toBe(true);
    });
  });

  it("applies fallback values for invalid params", () => {
    setSearch("?asset=a.glb&size=bad&time=nan&orbit=nan&elev=nan&radius=nan");
    const { container } = render(<RenderPage />);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(lastViewerProps.assetPath).toBe("a.glb");
    expect(lastViewerProps.camera).toBe("auto");
    expect(lastViewerProps.background).toBe("solid");
    expect(lastViewerProps.time).toBe(null);
    expect(lastViewerProps.orbitDeg).toBe(null);
    expect(lastViewerProps.elevDeg).toBe(15);
    expect(lastViewerProps.radiusMul).toBe(1);
    expect(wrapper.style.width).toBe("1024px");
    expect(wrapper.style.height).toBe("1024px");
  });
});
