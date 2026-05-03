import type { Preset } from "./types";

// Procedural particle field via a screen-space hash grid. Each cell hosts a
// drifting dot whose position cycles periodically in t. This is fragment-only
// (no instancing) for shader simplicity.
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

uniform float u_density;
uniform float u_dotsize;
uniform float u_speed;
uniform float u_parallax;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

float layer(vec2 uv, float scale, float depth, float layerSeed) {
  // Tiled grid in scaled UV space.
  vec2 g = uv * scale;
  // aspect-correct so dots are round, not stretched
  g.x *= u_aspect;
  vec2 cell = floor(g);
  vec2 fr = fract(g);

  // Per-cell hash determines the dot's home position and a per-cell phase.
  float h = hash21(cell + layerSeed);
  vec2 home = vec2(0.5) + 0.3 * vec2(h * 2.0 - 1.0, hash21(cell + layerSeed + 17.0) * 2.0 - 1.0);

  // Periodic drift in t — integer cycle counts only, so frame 0 == frame N.
  // Per-cell variation comes from the hash h adding 0/1/2 cycles, not from
  // continuous detuning (which would break the loop).
  float ph = h * 6.28318530718;
  float baseCyc = intcyc(u_speed * 2.0);
  float cx = baseCyc + floor(h * 3.0);
  float cy = baseCyc + floor(hash21(cell + layerSeed + 31.0) * 3.0);
  vec2 drift = 0.18 * vec2(
    cos(6.28318530718 * u_t * cx + ph),
    sin(6.28318530718 * u_t * cy + ph * 0.7)
  );

  vec2 pos = home + drift;
  float d = length(fr - pos);

  // Dot size varies with depth for parallax feel.
  float r = u_dotsize * (0.4 + 0.6 * h) * depth;
  float dot = smoothstep(r, r * 0.4, d);
  return dot;
}

void main() {
  vec2 uv = v_uv;

  // Background is the palette bg with a very gentle radial tint toward shade1.
  vec2 c = uv - 0.5;
  float radial = 1.0 - dot(c, c) * 1.4;
  vec3 color = mix_oklch(u_palette_bg, u_palette_shade1, (1.0 - radial) * 0.25);

  // Three depth layers — distant smaller, near larger. Density param scales the
  // base grid resolution.
  float baseScale = u_density;

  // Far layer
  float far = layer(uv, baseScale * 1.3, 0.6, u_seed + 11.0);
  color = mix_oklch(color, u_palette_shade2, far * 0.4 * u_parallax);

  // Mid layer
  float mid = layer(uv, baseScale * 0.9, 1.0, u_seed + 23.0);
  color = mix_oklch(color, u_palette_primary, mid * 0.7);

  // Near layer
  float near = layer(uv, baseScale * 0.6, 1.4, u_seed + 31.0);
  color = mix_oklch(color, u_palette_shade4, near * 0.9);

  color = finish(color, uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

export const particles: Preset = {
  kind: "shader",
  id: "particles",
  name: "Particles",
  description: "Sparse drifting dots with parallax depth.",
  fragmentShader: fragment,
  schema: [
    { kind: "range", key: "u_density", label: "Density", min: 4, max: 24, step: 1, default: 12 },
    { kind: "range", key: "u_dotsize", label: "Dot size", min: 0.02, max: 0.18, step: 0.005, default: 0.07 },
    { kind: "range", key: "u_speed", label: "Speed", min: 0.05, max: 1.5, step: 0.05, default: 0.35 },
    { kind: "range", key: "u_parallax", label: "Parallax", min: 0, max: 1.5, step: 0.05, default: 0.8 },
    { kind: "range", key: "u_grain", label: "Grain", min: 0, max: 0.06, step: 0.005, default: 0.02 },
    { kind: "range", key: "u_vignette", label: "Vignette", min: 0, max: 0.6, step: 0.02, default: 0.28 },
    { kind: "seed", key: "u_seed", label: "Seed", default: 7.7 },
  ],
  defaults: {
    u_density: 12,
    u_dotsize: 0.07,
    u_speed: 0.35,
    u_parallax: 0.8,
    u_grain: 0.02,
    u_vignette: 0.28,
    u_seed: 7.7,
  },
  uniforms: (params) => ({
    u_density: params.u_density,
    u_dotsize: params.u_dotsize,
    u_speed: params.u_speed,
    u_parallax: params.u_parallax,
    u_grain: params.u_grain,
    u_vignette: params.u_vignette,
    u_seed: params.u_seed,
  }),
};
