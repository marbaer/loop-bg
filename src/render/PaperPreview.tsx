import { useEffect, useMemo, useRef } from "react";
import { useStore, useActiveParams } from "../state/store";
import { buildPalette } from "../color/palette";
import type { PaperPreset } from "../presets/types";

/** Wrapper that renders a paper-design/shaders-react component, mapping our
 *  store state (accent / palette / params) into the component's props. The
 *  shader's animation runs internally; we just pass colors + knobs and React
 *  re-renders on store changes. */
export function PaperPreview({ preset }: { preset: PaperPreset }) {
  const params = useActiveParams();
  const accent = useStore((s) => s.accentHex);
  const mode = useStore((s) => s.paletteMode);
  const bgLightness = useStore((s) => s.bgLightness);
  const overrides = useStore((s) => s.paletteOverrides);

  const uploadedImage = useStore((s) => s.uploadedImage);

  const palette = useMemo(
    () => buildPalette(accent, mode, { bgLightness, overrides }),
    [accent, mode, bgLightness, overrides]
  );

  const props = useMemo(
    () => preset.propsFor(params, palette, preset.usesImage ? uploadedImage : null),
    [preset, params, palette, uploadedImage]
  );
  const Component = preset.Component;

  // Track the current paper-design canvas so we can forcibly release its
  // WebGL context when the preset changes or the component unmounts.
  // iOS Safari caps total WebGL contexts at ~8. paper-design's dispose()
  // deletes GL objects but never calls loseContext(), so the context slot
  // isn't freed until GC — which may not run before the next preset tries
  // to create a context. Without this, switching presets enough times causes
  // getContext('webgl2') to return null, which is swallowed silently and
  // leaves a blank canvas.
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
      <Component
        {...props}
        webGlContextAttributes={{ preserveDrawingBuffer: true }}
        style={{ width: "100%", height: "100%", display: "block", ...preset.style }}
      />
    </div>
  );
}
