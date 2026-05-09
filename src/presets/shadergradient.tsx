import { presets as upstreamPresets } from "@shadergradient/react";
import type { ShaderGradientPreset, ParamSchema, ParamValues } from "./types";

const TYPE_OPTIONS = [
  { value: "plane", label: "Plane" },
  { value: "sphere", label: "Sphere" },
  { value: "waterPlane", label: "Water" },
];

const ENV_OPTIONS = [
  { value: "city", label: "City" },
  { value: "dawn", label: "Dawn" },
  { value: "lobby", label: "Lobby" },
];

const LIGHT_OPTIONS = [
  { value: "3d", label: "3D" },
  { value: "env", label: "Env" },
];

const GRAIN_OPTIONS = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

const LOOP_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
];

/** The schema describes the per-preset knobs we surface as sliders/pills in the
 *  Parameters panel. Color1/2/3 live in colorSlots, not here. Camera angles are
 *  edited via drag/zoom on the preview itself, so they're stored in params but
 *  not exposed as sliders. */
function makeSchema(defaults: Record<string, unknown>): ParamSchema[] {
  return [
    {
      kind: "select",
      key: "type",
      label: "Mesh",
      options: TYPE_OPTIONS,
      default: typeof defaults.type === "string" ? defaults.type : "plane",
    },
    {
      kind: "range",
      key: "uSpeed",
      label: "Speed",
      min: 0,
      max: 2,
      step: 0.05,
      default: typeof defaults.uSpeed === "number" ? defaults.uSpeed : 0.4,
    },
    {
      kind: "range",
      key: "uStrength",
      label: "Strength",
      min: 0,
      max: 10,
      step: 0.1,
      default: typeof defaults.uStrength === "number" ? defaults.uStrength : 4,
    },
    {
      kind: "range",
      key: "uDensity",
      label: "Density",
      min: 0,
      max: 3,
      step: 0.05,
      default: typeof defaults.uDensity === "number" ? defaults.uDensity : 1.3,
    },
    {
      kind: "range",
      key: "uFrequency",
      label: "Frequency",
      min: 0,
      max: 10,
      step: 0.1,
      default: typeof defaults.uFrequency === "number" ? defaults.uFrequency : 5.5,
    },
    {
      kind: "range",
      key: "uAmplitude",
      label: "Amplitude",
      min: 0,
      max: 5,
      step: 0.05,
      default: typeof defaults.uAmplitude === "number" ? defaults.uAmplitude : 1,
    },
    {
      kind: "range",
      key: "brightness",
      label: "Brightness",
      min: 0,
      max: 4,
      step: 0.05,
      default: typeof defaults.brightness === "number" ? defaults.brightness : 1.2,
    },
    {
      kind: "range",
      key: "reflection",
      label: "Reflection",
      min: 0,
      max: 1,
      step: 0.01,
      default: typeof defaults.reflection === "number" ? defaults.reflection : 0.1,
    },
    {
      kind: "select",
      key: "lightType",
      label: "Light",
      options: LIGHT_OPTIONS,
      default: typeof defaults.lightType === "string" ? defaults.lightType : "3d",
    },
    {
      kind: "select",
      key: "envPreset",
      label: "Environment",
      options: ENV_OPTIONS,
      default: typeof defaults.envPreset === "string" ? defaults.envPreset : "city",
    },
    {
      kind: "select",
      key: "grain",
      label: "Grain",
      options: GRAIN_OPTIONS,
      default: typeof defaults.grain === "string" ? defaults.grain : "on",
    },
    {
      // ShaderGradient's `loop` prop drives the GLSL's `uLoop > 0.5` branch,
      // which uses 4-sample noise blending around a circle. Mathematically
      // perfect seamless loop, but the visual character is simpler and more
      // abstract than the default linear-time mode (and high-uNoiseStrength
      // presets like Halo can mesh-warp at certain phases). Default off so
      // the user gets the upstream-tuned look; flip on for a true seamless
      // loop without ping-pong mirroring.
      kind: "select",
      key: "loop",
      label: "Shader-native loop",
      options: LOOP_OPTIONS,
      default: typeof defaults.loop === "string" ? defaults.loop : "off",
    },
  ];
}

const TITLE_OVERRIDES: Record<string, { name: string; description: string }> = {
  halo: { name: "Halo", description: "Warm orange ring against a dusty plane." },
  pensive: { name: "Pensive", description: "Slow violet folds, dusk-lit." },
  mint: { name: "Mint", description: "Cool aqua wash with soft caustic light." },
  interstella: { name: "Interstella", description: "Deep-space gradient with drifting nebulae." },
  nightyNight: { name: "Nighty Night", description: "Quiet midnight blues, gently undulating." },
  violaOrientalis: { name: "Viola", description: "Layered purples, glassy and reflective." },
  universe: { name: "Universe", description: "Cosmic ribbons over an inky backdrop." },
  sunset: { name: "Sunset", description: "Pink-to-amber horizon haze." },
  mandarin: { name: "Mandarin", description: "Saturated citrus with crisp highlights." },
  cottonCandy: { name: "Cotton Candy", description: "Soft pastel swirl, low contrast." },
};

/** Convert one upstream preset entry into a Loop BG ShaderGradientPreset. The
 *  upstream `props` becomes our `defaults`; we strip Framer-specific fields
 *  (range/destination/format/etc.) so they don't leak into the rendered props.
 *  Camera fields stay in defaults so the preset boots with its intended pose. */
function toPreset(key: string, entry: { props: Record<string, unknown> }): ShaderGradientPreset {
  const { props } = entry;
  // Drop fields that are Framer-plugin / export-tooling only and would either
  // mean nothing to ShaderGradient at runtime or actively confuse the canvas.
  const STRIP = new Set([
    "range",
    "rangeStart",
    "rangeEnd",
    "frameRate",
    "destination",
    "format",
    "axesHelper",
    "embedMode",
    "gizmoHelper",
    "pixelDensity",
  ]);
  const cleaned: ParamValues = {};
  for (const [k, v] of Object.entries(props)) {
    if (STRIP.has(k)) continue;
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
      cleaned[k] = v;
    }
  }
  const meta = TITLE_OVERRIDES[key] ?? {
    name: key.charAt(0).toUpperCase() + key.slice(1),
    description: "ShaderGradient preset.",
  };
  // Lock the shader family to `defaults` — it's the only one with seamless-loop
  // GLSL, and the others (cosmic / glass / positionMix) tend to look broken.
  // No need for the user-facing selector either, see makeSchema.
  cleaned.shader = "defaults";
  // Default the shader-native loop toggle off so live preview matches upstream's
  // visual character; the user can opt into seamless-shader-loop mode per preset.
  if (typeof cleaned.loop !== "string") cleaned.loop = "off";
  // Materialize the three color stops into a `colors` array so the existing
  // colorArray UI handles them: drag-to-reorder, single labeled group, and
  // brand-kit cycling for free. min === max === 3 hides the add/remove buttons.
  // The preview component spreads colors[0..2] back to color1/2/3.
  const colors = [
    typeof cleaned.color1 === "string" ? cleaned.color1 : "#ffffff",
    typeof cleaned.color2 === "string" ? cleaned.color2 : "#ffffff",
    typeof cleaned.color3 === "string" ? cleaned.color3 : "#ffffff",
  ];
  delete cleaned.color1;
  delete cleaned.color2;
  delete cleaned.color3;
  cleaned.colors = colors;
  return {
    kind: "shadergradient",
    id: `shadergradient-${key}`,
    name: meta.name,
    description: meta.description,
    schema: makeSchema(props),
    defaults: cleaned,
    colorSlots: [
      { kind: "colorArray", key: "colors", label: "Colors", minCount: 3, maxCount: 3 },
    ],
  };
}

const ORDER = [
  "halo",
  "pensive",
  "mint",
  "interstella",
  "nightyNight",
  "violaOrientalis",
  "universe",
  "sunset",
  "mandarin",
  "cottonCandy",
] as const;

export const shaderGradientPresets: ShaderGradientPreset[] = ORDER.map((key) =>
  toPreset(key, (upstreamPresets as Record<string, { props: Record<string, unknown> }>)[key])
);
