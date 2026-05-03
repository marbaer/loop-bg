import { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useStore } from "../state/store";
import { buildPalette } from "../color/palette";
import type { R3FPreset } from "../presets/types";

/** Thin wrapper that drives the loop time t and re-renders the scene each
 *  frame with the current params/palette. Each frame we re-read the store so
 *  UI changes apply immediately (same model as the shader preview). */
function SceneTimeBridge({ preset }: { preset: R3FPreset }) {
  const [, setTick] = useState(0);
  useFrame(() => setTick((n) => (n + 1) % 1_000_000));

  const s = useStore.getState();
  const params = s.paramsByPreset[s.presetId] ?? preset.defaults;
  const palette = buildPalette(s.accentHex, s.paletteMode, {
    bgLightness: s.bgLightness,
    overrides: s.paletteOverrides,
  });
  const dur = Math.max(s.durationSeconds, 1) * 1000;
  const t = (performance.now() / dur) % 1;

  const Scene = preset.Scene;
  return <Scene params={params} palette={palette} t={t} />;
}

export function R3FPreview({ preset }: { preset: R3FPreset }) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
      dpr={Math.min(window.devicePixelRatio || 1, 2)}
      camera={{ position: [0, 0, 5], fov: 35 }}
    >
      <SceneTimeBridge preset={preset} />
    </Canvas>
  );
}
