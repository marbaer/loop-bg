import { Heatmap, heatmapPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";
import logoImage from "../../public/favicon.png";

const d = heatmapPresets[0].params;

export const paperLogoHeatmap: PaperPreset = {
  kind: "paper",
  id: "paper-logo-heatmap",
  name: "Logo · Heatmap",
  description: "Glowing color wave flowing across your uploaded logo.",
  Component: Heatmap,
  usesImage: true,
  variants: heatmapPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "colorArray", key: "colors", label: "Wave colors", maxCount: 8, minCount: 1 },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "contour", label: "Contour", min: 0, max: 1, step: 0.01, default: d.contour },
    { kind: "range", key: "angle", label: "Angle", min: 0, max: 360, step: 1, default: d.angle },
    { kind: "range", key: "noise", label: "Noise", min: 0, max: 1, step: 0.01, default: d.noise },
    { kind: "range", key: "innerGlow", label: "Inner glow", min: 0, max: 1, step: 0.01, default: d.innerGlow },
    { kind: "range", key: "outerGlow", label: "Outer glow", min: 0, max: 1, step: 0.01, default: d.outerGlow },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 2.5, step: 0.05, default: d.scale ?? 0.8 },
  ],
  defaults: { ...d },
  propsFor: (params, _palette, image) => ({
    image: image ?? logoImage,
    colors: params.colors,
    colorBack: params.colorBack,
    speed: params.speed,
    contour: params.contour,
    angle: params.angle,
    noise: params.noise,
    innerGlow: params.innerGlow,
    outerGlow: params.outerGlow,
    scale: params.scale,
    fit: "contain",
  }),
};
