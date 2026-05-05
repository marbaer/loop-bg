import { GodRays, godRaysPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = godRaysPresets[0].params;

const customDefaults = {
  ...d,
  speed: 0.75,
  density: 0.19,
  spotty: 0.43,
  midSize: 0.33,
  midIntensity: 0.26,
  intensity: 0.92,
  bloom: 0.52,
  offsetX: 1.0,
  offsetY: -0.76,
};

export const paperGodRays: PaperPreset = {
  kind: "paper",
  id: "paper-god-rays",
  name: "God Rays",
  description: "Light rays radiating from the center. Dramatic, atmospheric.",
  Component: GodRays,
  variants: godRaysPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "color", key: "colorBloom", label: "Bloom tint" },
    { kind: "colorArray", key: "colors", label: "Ray colors", maxCount: 5, minCount: 1 },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: customDefaults.speed },
    { kind: "range", key: "density", label: "Density", min: 0, max: 1, step: 0.01, default: customDefaults.density },
    { kind: "range", key: "spotty", label: "Spotty", min: 0, max: 1, step: 0.01, default: customDefaults.spotty },
    { kind: "range", key: "midSize", label: "Mid size", min: 0, max: 1, step: 0.01, default: customDefaults.midSize },
    { kind: "range", key: "midIntensity", label: "Mid intensity", min: 0, max: 1, step: 0.01, default: customDefaults.midIntensity },
    { kind: "range", key: "intensity", label: "Intensity", min: 0, max: 2, step: 0.02, default: customDefaults.intensity },
    { kind: "range", key: "bloom", label: "Bloom", min: 0, max: 1, step: 0.01, default: customDefaults.bloom },
    { kind: "range", key: "offsetX", label: "Center X", min: -1, max: 1, step: 0.02, default: customDefaults.offsetX },
    { kind: "range", key: "offsetY", label: "Center Y", min: -1, max: 1, step: 0.02, default: customDefaults.offsetY },
  ],
  defaults: customDefaults,
  propsFor: (params) => ({
    colors: params.colors,
    colorBack: params.colorBack,
    colorBloom: params.colorBloom,
    speed: params.speed,
    density: params.density,
    spotty: params.spotty,
    midSize: params.midSize,
    midIntensity: params.midIntensity,
    intensity: params.intensity,
    bloom: params.bloom,
    offsetX: params.offsetX,
    offsetY: params.offsetY,
  }),
};
