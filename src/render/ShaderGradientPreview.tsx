import { useCallback, useEffect, useRef } from "react";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { useStore, useActiveParams } from "../state/store";
import type { ShaderGradientPreset } from "../presets/types";

/** Camera fields that ShaderGradient reports back through onCameraUpdate when
 *  the user drags or scrolls. We mirror them into paramsByPreset so the camera
 *  pose persists across preset switches and reloads. */
const CAMERA_KEYS = ["cAzimuthAngle", "cPolarAngle", "cDistance", "cameraZoom"] as const;

export function ShaderGradientPreview({ preset }: { preset: ShaderGradientPreset }) {
  const params = useActiveParams();
  const setParam = useStore((s) => s.setParam);
  const durationSeconds = useStore((s) => s.durationSeconds);

  const onCameraUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      for (const key of CAMERA_KEYS) {
        const v = updates[key];
        if (typeof v === "number" && v !== params[key]) {
          setParam(key, v);
        }
      }
    },
    [params, setParam]
  );

  // Colors are stored as a 3-entry array (so the colorArray UI gives us
  // reordering + brand-kit cycling); ShaderGradient itself takes them as
  // separate color1/2/3 props, so we expand them here.
  const colors = Array.isArray(params.colors) ? (params.colors as string[]) : [];
  const { colors: _drop, ...rest } = params as Record<string, unknown>;
  void _drop;
  // The user's per-preset `loop` toggle decides between two animation modes:
  //   - "on": the GLSL's seamless-loop branch (uLoop=1, 4-sample noise blend
  //     around a closed circle). Mathematically perfect loop, simpler/more
  //     abstract visual, no ping-pong needed for export.
  //   - "off": linear time (animate=on, no loop). Matches upstream's tuned
  //     visual character; the export pipeline mirrors via ping-pong to make
  //     the loop seamless without altering the shader's character.
  const loopOn = rest.loop === "on";
  const sgProps = {
    ...rest,
    color1: colors[0] ?? "#ffffff",
    color2: colors[1] ?? "#ffffff",
    color3: colors[2] ?? "#ffffff",
    ...(loopOn ? { loopDuration: Math.max(durationSeconds, 1) } : {}),
  };

  // iOS Safari caps live WebGL contexts at ~8 and R3F's Canvas does not call
  // loseContext() on unmount. Without explicit disposal, switching presets
  // enough times exhausts the budget and the next mount silently fails to
  // acquire a context. Mirror PaperPreview's MutationObserver + cleanup.
  const hostRef = useRef<HTMLDivElement>(null);
  const savedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const grab = () => {
      const canvas = host.querySelector("canvas") as HTMLCanvasElement | null;
      if (canvas) savedCanvasRef.current = canvas;
    };
    grab();
    const observer = new MutationObserver(grab);
    observer.observe(host, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      const canvas = savedCanvasRef.current;
      savedCanvasRef.current = null;
      if (canvas) {
        (canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
          ?.getExtension("WEBGL_lose_context")
          ?.loseContext();
      }
    };
  }, [preset.id]);

  return (
    <div ref={hostRef} style={{ width: "100%", height: "100%", display: "block" }}>
      <ShaderGradientCanvas style={{ width: "100%", height: "100%" }}>
        <ShaderGradient
          control="props"
          enableCameraUpdate
          onCameraUpdate={onCameraUpdate}
          {...sgProps}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
