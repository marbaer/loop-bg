import { PulsingBorder, pulsingBorderPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = pulsingBorderPresets[0].params;

export const paperPulsingBorder: PaperPreset = {
  kind: "paper",
  id: "paper-pulsing-border",
  name: "Pulsing Border",
  description: "Luminous trails of color forming a glowing gradient frame.",
  Component: PulsingBorder,
  variants: pulsingBorderPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "colorArray", key: "colors", label: "Trail colors", maxCount: 10, minCount: 1 },
  ],
  schema: [
    {
      kind: "select",
      key: "aspectRatio",
      label: "Aspect ratio",
      options: [
        { value: "auto", label: "Auto (canvas)" },
        { value: "square", label: "Square" },
      ],
      default: (d.aspectRatio as string) ?? "auto",
    },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "roundness", label: "Roundness", min: 0, max: 1, step: 0.01, default: d.roundness },
    { kind: "range", key: "thickness", label: "Thickness", min: 0, max: 0.6, step: 0.01, default: d.thickness },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
    { kind: "range", key: "intensity", label: "Intensity", min: 0, max: 1, step: 0.01, default: d.intensity },
    { kind: "range", key: "bloom", label: "Bloom", min: 0, max: 1, step: 0.01, default: d.bloom },
    { kind: "range", key: "spots", label: "Spots", min: 0, max: 5, step: 0.05, default: d.spots },
    { kind: "range", key: "spotSize", label: "Spot size", min: 0, max: 1, step: 0.01, default: d.spotSize },
    { kind: "range", key: "pulse", label: "Pulse", min: 0, max: 1, step: 0.01, default: d.pulse },
    { kind: "range", key: "smoke", label: "Smoke", min: 0, max: 1, step: 0.01, default: d.smoke },
    { kind: "range", key: "smokeSize", label: "Smoke size", min: 0, max: 1, step: 0.01, default: d.smokeSize },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    colorBack: params.colorBack,
    aspectRatio: params.aspectRatio,
    speed: params.speed,
    roundness: params.roundness,
    thickness: params.thickness,
    margin: params.margin,
    softness: params.softness,
    intensity: params.intensity,
    bloom: params.bloom,
    spots: params.spots,
    spotSize: params.spotSize,
    pulse: params.pulse,
    smoke: params.smoke,
    smokeSize: params.smokeSize,
  }),
};
