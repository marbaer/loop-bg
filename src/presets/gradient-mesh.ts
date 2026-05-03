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

uniform float u_blob_count;
uniform float u_blur;
uniform float u_speed;
uniform float u_contrast;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

float blob_field(vec2 p) {
  // Each blob orbits a slightly off-centered Lissajous path. All paths complete
  // an INTEGER number of cycles over t ∈ [0,1] — that's the seamless-loop
  // guarantee. Cycle counts vary per blob via fi so blobs don't move in lock-step.
  // taste: centers offset on golden-ratio-ish positions so composition is asymmetric.
  float k = u_blur;
  float d = 1e9;
  int n = int(u_blob_count);
  // Integer base cycle count — controlled by u_speed.
  float baseCyc = intcyc(u_speed * 2.0);
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float seed = u_seed + fi * 1.713;
    float ax = 0.18 + 0.08 * sin(seed * 1.3);
    float ay = 0.22 + 0.07 * cos(seed * 0.9);
    // Per-blob integer cycle counts on x and y axes — different to make Lissajous-y motion.
    float cx = intcyc(baseCyc + mod(fi, 2.0));
    float cy = intcyc(baseCyc + mod(fi + 1.0, 3.0));
    float phase = seed * 6.28318530718;
    vec2 c = vec2(
      0.5 + ax * sin(6.28318530718 * u_t * cx + phase),
      0.5 + ay * cos(6.28318530718 * u_t * cy + phase * 1.27)
    );
    // aspect-correct
    vec2 q = p; q.x *= u_aspect;
    vec2 cc = c; cc.x *= u_aspect;
    float r = 0.18 + 0.05 * sin(seed * 2.1);
    float di = length(q - cc) - r;
    d = smin(d, di, k);
  }
  return d;
}

void main() {
  vec2 uv = v_uv;

  // Distance to the merged blob field, mapped to [0,1] for color sampling.
  float d = blob_field(uv);
  // Soft falloff — the gradient itself, NOT a hard edge.
  float t = smoothstep(0.35, -0.25, d);

  // Add a slow background tilt so the bg is never dead — but very subtle.
  // Integer 1 cycle per loop guarantees periodicity.
  vec2 c = uv - 0.5;
  float bgTilt = 0.5 + 0.5 * sin(6.28318530718 * u_t) * 0.15;
  vec3 bg = mix_oklch(u_palette_bg, u_palette_shade0, bgTilt * 0.3);

  // Foreground: ramp through 3 shades of the accent. Boost the mid for the
  // most saturated areas.
  vec3 lo = u_palette_shade1;
  vec3 mid = u_palette_primary;
  vec3 hi = u_palette_shade3;

  vec3 fg = ramp3(lo, mid, hi, clamp(t, 0.0, 1.0));

  // Composite with smooth opacity from the same field, and apply contrast.
  vec3 color = mix_oklch(bg, fg, pow(t, max(0.4, u_contrast)));

  color = finish(color, uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

export const gradientMesh: Preset = {
  kind: "shader",
  id: "soft-blobs",
  name: "Soft Blobs",
  description: "Hand-rolled drifting gradient blobs. Soft, dark, calm.",
  fragmentShader: fragment,
  schema: [
    { kind: "int", key: "u_blob_count", label: "Blobs", min: 2, max: 8, default: 5 },
    { kind: "range", key: "u_blur", label: "Softness", min: 0.05, max: 0.6, step: 0.01, default: 0.28 },
    { kind: "range", key: "u_speed", label: "Speed", min: 0.1, max: 2.5, step: 0.05, default: 0.6 },
    { kind: "range", key: "u_contrast", label: "Contrast", min: 0.4, max: 2.0, step: 0.05, default: 0.9 },
    { kind: "range", key: "u_grain", label: "Grain", min: 0, max: 0.06, step: 0.005, default: 0.018 },
    { kind: "range", key: "u_vignette", label: "Vignette", min: 0, max: 0.6, step: 0.02, default: 0.18 },
    { kind: "seed", key: "u_seed", label: "Seed", default: 1.234 },
  ],
  defaults: {
    u_blob_count: 5,
    u_blur: 0.28,
    u_speed: 0.6,
    u_contrast: 0.9,
    u_grain: 0.018,
    u_vignette: 0.18,
    u_seed: 1.234,
  },
  uniforms: (params) => ({
    u_blob_count: params.u_blob_count,
    u_blur: params.u_blur,
    u_speed: params.u_speed,
    u_contrast: params.u_contrast,
    u_grain: params.u_grain,
    u_vignette: params.u_vignette,
    u_seed: params.u_seed,
  }),
};
