import { GemSmoke, gemSmokePresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = gemSmokePresets[0].params;

export const paperLogoGemSmoke: PaperPreset = {
  kind: "paper",
  id: "paper-logo-gem-smoke",
  name: "Logo · Gem Smoke",
  description: "Iridescent gem and smoke effect applied to your uploaded logo.",
  Component: GemSmoke,
  usesImage: true,
  variants: gemSmokePresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "color", key: "colorInner", label: "Inner core" },
    { kind: "colorArray", key: "colors", label: "Gem colors", maxCount: 6, minCount: 1 },
  ],
  schema: [
    {
      kind: "select",
      key: "shape",
      label: "Fallback shape (when no logo)",
      options: [
        { value: "none", label: "None" },
        { value: "circle", label: "Circle" },
        { value: "daisy", label: "Daisy" },
        { value: "diamond", label: "Diamond" },
        { value: "metaballs", label: "Metaballs" },
      ],
      default: (d.shape as string) ?? "metaballs",
    },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "innerDistortion", label: "Inner distortion", min: 0, max: 1, step: 0.01, default: d.innerDistortion },
    { kind: "range", key: "outerDistortion", label: "Outer distortion", min: 0, max: 1, step: 0.01, default: d.outerDistortion },
    { kind: "range", key: "outerGlow", label: "Outer glow", min: 0, max: 1, step: 0.01, default: d.outerGlow },
    { kind: "range", key: "innerGlow", label: "Inner glow", min: 0, max: 1, step: 0.01, default: d.innerGlow },
    { kind: "range", key: "offset", label: "Offset", min: 0, max: 1, step: 0.01, default: d.offset },
    { kind: "range", key: "angle", label: "Angle", min: 0, max: 360, step: 1, default: d.angle },
    { kind: "range", key: "size", label: "Size", min: 0.1, max: 1, step: 0.01, default: d.size },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 2.5, step: 0.05, default: d.scale ?? 0.8 },
  ],
  defaults: { ...d },
  propsFor: (params, _palette, image) => ({
    image: image ?? undefined,
    shape: image ? undefined : params.shape ?? "metaballs",
    colors: params.colors,
    colorBack: params.colorBack,
    colorInner: params.colorInner,
    speed: params.speed,
    innerDistortion: params.innerDistortion,
    outerDistortion: params.outerDistortion,
    outerGlow: params.outerGlow,
    innerGlow: params.innerGlow,
    offset: params.offset,
    angle: params.angle,
    size: params.size,
    scale: params.scale,
    fit: "contain",
  }),
};
