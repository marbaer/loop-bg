import type { ComponentType, CSSProperties } from "react";
import type { Palette } from "../color/palette";

export type ParamSchema =
  | { kind: "range"; key: string; label: string; min: number; max: number; step: number; default: number }
  | { kind: "int"; key: string; label: string; min: number; max: number; default: number }
  | { kind: "seed"; key: string; label: string; default: number }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[]; default: string };

/** Values stored against a preset's parameter keys. Sliders and seed entries
 *  use numbers; library variants can also include non-numeric values like
 *  color arrays / strings, so the type is intentionally loose at the union. */
export type ParamValue = number | string | string[] | boolean;
export type ParamValues = Record<string, ParamValue>;

export interface UniformValues {
  [key: string]: number | number[] | Float32Array;
}

export interface PresetBase {
  id: string;
  name: string;
  description: string;
  schema: ParamSchema[];
  defaults: ParamValues;
}

/** Single-pass fragment-shader preset rendered through the WebGL2 pipeline. */
export interface ShaderPreset extends PresetBase {
  kind: "shader";
  fragmentShader: string;
  /** Map (params, palette) -> a flat record of GLSL uniform values. */
  uniforms: (params: ParamValues, palette: Palette) => UniformValues;
  /** When defined, ShaderColorControls replaces the global ColorPicker —
   *  colors are stored directly in paramsByPreset rather than derived from palette. */
  colorSlots?: ColorSlot[];
}

/** React Three Fiber scene preset. The Scene component receives params, palette
 *  and the current loop time t in [0,1); it should drive its own animation
 *  from t (not from clock state) so external code can sample any frame
 *  deterministically (e.g. for export). */
export interface SceneProps {
  params: ParamValues;
  palette: Palette;
  /** Current loop time, in [0,1). For preview, drives via rAF; for export,
   *  driven deterministically by the export pipeline. */
  t: number;
}

export interface R3FPreset extends PresetBase {
  kind: "r3f";
  Scene: ComponentType<SceneProps>;
}

/** A paper-design/shaders-react preset. The `Component` is the paper shader
 *  React component (e.g. MeshGradient). `propsFor` translates our
 *  (params, palette) into the component's props (colors array + shader-specific
 *  knobs). The preview wrapper just renders <Component {...props} style={fill}/>. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PaperShaderProps = Record<string, any>;
/** A single named variant from the paper-design library (e.g. MeshGradient's
 *  "purple", "beach", "ink"). Selecting one resets the user's params to its
 *  values — including non-numeric ones like `colors: string[]`. */
export interface PaperVariant {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
}

/** Defines a color "slot" exposed by a paper-design shader. Either a single
 *  color prop (e.g. `colorFront`, `colorBack`, `colorTint`) or an entry in a
 *  colors array. The UI renders a color picker per slot. */
export type ColorSlot =
  | { kind: "color"; key: string; label: string }
  | {
      kind: "colorArray";
      key: string;
      label: string;
      /** Library cap, defaults to 10. */
      maxCount?: number;
      minCount?: number;
    };

export interface PaperPreset extends PresetBase {
  kind: "paper";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
  propsFor: (
    params: ParamValues,
    palette: Palette,
    /** Provided when the user has uploaded an image and the preset is one of the
     *  "logo" presets (`usesImage: true`). The string is a data URL. */
    image?: string | null
  ) => PaperShaderProps;
  /** Optional inline style applied alongside fill sizing (e.g. background color). */
  style?: CSSProperties;
  /** When true, the preset is a "logo animation" — accepts a user-uploaded
   *  image. The UI shows an upload widget; the data URL is passed into
   *  propsFor as the third argument. */
  usesImage?: boolean;
  /** Library-provided named variants. The UI exposes these as a pill selector
   *  above the param sliders. Selecting one applies its params to the user's
   *  state. */
  variants?: PaperVariant[];
  /** Per-shader color slots that match the shader's own color props. These
   *  REPLACE the global brand-palette controls for paper presets — the user
   *  edits each slot directly, and propsFor reads them straight from params. */
  colorSlots?: ColorSlot[];
}

export type Preset = ShaderPreset | R3FPreset | PaperPreset;

export function defaultsFromSchema(schema: ParamSchema[]): ParamValues {
  const out: ParamValues = {};
  for (const p of schema) out[p.key] = p.default;
  return out;
}
