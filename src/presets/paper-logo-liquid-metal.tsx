import { LiquidMetal, liquidMetalPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";
import logoImage from "../assets/placeholder-logo.png";

const d = liquidMetalPresets[0].params;

const customDefaults = {
  ...d,
  colorBack: "#16161d",
};

export const paperLogoLiquidMetal: PaperPreset = {
  kind: "paper",
  id: "paper-logo-liquid-metal",
  name: "Logo · Liquid Metal",
  description: "Metallic stripes flowing across your uploaded logo.",
  Component: LiquidMetal,
  usesImage: true,
  variants: liquidMetalPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "color", key: "colorTint", label: "Metal tint" },
  ],
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "repetition", label: "Stripe density", min: 1, max: 10, step: 0.1, default: d.repetition },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: d.softness },
    { kind: "range", key: "shiftRed", label: "Red shift", min: -1, max: 1, step: 0.02, default: d.shiftRed },
    { kind: "range", key: "shiftBlue", label: "Blue shift", min: -1, max: 1, step: 0.02, default: d.shiftBlue },
    { kind: "range", key: "distortion", label: "Distortion", min: 0, max: 1, step: 0.01, default: d.distortion },
    { kind: "range", key: "contour", label: "Contour", min: 0, max: 1, step: 0.01, default: d.contour },
    { kind: "range", key: "angle", label: "Angle", min: 0, max: 360, step: 1, default: d.angle },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 2.5, step: 0.05, default: d.scale ?? 0.7 },
  ],
  defaults: customDefaults,
  propsFor: (params, _palette, image) => ({
    image: image ?? logoImage,
    shape: undefined,
    colorBack: params.colorBack,
    colorTint: params.colorTint,
    speed: params.speed,
    repetition: params.repetition,
    softness: params.softness,
    shiftRed: params.shiftRed,
    shiftBlue: params.shiftBlue,
    distortion: params.distortion,
    contour: params.contour,
    angle: params.angle,
    scale: params.scale,
    fit: "contain",
  }),
};
