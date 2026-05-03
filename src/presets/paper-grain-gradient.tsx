import { GrainGradient, grainGradientPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = grainGradientPresets[0].params;

export const paperGrainGradient: PaperPreset = {
  kind: "paper",
  id: "paper-grain-gradient",
  name: "Grain Gradient",
  description: "Multi-color gradients with painterly grain. Editorial / cover art.",
  Component: GrainGradient,
  variants: grainGradientPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "colorArray", key: "colors", label: "Colors", maxCount: 10, minCount: 1 },
  ],
  schema: [
    {
      kind: "select",
      key: "shape",
      label: "Shape",
      options: [
        { value: "wave", label: "Wave" },
        { value: "dots", label: "Dots" },
        { value: "truchet", label: "Truchet" },
        { value: "corners", label: "Corners" },
        { value: "ripple", label: "Ripple" },
        { value: "blob", label: "Blob" },
        { value: "sphere", label: "Sphere" },
      ],
      default: (d.shape as string) ?? "wave",
    },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "intensity", label: "Grain intensity", min: 0, max: 1, step: 0.01, default: d.intensity },
    { kind: "range", key: "noise", label: "Noise", min: 0, max: 1, step: 0.01, default: d.noise },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    colorBack: params.colorBack,
    shape: params.shape,
    speed: params.speed,
    intensity: params.intensity,
    noise: params.noise,
    softness: params.softness,
  }),
};
