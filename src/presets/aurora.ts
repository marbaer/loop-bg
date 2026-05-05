import type { Preset } from "./types";

const fragment = /* glsl */ `
uniform float u_t;
uniform vec2 u_resolution;
uniform float u_aspect;

uniform vec3 u_palette_bg;
uniform vec3 u_palette_primary;
uniform vec3 u_palette_secondary;
uniform vec3 u_palette_shade0;
uniform vec3 u_palette_shade1;
uniform vec3 u_palette_shade2;
uniform vec3 u_palette_shade3;
uniform vec3 u_palette_shade4;

uniform float u_bands;
uniform float u_warp;
uniform float u_speed;
uniform float u_drift;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

// One aurora band: a horizontal soft strip at vertical position ypos, modulated
// by domain-warped periodic noise. All time-varying terms use INTEGER cycle
// counts in t so frame 0 == frame N (seamless loop).
float band(vec2 uv, float ypos, float thickness, float warpAmt, float seed) {
  vec2 p = vec2(uv.x * 2.4, uv.y * 1.5) + seed;
  // pnoise2/pfbm2 are periodic in their t argument with period 1 — so we must
  // pass an integer-multiplied u_t (not u_t * fractional_speed).
  // Cycle counts are fixed integers — JS scales u_t by speed, so the slider feels smooth and 0 is fully static.
  float warpCyc = 2.0;
  float driftCyc = 1.0;
  float tw = u_t * warpCyc;
  // domain warp via two periodic noise samples
  float w1 = pfbm2(p, fract(tw), 0.6);
  float w2 = pfbm2(p + 5.0, fract(tw + 0.37), 0.6);
  vec2 warp = vec2(w1, w2) * warpAmt;
  float n = pfbm2(p + warp, fract(tw), 0.6);

  float y = uv.y + (n - 0.5) * 0.5 + sin(6.28318530718 * u_t * driftCyc + seed) * u_drift * 0.05;
  float d = abs(y - ypos);
  return smoothstep(thickness, 0.0, d);
}

void main() {
  vec2 uv = v_uv;
  vec3 color = u_palette_bg;

  int n = int(u_bands);
  // taste: distribute bands at golden-ratio positions, not evenly. Premium asymmetry.
  float positions[5];
  positions[0] = 0.32;
  positions[1] = 0.62;
  positions[2] = 0.18;
  positions[3] = 0.78;
  positions[4] = 0.48;

  vec3 bandCols[5];
  bandCols[0] = u_palette_primary;
  bandCols[1] = u_palette_secondary;
  bandCols[2] = u_palette_shade3;
  bandCols[3] = u_palette_shade1;
  bandCols[4] = u_palette_shade2;

  for (int i = 0; i < 5; i++) {
    if (i >= n) break;
    float fi = float(i);
    float ypos = positions[i];
    float thick = 0.18 + 0.05 * sin(fi * 2.7 + u_seed);
    float m = band(uv, ypos, thick, u_warp, u_seed + fi * 3.7);
    color = mix_oklch(color, bandCols[i], m * 0.85);
  }

  color = finish(color, uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

export const aurora: Preset = {
  kind: "shader",
  id: "aurora",
  name: "Aurora",
  description: "Horizontal color bands that drift and shimmer slowly across the canvas.",
  fragmentShader: fragment,
  schema: [
    { kind: "int", key: "u_bands", label: "Bands", min: 1, max: 5, default: 3 },
    { kind: "range", key: "u_warp", label: "Warp", min: 0, max: 0.4, step: 0.01, default: 0.16 },
    { kind: "range", key: "u_speed", label: "Speed", min: 0, max: 2.5, step: 0.1, default: 1.0 },
    { kind: "range", key: "u_drift", label: "Drift", min: 0, max: 1, step: 0.05, default: 0.45 },
    { kind: "range", key: "u_grain", label: "Grain", min: 0, max: 0.06, step: 0.005, default: 0.020 },
    { kind: "range", key: "u_vignette", label: "Vignette", min: 0, max: 0.6, step: 0.02, default: 0.22 },
    { kind: "seed", key: "u_seed", label: "Seed", default: 0.42 },
  ],
  defaults: {
    u_bands: 3,
    u_warp: 0.16,
    u_speed: 1.0,
    u_drift: 0.45,
    u_grain: 0.020,
    u_vignette: 0.22,
    u_seed: 0.42,
  },
  uniforms: (params) => ({
    u_bands: params.u_bands,
    u_warp: params.u_warp,
    u_speed: params.u_speed,
    u_drift: params.u_drift,
    u_grain: params.u_grain,
    u_vignette: params.u_vignette,
    u_seed: params.u_seed,
  }),
};
