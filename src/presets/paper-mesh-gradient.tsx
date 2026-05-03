import { MeshGradient, meshGradientPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = meshGradientPresets[0].params;

export const paperMeshGradient: PaperPreset = {
  kind: "paper",
  id: "paper-mesh-gradient",
  name: "Mesh Gradient",
  description: "Flowing multi-point color gradient. The classic modern wallpaper.",
  Component: MeshGradient,
  variants: meshGradientPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [{ kind: "colorArray", key: "colors", label: "Colors", maxCount: 10, minCount: 2 }],
  schema: [
    { kind: "range", key: "distortion", label: "Distortion", min: 0, max: 1, step: 0.01, default: d.distortion },
    { kind: "range", key: "swirl", label: "Swirl", min: 0, max: 1, step: 0.01, default: d.swirl },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "grainMixer", label: "Grain edges", min: 0, max: 1, step: 0.01, default: d.grainMixer },
    { kind: "range", key: "grainOverlay", label: "Grain overlay", min: 0, max: 1, step: 0.01, default: d.grainOverlay },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    distortion: params.distortion,
    swirl: params.swirl,
    speed: params.speed,
    grainMixer: params.grainMixer,
    grainOverlay: params.grainOverlay,
  }),
};
