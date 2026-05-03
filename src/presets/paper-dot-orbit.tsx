import { DotOrbit } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

// Paper-design Dot Orbit — animated dots orbiting around their cell centers.
// Replaces the hand-rolled particles preset.
export const paperDotOrbit: PaperPreset = {
  kind: "paper",
  id: "paper-dot-orbit",
  name: "Dot Orbit",
  description: "Animated dot field with each dot orbiting its cell center.",
  Component: DotOrbit,
  schema: [
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: 0.8 },
    { kind: "range", key: "scale", label: "Density", min: 0.05, max: 1, step: 0.01, default: 0.4 },
    { kind: "range", key: "size", label: "Dot size", min: 0, max: 1, step: 0.01, default: 0.45 },
    { kind: "range", key: "sizeRange", label: "Size variance", min: 0, max: 1, step: 0.01, default: 0.4 },
    { kind: "range", key: "spreading", label: "Spread", min: 0, max: 1, step: 0.01, default: 0.5 },
    { kind: "range", key: "rotation", label: "Rotation", min: 0, max: 360, step: 1, default: 0 },
  ],
  defaults: {
    speed: 0.8,
    scale: 0.4,
    size: 0.45,
    sizeRange: 0.4,
    spreading: 0.5,
    rotation: 0,
  },
  propsFor: (params, palette) => ({
    colors: [palette.primary, palette.secondary, palette.shades[3], palette.shades[1]],
    colorBack: palette.bg,
    speed: params.speed,
    scale: params.scale,
    size: params.size,
    sizeRange: params.sizeRange,
    spreading: params.spreading,
    rotation: params.rotation,
  }),
};
