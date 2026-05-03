import { SimplexNoise, simplexNoisePresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = simplexNoisePresets[0].params;

export const paperSimplexNoise: PaperPreset = {
  kind: "paper",
  id: "paper-simplex-noise",
  name: "Simplex Curves",
  description: "Multi-color gradient flowing through smooth animated curves.",
  Component: SimplexNoise,
  variants: simplexNoisePresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [{ kind: "colorArray", key: "colors", label: "Colors", maxCount: 10, minCount: 2 }],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "stepsPerColor", label: "Steps per color", min: 1, max: 10, step: 0.1, default: d.stepsPerColor },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 2.5, step: 0.05, default: d.scale ?? 1.0 },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    speed: params.speed,
    stepsPerColor: params.stepsPerColor,
    softness: params.softness,
    scale: params.scale,
  }),
};
