import { Waves } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

// Paper-design Waves — line patterns ranging from sharp zigzags to smooth
// flowing waves. Crisp graphic look great for editorial.
export const paperWaves: PaperPreset = {
  kind: "paper",
  id: "paper-waves",
  name: "Waves",
  description: "Crisp line patterns ranging from sharp zigzags to flowing waves.",
  Component: Waves,
  schema: [
    { kind: "range", key: "frequency", label: "Frequency", min: 0.1, max: 5, step: 0.05, default: 0.6 },
    { kind: "range", key: "amplitude", label: "Amplitude", min: 0, max: 1, step: 0.01, default: 0.5 },
    { kind: "range", key: "spacing", label: "Spacing", min: 0.05, max: 1, step: 0.01, default: 0.5 },
    { kind: "range", key: "dutyCycle", label: "Duty cycle", min: 0.05, max: 0.95, step: 0.01, default: 0.45 },
    { kind: "range", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, default: 0.5 },
    { kind: "range", key: "rotation", label: "Rotation", min: 0, max: 360, step: 1, default: 0 },
  ],
  defaults: {
    frequency: 0.6,
    amplitude: 0.5,
    spacing: 0.5,
    dutyCycle: 0.45,
    softness: 0.5,
    rotation: 0,
  },
  propsFor: (params, palette) => ({
    colorBack: palette.bg,
    colorFront: palette.primary,
    frequency: params.frequency,
    amplitude: params.amplitude,
    spacing: params.spacing,
    dutyCycle: params.dutyCycle,
    softness: params.softness,
    rotation: params.rotation,
  }),
};
