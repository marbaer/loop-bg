import type { Preset } from "./types";
import { converter, parse } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

// "Papercut" stacked layers — flat solid colors, crisp anti-aliased edges, no
// gradients/blur inside the shapes. Each layer fills everything below a
// smooth diagonal-curve top edge, painted over the layers behind it. Layers
// are differentiated by LIGHTNESS more than HUE (the reference is monochrome
// blue), so the default palette is a single-hue ramp from dark→light.
const fragment = /* glsl */ `
uniform float u_t;
uniform vec2 u_resolution;
uniform float u_aspect;

uniform vec3 u_palette_bg;
uniform vec3 u_palette_primary;

uniform vec3 u_layer_colors[8];
uniform float u_layer_count;
uniform float u_amp;
uniform float u_speed;
uniform float u_tilt;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

void main() {
  vec2 uv = v_uv;

  // Grain orbit: one full circle per loop — perfectly periodic, no intcyc needed.
  vec2 grainOrbit = vec2(cos(6.28318530718 * u_t), sin(6.28318530718 * u_t)) * 50.0;

  // Layer 0 fills the entire canvas. Apply its own grain pass now so it gets
  // the same per-layer treatment as the rest.
  float bg_g = (vnoise(gl_FragCoord.xy * 0.7 + grainOrbit) - 0.5) * u_grain;
  vec3 color = u_layer_colors[0] + vec3(bg_g);

  // Fixed integer cycle count — JS scales u_t by speed for smooth + static-at-0.
  float baseCyc = 1.0;
  int n = int(u_layer_count);

  // Crisp edges: pixel AA only.
  float aa = 1.5 / u_resolution.y;

  // i starts at 1 because layer 0 is the bg (already painted above).
  for (int i = 1; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float seed = u_seed + fi * 1.713;

    float h0 = hash21(vec2(seed, 0.13));
    float h1 = hash21(vec2(seed, 0.71));
    float h2 = hash21(vec2(seed, 0.31));

    // Each layer's TOP EDGE rises across the canvas. Front-most (highest i)
    // gets the smallest swath; back layers cover more. Resting y of the top
    // edge progresses from ~0.85 (back) down to ~0.15 (front).
    float yRest = mix(0.92, 0.15, (fi - 1.0) / max(1.0, float(n - 2))) + (h0 - 0.5) * 0.08;

    // Slope: diagonal tilt, sign and magnitude varied per layer. Aspect-normalized
    // so a "1.0" tilt equals the canvas vertical extent across its width.
    float slope = ((h1 - 0.5) * 2.0) * u_tilt;

    // STANDING-WAVE undulation. Each spatial pattern is anchored — its crests
    // stay at the same x positions across the whole loop; only their amplitudes
    // morph over time. We sum two anchored spatials weighted by complementary
    // time envelopes (cos + sin at the SAME time frequency, so cos²+sin²=1):
    // the layer's shape continuously morphs between two forms but never fully
    // flattens.
    float spatialFreq = 1.0 + floor(h2 * 3.0);   // 1, 2 or 3 humps across
    float cyc = baseCyc + mod(fi, 3.0);
    float wavePhase = seed * 6.28318530718;
    float spatial1 = sin(uv.x * spatialFreq * 6.28318530718 + wavePhase);
    float spatial2 = sin(uv.x * spatialFreq * 12.56637 + wavePhase * 0.7);
    float env1 = cos(6.28318530718 * u_t * cyc);
    float env2 = sin(6.28318530718 * u_t * cyc);
    float wave = u_amp * (spatial1 * env1 + 0.6 * spatial2 * env2);

    // Centerline of the top edge.
    float yEdge = yRest + slope * (uv.x - 0.5) + wave;

    // Pixel is "inside" this layer when uv.y < yEdge. The shape fills
    // everything below that curve, with a 1-pixel AA edge.
    float coverage = 1.0 - smoothstep(-aa, aa, uv.y - yEdge);

    // Per-layer grain: each layer uses a different spatial offset and a
    // randomly scaled amplitude so the layers look like distinct physical
    // materials rather than one uniform texture.
    float grainMult = mix(0.4, 1.8, hash21(vec2(seed, 0.97)));
    float g = (vnoise(gl_FragCoord.xy * 0.7 + grainOrbit + fi * vec2(17.3, 61.7)) - 0.5)
              * u_grain * grainMult;

    color = mix(color, u_layer_colors[i] + vec3(g), coverage);
  }

  // Grain already applied per-layer above; pass 0 here so finish() only
  // handles vignette, tone curve, and dither.
  color = finish(color, uv, gl_FragCoord.xy, u_t, 0.0, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

interface Oklch {
  l: number;
  c: number;
  h: number;
}

function clampOk(o: Oklch): Oklch {
  return { l: Math.max(0, Math.min(1, o.l)), c: Math.max(0, Math.min(0.32, o.c)), h: o.h };
}

// Build N flat layer colors. Layer 0 is the deepest shade (paints the entire
// canvas). Subsequent layers progressively lighter (or darker, depending on
// direction param). For the canonical "papercut" look, hue spread is 0 and
// lightness spread is wide — so all layers are different shades of one color.
function buildLayerColors(
  primaryHex: string,
  count: number,
  hueSpread: number,
  lightnessRange: number,
  direction: number
): Float32Array {
  const accent = (toOklch(parse(primaryHex)) as unknown as Oklch | undefined) ?? { l: 0.62, c: 0.18, h: 250 };
  const out = new Float32Array(8 * 3);
  const hueDeg = hueSpread * 220;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0; // 0 = back, 1 = front
    // Direction: 0 = back is darkest / front is lightest, 1 = reversed.
    const lT = direction > 0.5 ? 1 - t : t;
    const lOffset = (lT - 0.5) * lightnessRange;
    const l = clampOk({ l: (accent.l ?? 0.55) + lOffset, c: 0, h: 0 }).l;
    // Hue spread (when used) fans symmetrically around accent hue.
    const hOffset = count > 1 ? (i / (count - 1) - 0.5) * hueDeg : 0;
    const h = ((accent.h ?? 0) + hOffset + 720) % 360;
    const c = Math.min(0.32, (accent.c ?? 0.18) * 1.0);
    const rgb = toRgb({ mode: "oklch", l, c, h });
    out[i * 3] = rgb?.r ?? 0;
    out[i * 3 + 1] = rgb?.g ?? 0;
    out[i * 3 + 2] = rgb?.b ?? 0;
  }
  return out;
}

export const layers: Preset = {
  kind: "shader",
  id: "layers",
  name: "Layers",
  description: "Papercut layered shapes — flat solid colors, crisp curved edges.",
  fragmentShader: fragment,
  schema: [
    { kind: "int", key: "u_layer_count", label: "Layers", min: 3, max: 8, default: 5 },
    { kind: "range", key: "u_lightness_range", label: "Shade range", min: 0.1, max: 0.7, step: 0.01, default: 0.5 },
    { kind: "range", key: "u_hue_spread", label: "Hue spread", min: 0, max: 1, step: 0.01, default: 0.0 },
    { kind: "range", key: "u_direction", label: "Light → dark direction", min: 0, max: 1, step: 1, default: 0 },
    { kind: "range", key: "u_amp", label: "Wave amp", min: 0.02, max: 0.35, step: 0.01, default: 0.16 },
    { kind: "range", key: "u_tilt", label: "Tilt", min: 0, max: 0.6, step: 0.02, default: 0.28 },
    { kind: "range", key: "u_speed", label: "Speed", min: 0, max: 2.5, step: 0.1, default: 1.0 },
    { kind: "range", key: "u_grain", label: "Grain", min: 0, max: 0.06, step: 0.005, default: 0.015 },
    { kind: "range", key: "u_vignette", label: "Vignette", min: 0, max: 0.6, step: 0.02, default: 0.0 },
    { kind: "seed", key: "u_seed", label: "Seed", default: 0.81 },
  ],
  defaults: {
    u_layer_count: 5,
    u_lightness_range: 0.5,
    u_hue_spread: 0.0,
    u_direction: 0,
    u_amp: 0.16,
    u_tilt: 0.28,
    u_speed: 1.0,
    u_grain: 0.015,
    u_vignette: 0.0,
    u_seed: 0.81,
  },
  uniforms: (params, palette) => ({
    u_layer_count: params.u_layer_count,
    u_amp: params.u_amp,
    u_tilt: params.u_tilt,
    u_speed: params.u_speed,
    u_grain: params.u_grain,
    u_vignette: params.u_vignette,
    u_seed: params.u_seed,
    u_layer_colors: buildLayerColors(
      palette.primary,
      Math.max(3, Math.min(8, Math.round(params.u_layer_count))),
      params.u_hue_spread,
      params.u_lightness_range,
      params.u_direction
    ),
  }),
};
