import { SmokeRing, smokeRingPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = smokeRingPresets[0].params;

export const paperSmokeRing: PaperPreset = {
  kind: "paper",
  id: "paper-smoke-ring",
  name: "Smoke Ring",
  description: "Radial smoky gradient with layered noise. Atmospheric, calm.",
  Component: SmokeRing,
  variants: smokeRingPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "colorArray", key: "colors", label: "Ring colors", maxCount: 10, minCount: 1 },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "noiseScale", label: "Noise scale", min: 0.5, max: 5, step: 0.1, default: d.noiseScale },
    { kind: "range", key: "thickness", label: "Thickness", min: 0, max: 1, step: 0.01, default: d.thickness },
    { kind: "range", key: "radius", label: "Radius", min: 0, max: 1, step: 0.01, default: d.radius },
    { kind: "range", key: "innerShape", label: "Inner shape", min: 0, max: 4, step: 0.05, default: d.innerShape },
    { kind: "int", key: "noiseIterations", label: "Noise iterations", min: 1, max: 8, default: d.noiseIterations },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    colorBack: params.colorBack,
    speed: params.speed,
    noiseScale: params.noiseScale,
    thickness: params.thickness,
    radius: params.radius,
    innerShape: params.innerShape,
    noiseIterations: params.noiseIterations,
  }),
};
