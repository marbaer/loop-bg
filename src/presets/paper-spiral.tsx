import { Spiral, spiralPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = spiralPresets[0].params;

export const paperSpiral: PaperPreset = {
  kind: "paper",
  id: "paper-spiral",
  name: "Spiral",
  description: "Single-color spiral morphing between geometric and flowing forms.",
  Component: Spiral,
  variants: spiralPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "color", key: "colorFront", label: "Spiral" },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "density", label: "Density", min: 0.1, max: 5, step: 0.05, default: d.density },
    { kind: "range", key: "distortion", label: "Distortion", min: 0, max: 1, step: 0.01, default: d.distortion },
    { kind: "range", key: "strokeWidth", label: "Stroke width", min: 0, max: 1, step: 0.01, default: d.strokeWidth },
    { kind: "range", key: "strokeTaper", label: "Stroke taper", min: 0, max: 1, step: 0.01, default: d.strokeTaper },
    { kind: "range", key: "strokeCap", label: "Stroke cap", min: 0, max: 1, step: 0.01, default: d.strokeCap },
    { kind: "range", key: "noise", label: "Noise", min: 0, max: 1, step: 0.01, default: d.noise },
    { kind: "range", key: "noiseFrequency", label: "Noise frequency", min: 0.1, max: 5, step: 0.05, default: d.noiseFrequency },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colorBack: params.colorBack,
    colorFront: params.colorFront,
    speed: params.speed,
    density: params.density,
    distortion: params.distortion,
    strokeWidth: params.strokeWidth,
    strokeTaper: params.strokeTaper,
    strokeCap: params.strokeCap,
    noise: params.noise,
    noiseFrequency: params.noiseFrequency,
    softness: params.softness,
  }),
};
