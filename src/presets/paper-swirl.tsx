import { Swirl, swirlPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = swirlPresets[0].params;

export const paperSwirl: PaperPreset = {
  kind: "paper",
  id: "paper-swirl",
  name: "Swirl",
  description: "Animated bands of color twisting into spirals and flowing arcs.",
  Component: Swirl,
  variants: swirlPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "colorArray", key: "colors", label: "Band colors", maxCount: 10, minCount: 1 },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "bandCount", label: "Band count", min: 1, max: 10, step: 0.1, default: d.bandCount },
    { kind: "range", key: "twist", label: "Twist", min: 0, max: 1, step: 0.01, default: d.twist },
    { kind: "range", key: "center", label: "Center", min: 0, max: 1, step: 0.01, default: d.center },
    { kind: "range", key: "proportion", label: "Proportion", min: 0, max: 1, step: 0.01, default: d.proportion },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
    { kind: "range", key: "noise", label: "Noise", min: 0, max: 1, step: 0.01, default: d.noise },
    { kind: "range", key: "noiseFrequency", label: "Noise frequency", min: 0.1, max: 5, step: 0.05, default: d.noiseFrequency },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    colorBack: params.colorBack,
    speed: params.speed,
    bandCount: params.bandCount,
    twist: params.twist,
    center: params.center,
    proportion: params.proportion,
    softness: params.softness,
    noise: params.noise,
    noiseFrequency: params.noiseFrequency,
  }),
};
