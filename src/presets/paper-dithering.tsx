import { Dithering, ditheringPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = ditheringPresets[0].params;

export const paperDithering: PaperPreset = {
  kind: "paper",
  id: "paper-dithering",
  name: "Dithering",
  description: "2-color animated dither over noise / dots / waves / ripple / swirl / sphere.",
  Component: Dithering,
  variants: ditheringPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "color", key: "colorFront", label: "Foreground" },
  ],
  schema: [
    {
      kind: "select",
      key: "shape",
      label: "Shape",
      options: [
        { value: "simplex", label: "Simplex" },
        { value: "warp", label: "Warp" },
        { value: "dots", label: "Dots" },
        { value: "wave", label: "Wave" },
        { value: "ripple", label: "Ripple" },
        { value: "swirl", label: "Swirl" },
        { value: "sphere", label: "Sphere" },
      ],
      default: (d.shape as string) ?? "simplex",
    },
    {
      kind: "select",
      key: "type",
      label: "Pattern",
      options: [
        { value: "random", label: "Random" },
        { value: "2x2", label: "2x2 Bayer" },
        { value: "4x4", label: "4x4 Bayer" },
        { value: "8x8", label: "8x8 Bayer" },
      ],
      default: (d.type as string) ?? "8x8",
    },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "size", label: "Size", min: 1, max: 10, step: 0.1, default: d.size },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 2.5, step: 0.05, default: d.scale ?? 1.0 },
  ],
  defaults: { ...d },
  propsFor: (params) => ({
    colorBack: params.colorBack,
    colorFront: params.colorFront,
    shape: params.shape,
    type: params.type,
    speed: params.speed,
    size: params.size,
    scale: params.scale,
  }),
};
