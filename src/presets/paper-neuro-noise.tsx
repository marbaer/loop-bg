import { NeuroNoise, neuroNoisePresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = neuroNoisePresets[0].params;

export const paperNeuroNoise: PaperPreset = {
  kind: "paper",
  id: "paper-neuro-noise",
  name: "Neuro Noise",
  description: "Glowing fluid lines forming organic-yet-futuristic networks.",
  Component: NeuroNoise,
  variants: neuroNoisePresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "color", key: "colorMid", label: "Mid" },
    { kind: "color", key: "colorFront", label: "Front" },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 3, step: 0.05, default: d.scale ?? 1.0 },
    { kind: "range", key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.02, default: d.brightness },
    { kind: "range", key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.02, default: d.contrast },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colorFront: params.colorFront,
    colorMid: params.colorMid,
    colorBack: params.colorBack,
    speed: params.speed,
    scale: params.scale,
    brightness: params.brightness,
    contrast: params.contrast,
  }),
};
