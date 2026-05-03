import { Warp, warpPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = warpPresets[0].params;

export const paperWarp: PaperPreset = {
  kind: "paper",
  id: "paper-warp",
  name: "Warp",
  description: "Fluid color fields warped by noise. Marbled and smoky.",
  Component: Warp,
  variants: warpPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [{ kind: "colorArray", key: "colors", label: "Colors", maxCount: 10, minCount: 2 }],
  schema: [
    {
      kind: "select",
      key: "shape",
      label: "Pattern",
      options: [
        { value: "checks", label: "Checks" },
        { value: "stripes", label: "Stripes" },
        { value: "edge", label: "Edge" },
      ],
      default: (d.shape as string) ?? "checks",
    },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
    { kind: "range", key: "distortion", label: "Distortion", min: 0, max: 1, step: 0.01, default: d.distortion },
    { kind: "range", key: "swirl", label: "Swirl", min: 0, max: 1, step: 0.01, default: d.swirl },
    { kind: "range", key: "swirlIterations", label: "Swirl iterations", min: 1, max: 20, step: 1, default: d.swirlIterations },
    { kind: "range", key: "shapeScale", label: "Shape scale", min: 0, max: 1, step: 0.01, default: d.shapeScale },
    { kind: "range", key: "proportion", label: "Proportion", min: 0, max: 1, step: 0.01, default: d.proportion },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colors: params.colors,
    rotation: params.rotation ?? 0,
    shape: params.shape,
    speed: params.speed,
    softness: params.softness,
    distortion: params.distortion,
    swirl: params.swirl,
    swirlIterations: params.swirlIterations,
    shapeScale: params.shapeScale,
    proportion: params.proportion,
  }),
};
