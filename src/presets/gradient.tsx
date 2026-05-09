import { MeshGradient, meshGradientPresets } from "@paper-design/shaders-react";
import type { PaperPreset, PaperVariant } from "./types";

const d = meshGradientPresets[0].params;

const VARIANTS: PaperVariant[] = [
  {
    name: "Autumnal Peach",
    params: {
      colors: ["#FF5A4A", "#F58040", "#FFCC3D", "#F2C944", "#FBE8C8", "#8B96D6", "#5C6FA8"],
    },
  },
  {
    name: "Blossom",
    params: {
      colors: [
        "#8FCB7A",
        "#E8F0E0",
        "#B8C8FF",
        "#9580FF",
        "#F5D67A",
        "#F2A878",
        "#E84A6F",
        "#E68FB8",
      ],
    },
  },
  {
    name: "Blushing Fire",
    params: {
      colors: ["#B59AFF", "#A5E0FF", "#E78AAF", "#6FE6C8", "#FFF4C2", "#FFD4E0"],
    },
  },
  {
    name: "Bright Rain",
    params: {
      colors: ["#1F2278", "#6B3FCC", "#36DEF0", "#C4658F", "#F38B6B"],
    },
  },
  {
    name: "Floss",
    params: {
      colors: ["#7FE3F5", "#9FE6F8", "#2A2DD8", "#8A7CFF", "#C7A3F0", "#B8AEFA"],
    },
  },
  {
    name: "Glass Rainbow",
    params: {
      colors: ["#FFD93B", "#FF9D5A", "#E94FE0", "#B068FF", "#5E8DFF", "#4A6BE6"],
    },
  },
  {
    name: "Good Vibes",
    params: {
      colors: ["#9D2DFF", "#2C56FF", "#E83562", "#E94C76", "#F4D5B8", "#A879FF", "#6F8DDC"],
    },
  },
  {
    name: "Moonrise",
    params: {
      colors: ["#0E0F3A", "#4A1C7A", "#9B5290", "#F0BEA8", "#C24F8A", "#2B1142"],
    },
  },
  {
    name: "Ray of Lights",
    params: {
      colors: ["#0E1230", "#1E5560", "#58E8C2", "#1FE89E", "#C84792", "#E55C8E", "#F19B6E"],
    },
  },
  {
    name: "Rose Thorn",
    params: {
      colors: ["#6F1A28", "#F4B084", "#DD58C0", "#8C5DEB", "#5570F0", "#4D7EB6"],
    },
  },
];

export const gradient: PaperPreset = {
  kind: "paper",
  id: "gradient",
  name: "Gradient",
  description:
    "Inspired by Raycast wallpapers. Soft color spots that blend slowly into a painterly field.",
  Component: MeshGradient,
  variants: VARIANTS,
  colorSlots: [
    { kind: "colorArray", key: "colors", label: "Colors", maxCount: 10, minCount: 2 },
  ],
  schema: [
    { kind: "range", key: "scale", label: "Scale", min: 0, max: 2, step: 0.05, default: 1 },
    { kind: "range", key: "speed", label: "Speed", min: 0, max: 2.5, step: 0.05, default: 0.5 },
    { kind: "range", key: "grainMixer", label: "Grain edges", min: 0, max: 1, step: 0.01, default: 0.01 },
    { kind: "range", key: "grainOverlay", label: "Grain overlay", min: 0, max: 1, step: 0.01, default: 0.01 },
  ],
  defaults: {
    ...d,
    distortion: 0,
    swirl: 0,
    scale: 1,
    speed: 0.5,
    grainMixer: 0.01,
    grainOverlay: 0.01,
    colors: VARIANTS[0].params.colors,
  },
  propsFor: (params) => ({
    colors: params.colors,
    distortion: 0,
    swirl: 0,
    speed: params.speed,
    grainMixer: params.grainMixer,
    grainOverlay: params.grainOverlay,
    scale: 1 + (typeof params.scale === "number" ? params.scale : 0),
  }),
};
