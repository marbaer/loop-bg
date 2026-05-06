import type { Preset } from "./types";
import { hexToRgbTriple } from "../color/palette";

// "Smooth flowing gradient" — NOT literal ribbons. The image is a single
// multi-stop OKLCH gradient sampled along a domain-warped diagonal coordinate.
// Wherever you look, color blends continuously into its neighbors — there are
// no band edges. The shapes you see are emergent from the warping. Matches the
// vibe of Apple-keynote / Stripe gradient meshes (refs #1, #3).
const fragment = /* glsl */ `
uniform float u_t;
uniform vec2 u_resolution;
uniform float u_aspect;

uniform vec3 u_palette_bg;
uniform vec3 u_palette_primary;

// Up to 8 hue-rotated stops prepared in JS, sampled smoothly in OKLCH.
uniform vec3 u_stops[8];
uniform float u_stop_count;

uniform float u_warp;
uniform float u_warp_scale;
uniform float u_speed;
uniform float u_angle;
uniform float u_smoothness;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

vec3 sampleStops(float g) {
  float n = u_stop_count;
  float gg = clamp(g, 0.0, n - 1.0);
  float fl = floor(gg);
  float fr = fract(gg);
  // Loop unrolled: GLSL doesn't allow dynamic indexing of uniform arrays in
  // some drivers. We branch on fl explicitly.
  vec3 a, b;
  if (fl < 0.5) { a = u_stops[0]; b = u_stops[1]; }
  else if (fl < 1.5) { a = u_stops[1]; b = u_stops[2]; }
  else if (fl < 2.5) { a = u_stops[2]; b = u_stops[3]; }
  else if (fl < 3.5) { a = u_stops[3]; b = u_stops[4]; }
  else if (fl < 4.5) { a = u_stops[4]; b = u_stops[5]; }
  else if (fl < 5.5) { a = u_stops[5]; b = u_stops[6]; }
  else { a = u_stops[6]; b = u_stops[7]; }
  // Smooth easing inside each segment for a softer painted look.
  float fe = smoothstep(0.0, 1.0, fr);
  fe = mix(fr, fe, u_smoothness);
  return mix_oklch(a, b, fe);
}

void main() {
  vec2 uv = v_uv;
  // Aspect-correct so warp doesn't stretch into elongated stripes on wide screens.
  vec2 p = vec2(uv.x * u_aspect, uv.y);

  // Two domain-warp octaves with integer cycle counts in t — these are the
  // entire visual identity. Slow, large warps give Apple-keynote sweep.
  // Fixed integer cycle counts — JS scales u_t by speed for smooth + static-at-0.
  float c1 = 1.0;
  float c2 = 2.0;

  vec2 q1 = vec2(
    pfbm2(p * u_warp_scale + u_seed, fract(u_t * c1), 0.55),
    pfbm2(p * u_warp_scale + u_seed + 5.2, fract(u_t * c1 + 0.37), 0.55)
  );
  vec2 q2 = vec2(
    pfbm2(p * u_warp_scale * 2.3 + u_seed * 1.7, fract(u_t * c2), 0.45),
    pfbm2(p * u_warp_scale * 2.3 + u_seed * 1.7 + 11.0, fract(u_t * c2 + 0.71), 0.45)
  );

  vec2 warped = p + (q1 - 0.5) * u_warp + (q2 - 0.5) * u_warp * 0.4;

  // Diagonal gradient coord — angle controls direction.
  float ang = u_angle * 6.28318530718;
  vec2 dir = vec2(cos(ang), sin(ang));
  float g = dot(warped, dir);

  // Map g into [0, stops-1]. We compute the full extent based on a fixed
  // travel distance of ~1.6 units (covers diagonal of a 16:9 panel).
  float gNorm = (g + 0.2) / 1.6;
  float gMapped = clamp(gNorm, 0.0, 1.0) * (u_stop_count - 1.0);

  vec3 color = sampleStops(gMapped);

  color = finish(color, uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

export const ribbons: Preset = {
  kind: "shader",
  id: "ribbons",
  name: "Ribbons",
  description: "A flowing, domain-warped gradient that shifts through color as it moves.",
  fragmentShader: fragment,
  colorSlots: [
    { kind: "colorArray", key: "colors", label: "Color stops", minCount: 2, maxCount: 8 },
  ],
  schema: [
    { kind: "range", key: "u_warp",       label: "Warp",       min: 0,   max: 1.4, step: 0.02, default: 0.56 },
    { kind: "range", key: "u_warp_scale", label: "Warp scale", min: 0.4, max: 2.5, step: 0.05, default: 1.1 },
    { kind: "range", key: "u_angle",      label: "Angle",      min: 0,   max: 1,   step: 0.01, default: 0.18 },
    { kind: "range", key: "u_smoothness", label: "Smoothness", min: 0,   max: 1,   step: 0.02, default: 0.6 },
    { kind: "range", key: "u_speed",      label: "Speed",      min: 0,   max: 2.5, step: 0.1,  default: 1.0 },
    { kind: "range", key: "u_grain",      label: "Grain",      min: 0,   max: 0.06, step: 0.005, default: 0.010 },
    { kind: "range", key: "u_vignette",   label: "Vignette",   min: 0,   max: 0.6, step: 0.02, default: 0.16 },
    { kind: "seed",  key: "u_seed",       label: "Seed",       default: 0.91 },
  ],
  defaults: {
    u_warp: 0.56,
    u_warp_scale: 1.1,
    u_angle: 0.18,
    u_smoothness: 0.6,
    u_speed: 1.0,
    u_grain: 0.010,
    u_vignette: 0.16,
    u_seed: 0.91,
    colors: ["#4338ca", "#7c3aed", "#6366f1", "#818cf8", "#a5b4fc"],
  },
  uniforms: (params) => {
    const hexArr = Array.isArray(params.colors) ? (params.colors as string[]) : [];
    const count = Math.max(2, Math.min(8, hexArr.length));
    const stops = new Float32Array(8 * 3);
    for (let i = 0; i < count; i++) {
      const [r, g, b] = hexToRgbTriple(hexArr[i] ?? "#000000");
      stops[i * 3] = r; stops[i * 3 + 1] = g; stops[i * 3 + 2] = b;
    }
    return {
      u_warp:        params.u_warp,
      u_warp_scale:  params.u_warp_scale,
      u_angle:       params.u_angle,
      u_smoothness:  params.u_smoothness,
      u_speed:       params.u_speed,
      u_grain:       params.u_grain,
      u_vignette:    params.u_vignette,
      u_seed:        params.u_seed,
      u_stop_count:  count,
      u_stops:       stops,
      u_palette_bg:  hexToRgbTriple(hexArr[0] ?? "#4338ca"),
    };
  },
};
