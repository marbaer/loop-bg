import type { Preset } from "./types";
import { hexToRgbTriple } from "../color/palette";

// Loupe Ring — inspired by Raycast's wallpaper series.
//
// The ring is modeled as a 1D current of luminous material flowing around its
// own circumference. Each angle θ has an angular velocity v(θ, t). Mass
// conservation in steady state gives
//   ρ(θ) · v(θ) = J     (constant flux around the loop)
// so density ρ ∝ 1/v: the slow region piles up into a bright filament; the
// fast region stretches out into a dim wide cloud. Line width follows σ ∝ v.
//
// The shape is a stretched ellipse oriented along the dense-to-dispersed pole,
// with a Pulse parameter coupling subtle squish/stretch breathing to the
// dispersion strength and overall brightness — same mass spread over more arc
// dims the per-pixel light, same mass concentrated in less arc brightens it.
// u_velocityContrast sets v_max/v_min; u_skew biases the velocity profile so
// the leading edge of the bright arc steepens and the trailing edge flattens.
const fragment = /* glsl */ `
uniform float u_t;
uniform vec2 u_resolution;
uniform float u_aspect;

uniform vec3 u_palette_bg;
// Up to 5 color stops sampled along the density axis (0 = dense, 1 = dispersed).
uniform vec3 u_color_0;
uniform vec3 u_color_1;
uniform vec3 u_color_2;
uniform vec3 u_color_3;
uniform vec3 u_color_4;
uniform float u_color_count;

uniform float u_tilt;
uniform float u_ellipse;
uniform float u_radius;
uniform float u_stretch;
uniform float u_pulse;
uniform float u_thinness;
uniform float u_velocityContrast;
uniform float u_skew;
uniform float u_brightness;
uniform float u_speed;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

void main() {
  // Aspect-corrected coords; ring lives in q-space (rotated + foreshortened).
  vec2 p = (v_uv - 0.5) * vec2(u_aspect, 1.0);
  float ct = cos(u_tilt);
  float st = sin(u_tilt);
  vec2 q = mat2(ct, -st, st, ct) * p;
  q.y /= max(u_ellipse, 0.05);

  // ψ(t) — angle of the dense pole. 2π·u_t is naturally 1-periodic in u_t.
  float psi = 6.28318530718 * u_t;

  // Rotate q by −ψ so the dense pole sits along the local +x axis.
  float cp = cos(psi), sp = sin(psi);
  vec2  ql = vec2(cp * q.x + sp * q.y, -sp * q.x + cp * q.y);

  // Breathing — single cycle per loop (naturally seamless). Drives a coupled
  // squish/stretch on the geometry plus the dispersion strength: as the ring
  // stretches the dispersed pole spreads further (and overall brightness dips
  // since the same material covers more arc); as it squishes back the ring
  // tightens and the density gradient becomes more uniform.
  float pulse        = sin(6.28318530718 * u_t);
  float stretchEff   = clamp(u_stretch + 0.06 * u_pulse * pulse, 0.0, 0.55);
  float vcEff        = u_velocityContrast * (1.0 + 0.35 * u_pulse * pulse);
  float brightEff    = u_brightness * (1.0 - 0.12 * u_pulse * pulse);

  // Stretched ellipse: long axis aligned with the dense-to-dispersed pole.
  //   (x/A)² + (y/B)² = 1   with   A = R·(1+s),  B = R·(1−s)
  float A  = u_radius * (1.0 + stretchEff);
  float B  = u_radius * max(1.0 - stretchEff, 0.05);
  float fx = ql.x / A;
  float fy = ql.y / B;
  float f  = fx * fx + fy * fy - 1.0;
  // Perpendicular signed distance: f / |∇f|. ∇f = (2x/A², 2y/B²), so
  //   d ≈ 0.5 · f / |(x/A², y/B²)|
  // Uniform thickness around the ring regardless of where on the ellipse.
  vec2 grad = vec2(ql.x / (A * A), ql.y / (B * B));
  float d   = 0.5 * f / max(length(grad), 1e-6);

  // η — angular position around the ring in the local frame, η=0 = dense pole.
  float eta = atan(ql.y, ql.x);

  // Skewed cosine: warping the argument by u_skew·sin(eta) steepens the
  // velocity rise on the leading side and flattens the fall on the trailing
  // side. Stays smooth and 2π-periodic in eta because sin is.
  float warped = eta + u_skew * sin(eta);

  // Velocity profile around the ring. Min at eta=0 (compressed pole), max at
  // eta=π (dispersed pole). Normalized so v_min = 1.
  //   vNorm ∈ [0, 1]: 0 at slow pole, 1 at fast pole.
  float vNorm = 0.5 - 0.5 * cos(warped);
  float v     = 1.0 + vcEff * vNorm;

  // Continuity: σ ∝ v (wide where flow is fast / material is sparse).
  float sigma = u_thinness * v;

  // Gaussian cross-section through the ring at this angle.
  float gauss = exp(-(d * d) / (2.0 * sigma * sigma));

  // Density-conserving peak: peak intensity ∝ ρ ∝ 1/v = u_thinness/σ.
  float intensity = (u_thinness / sigma) * gauss * brightEff;

  // Tiny wobble adds atmospheric texture in the dispersed cloud. Gated by
  // vNorm so the bright filament stays smooth — without this gating, the
  // noise creates faint dim stripes perpendicular to the ring at the brightest
  // pixels (since wobble is constant across the filament's thickness).
  float wobble = pfbm2(vec2(cos(eta), sin(eta)) * 1.5 + u_seed, fract(u_t), 0.5) - 0.5;
  intensity *= 1.0 + wobble * 0.12 * vNorm;

  // Sample the density-axis gradient. Stops sit at non-uniform positions on
  // a cosine curve: pos[i] = (1 − cos(π · i/segs)) / 2. This crowds stops
  // toward the middle, so the FIRST and LAST colors only dominate the very
  // ends of the density range (matching how a real diffusion profile peaks
  // narrowly at one pole and fades narrowly at the other). Linear blending
  // between adjacent stops in OKLab — smooth, no plateaus, no banding.
  // Inverse of the cosine curve: scaled = segs · acos(1 − 2t) / π.
  float segs = max(u_color_count - 1.0, 1.0);
  float t = clamp(vNorm, 0.0, 1.0);
  float scaled = segs * acos(1.0 - 2.0 * t) / 3.14159265;
  float seg = floor(scaled);
  float local = scaled - seg;
  vec3 a, b;
       if (seg < 0.5) { a = u_color_0; b = u_color_1; }
  else if (seg < 1.5) { a = u_color_1; b = u_color_2; }
  else if (seg < 2.5) { a = u_color_2; b = u_color_3; }
  else                 { a = u_color_3; b = u_color_4; }
  vec3 ringCol = mix_oklch(a, b, local);

  vec3 col = u_palette_bg + ringCol * intensity;

  col = finish(col, v_uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(col, 1.0);
}
`;

export const loupe: Preset = {
  kind: "shader",
  id: "loupe",
  name: "Loupe",
  description:
    "Inspired by Raycast wallpapers. A tilted ring of luminous material orbiting itself — bright and tight where the flow compresses into a filament, soft and dispersed where it stretches out into a wide cloud.",
  fragmentShader: fragment,
  colorSlots: [
    { kind: "color",      key: "colorBg", label: "Background" },
    { kind: "colorArray", key: "colors",  label: "Density gradient (dense → dispersed)", minCount: 2, maxCount: 5 },
  ],
  variants: [
    {
      name: "Default",
      params: {
        colorBg: "#180a0c",
        colors: ["#ffd0b0", "#ff5070", "#7a1838"],
      },
    },
    {
      name: "Mono Dark",
      params: {
        colorBg: "#000000",
        colors: ["#ffffff", "#cccccc", "#444444"],
      },
    },
    {
      name: "Mono Light",
      params: {
        colorBg: "#bcbcbc",
        colors: ["#ffffff", "#e0e0e0", "#9a9a9a"],
      },
    },
  ],
  schema: [
    { kind: "range", key: "u_radius",            label: "Radius",            min: 0.22,  max: 0.45,  step: 0.005, default: 0.36 },
    { kind: "range", key: "u_tilt",              label: "Tilt",              min: -0.8,  max: 0.8,   step: 0.01,  default: -0.20 },
    { kind: "range", key: "u_ellipse",           label: "Foreshorten",       min: 0.35,  max: 1.0,   step: 0.01,  default: 0.55 },
    { kind: "range", key: "u_stretch",           label: "Stretch",           min: 0,     max: 0.4,   step: 0.01,  default: 0.15 },
    { kind: "range", key: "u_pulse",             label: "Pulse",             min: 0,     max: 1,     step: 0.01,  default: 0.5 },
    { kind: "range", key: "u_thinness",          label: "Filament",          min: 0.002, max: 0.012, step: 0.0005, default: 0.0035 },
    { kind: "range", key: "u_velocityContrast",  label: "Velocity contrast", min: 1,     max: 18,    step: 0.1,   default: 14 },
    { kind: "range", key: "u_skew",              label: "Skew",              min: -0.9,  max: 0.9,   step: 0.01,  default: 0.85 },
    { kind: "range", key: "u_brightness",        label: "Brightness",        min: 0.5,   max: 6,     step: 0.05,  default: 5.5 },
    { kind: "range", key: "u_speed",             label: "Speed",             min: 0,     max: 2.5,   step: 0.05,  default: 1.0 },
    { kind: "range", key: "u_grain",             label: "Grain",             min: 0,     max: 0.06,  step: 0.005, default: 0.050 },
    { kind: "range", key: "u_vignette",          label: "Vignette",          min: 0,     max: 0.6,   step: 0.02,  default: 0.32 },
    { kind: "seed",  key: "u_seed",              label: "Seed",              default: 1.234 },
  ],
  defaults: {
    u_radius: 0.36,
    u_tilt: -0.20,
    u_ellipse: 0.55,
    u_stretch: 0.15,
    u_pulse: 0.5,
    u_thinness: 0.0035,
    u_velocityContrast: 14,
    u_skew: 0.85,
    u_brightness: 5.5,
    u_speed: 1.0,
    u_grain: 0.050,
    u_vignette: 0.32,
    u_seed: 1.234,
    colorBg: "#180a0c",
    colors: ["#ffd0b0", "#ff5070", "#7a1838"],
  },
  uniforms: (params) => {
    const bg = hexToRgbTriple(typeof params.colorBg === "string" ? params.colorBg : "#190a0c");
    const cs = Array.isArray(params.colors) ? (params.colors as string[]) : [];
    const triples = cs.map(hexToRgbTriple);
    const last = triples[triples.length - 1] ?? hexToRgbTriple("#ff5070");
    return {
      u_radius:           params.u_radius,
      u_tilt:             params.u_tilt,
      u_ellipse:          params.u_ellipse,
      u_stretch:          params.u_stretch,
      u_pulse:            params.u_pulse,
      u_thinness:         params.u_thinness,
      u_velocityContrast: params.u_velocityContrast,
      u_skew:             params.u_skew,
      u_brightness:       params.u_brightness,
      u_speed:            params.u_speed,
      u_grain:            params.u_grain,
      u_vignette:         params.u_vignette,
      u_seed:             params.u_seed,
      u_palette_bg:  bg,
      u_color_0:     triples[0] ?? last,
      u_color_1:     triples[1] ?? last,
      u_color_2:     triples[2] ?? last,
      u_color_3:     triples[3] ?? last,
      u_color_4:     triples[4] ?? last,
      u_color_count: triples.length,
    };
  },
};
