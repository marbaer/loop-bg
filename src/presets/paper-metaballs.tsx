import { Metaballs, metaballsPresets } from "@paper-design/shaders-react";
import type { PaperPreset } from "./types";

const d = metaballsPresets[0].params;

const customDefaults = {
  ...d,
  colorBack: "#200844",
  scale: 2.25,
};

export const paperMetaballs: PaperPreset = {
  kind: "paper",
  id: "paper-metaballs",
  name: "Metaballs",
  description: "Gooey colored blobs morphing and merging organically.",
  Component: Metaballs,
  variants: metaballsPresets.map((p) => ({ name: p.name, params: p.params })),
  colorSlots: [
    { kind: "color", key: "colorBack", label: "Background" },
    { kind: "colorArray", key: "colors", label: "Ball colors", maxCount: 8, minCount: 1 },
  ],
  schema: [
    { kind: "int", key: "count", label: "Count", min: 1, max: 20, default: d.count },
    { kind: "range", key: "size", label: "Size", min: 0.05, max: 1, step: 0.01, default: d.size },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: d.speed },
    { kind: "range", key: "scale", label: "Scale", min: 0.3, max: 2.5, step: 0.05, default: customDefaults.scale },
  ],
  defaults: customDefaults,
  propsFor: (params) => ({
    colors: params.colors,
    colorBack: params.colorBack,
    count: params.count,
    size: params.size,
    speed: params.speed,
    scale: params.scale,
  }),
};
