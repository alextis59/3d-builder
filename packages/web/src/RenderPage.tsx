import { useEffect, useMemo, useState } from "react";
import ViewerCanvas from "./viewer/ViewerCanvas";

function parseSize(value: string | null): { w: number; h: number } {
  const match = (value ?? "").match(/^(\d+)x(\d+)$/);
  if (!match) return { w: 1024, h: 1024 };
  return {
    w: Math.max(1, Number(match[1])),
    h: Math.max(1, Number(match[2]))
  };
}

export default function RenderPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const asset = params.get("asset") ?? "";
  const size = parseSize(params.get("size"));
  const camera = (params.get("camera") ?? "auto") as "auto" | "front" | "top" | "iso";
  const bg = (params.get("bg") ?? "solid") as "solid" | "transparent";
  const anim = params.get("anim");
  const timeParam = params.get("time");
  const orbitParam = params.get("orbit");
  const elevParam = params.get("elev");
  const radiusParam = params.get("radius");

  const time = timeParam != null ? Number(timeParam) : null;
  const orbitDeg = orbitParam != null ? Number(orbitParam) : null;
  const elevDeg = elevParam != null ? Number(elevParam) : 15;
  const radiusMul = radiusParam != null ? Number(radiusParam) : 1;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    (window as any).__RENDER_READY__ = false;
  }, []);

  useEffect(() => {
    if (ready) {
      (window as any).__RENDER_READY__ = true;
    }
  }, [ready]);

  return (
    <div style={{ width: size.w, height: size.h, margin: 0, padding: 0, overflow: "hidden" }}>
      <ViewerCanvas
        assetPath={asset}
        camera={camera}
        background={bg}
        animName={anim}
        time={typeof time === "number" && !Number.isNaN(time) ? time : null}
        orbitDeg={typeof orbitDeg === "number" && !Number.isNaN(orbitDeg) ? orbitDeg : null}
        elevDeg={typeof elevDeg === "number" && !Number.isNaN(elevDeg) ? elevDeg : 15}
        radiusMul={typeof radiusMul === "number" && !Number.isNaN(radiusMul) ? radiusMul : 1}
        onReady={() => setReady(true)}
      />
    </div>
  );
}
