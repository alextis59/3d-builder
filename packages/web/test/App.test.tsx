// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

vi.mock("../src/RenderPage", () => ({
  default: () => <div>render-page</div>
}));

vi.mock("../src/ViewerPage", () => ({
  default: () => <div>viewer-page</div>
}));

function setPath(pathname: string) {
  window.history.replaceState({}, "", pathname);
}

describe("App", () => {
  beforeEach(() => {
    setPath("/");
  });

  it("renders viewer page for non-render routes", () => {
    setPath("/");
    render(<App />);

    expect(screen.getByText("viewer-page")).toBeTruthy();
  });

  it("renders render page for /render route", () => {
    setPath("/render");
    render(<App />);

    expect(screen.getByText("render-page")).toBeTruthy();
  });
});
