import type { Preset } from "./types";
import { hexToRgbTriple } from "../color/palette";

// Blob — inspired by Raycast's "Blob" wallpaper line.
//
// Soft balls drift inside a flexible luminous membrane. The shape morphs
// through peanut/lobe configurations but never tears apart: ball 0 is a
// stationary anchor at the origin and balls 1–3 orbit around it, all fused
// via smin so every orbiting disk stays glued to the anchor.
//
// The membrane itself is colorless; all color comes from off-canvas lights.
// Three colored ambient lights illuminate both the blob and the background.
// One bright white key light (bottom-front) lights the blob only — it never
// reaches the background, so the scene around the blob stays dim.
//
// Edge softness is directional: pixels facing the key light stay sharp,
// pixels on the opposite side ease into mist. The bias is weighted by
// distance from the blob center to avoid a singularity at that point.
const fragment = /* glsl */ `
uniform float u_t;
uniform vec2 u_resolution;
uniform float u_aspect;

uniform vec3 u_color_bg;
uniform vec3 u_color_light1;
uniform vec3 u_color_light2;
uniform vec3 u_color_light3;
uniform vec3 u_color_key;

uniform float u_size;
uniform float u_elongate;
uniform float u_morph;
uniform float u_blur;
uniform float u_blur_var;
uniform float u_light_radius;
uniform float u_key_radius;
uniform float u_key_strength;
uniform float u_bg_brightness;
uniform float u_blob_brightness;
uniform float u_speed;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

#define TAU 6.28318530718

// Smin-merged disks. Ball 0 is stationary at the origin — the anchor.
// Balls 1–3 orbit and each one creates a distinct bulge on the membrane,
// so the shape gets genuinely lobey at high morph instead of averaging out.
// Smin with a substantial k keeps every orbiting ball glued to the anchor:
// at u_morph=2 the orbiting balls are 0.76·u_size from origin while their
// disks (radius 0.40·u_size) just touch the anchor disk's surface; the
// smin band fuses them smoothly so the blob never tears.
float blob_sdf(vec2 p) {
  float k = 0.20 * u_size;
  float d = 1e9;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float seed = u_seed * 1.7 + fi * 1.713;
    float cx = intcyc(1.0 + mod(fi, 2.0));
    float cy = intcyc(1.0 + mod(fi + 1.0, 3.0));
    float phase = seed * TAU;
    vec2 c = (i == 0) ? vec2(0.0) : u_morph * u_size * vec2(
      0.38 * sin(TAU * u_t * cx + phase),
      0.28 * cos(TAU * u_t * cy + phase * 1.27)
    );
    float r = u_size * 0.40;
    float di = length(p - c) - r;
    d = (i == 0) ? di : smin(d, di, k);
  }
  return d;
}

// Anchor positions for the four lights. All sit OUTSIDE the canvas so they
// never appear as visible hot spots — only their gradients reach into frame.
// 16:9 canvas extends roughly x=±0.89, y=±0.5; these anchors are well past
// those edges. The key (white) light hangs just below the canvas at the
// bottom-front, brighter than the others.
const vec2 LP1_ANCHOR = vec2(-1.30,  0.15);
const vec2 LP2_ANCHOR = vec2( 1.30,  0.25);
const vec2 LP3_ANCHOR = vec2( 0.10, -1.20);
const vec2 LP4_ANCHOR = vec2( 0.30, -0.85);

// Three colored ambient lights — illuminate both blob and background.
vec3 ambient_lights(vec2 q) {
  float r2 = u_light_radius * u_light_radius;

  vec2 d1 = 0.10 * vec2(
    2.0 * pfbm2(vec2(0.31, 0.41) + u_seed, u_t, intcyc(1.0)) - 1.0,
    2.0 * pfbm2(vec2(1.71, 0.21) + u_seed, u_t, intcyc(1.0)) - 1.0
  );
  vec2 d2 = 0.10 * vec2(
    2.0 * pfbm2(vec2(2.31, 1.21) + u_seed, u_t, intcyc(1.0)) - 1.0,
    2.0 * pfbm2(vec2(0.91, 3.61) + u_seed, u_t, intcyc(1.0)) - 1.0
  );
  vec2 d3 = 0.10 * vec2(
    2.0 * pfbm2(vec2(4.21, 2.41) + u_seed, u_t, intcyc(1.0)) - 1.0,
    2.0 * pfbm2(vec2(3.11, 4.81) + u_seed, u_t, intcyc(1.0)) - 1.0
  );

  vec2 v1 = q - (LP1_ANCHOR + d1);
  vec2 v2 = q - (LP2_ANCHOR + d2);
  vec2 v3 = q - (LP3_ANCHOR + d3);

  float i1 = r2 / (dot(v1, v1) + r2);
  float i2 = r2 / (dot(v2, v2) + r2);
  float i3 = r2 / (dot(v3, v3) + r2);

  return i1 * u_color_light1
       + i2 * u_color_light2
       + i3 * u_color_light3;
}

// Bright white key light from below-front — illuminates the blob only.
// (Composited into the blob layer in main(); never added to background.)
vec3 key_light(vec2 q) {
  float kr2 = u_key_radius * u_key_radius;
  vec2 d4 = 0.06 * vec2(
    2.0 * pfbm2(vec2(6.13, 0.83) + u_seed, u_t, intcyc(1.0)) - 1.0,
    2.0 * pfbm2(vec2(0.27, 5.31) + u_seed, u_t, intcyc(1.0)) - 1.0
  );
  vec2 v4 = q - (LP4_ANCHOR + d4);
  float i4 = kr2 / (dot(v4, v4) + kr2);
  return i4 * u_color_key * u_key_strength;
}

void main() {
  vec2 uv = v_uv;
  vec2 world = (uv - 0.5) * vec2(u_aspect, 1.0);

  // Slow translation of the whole blob.
  vec2 cBlob = 0.10 * vec2(
    2.0 * pfbm2(vec2(0.13, 0.71) + u_seed, u_t, intcyc(1.0)) - 1.0,
    2.0 * pfbm2(vec2(2.40, 1.10) + u_seed, u_t, intcyc(1.0)) - 1.0
  );

  // Anisotropic shape space — vertical squash so the blob naturally
  // elongates horizontally. Light field stays in canvas world space so the
  // illumination doesn't stretch with elongation.
  vec2 p = world - cBlob;
  float yScale = max(1.0 - clamp(u_elongate, 0.0, 0.95), 0.05);
  p.y /= yScale;

  float d = blob_sdf(p);

  // Directional edge softness: the side of the blob FACING the key light is
  // sharp; the side AWAY from it dissolves into mist. Direction sampled in
  // canvas world space so the soft/sharp pattern follows the actual
  // key-light direction (bottom-front by default).
  //
  // The directional bias is weighted by distance from the blob center —
  // without this, the radial direction is undefined at the center and a
  // hard discontinuity in the fallback creates a visible streak/spike.
  // Fading the bias to zero at the center kills the singularity cleanly.
  vec2 keyDir = normalize(LP4_ANCHOR);
  vec2 radialW = world - cBlob;
  float radialLen = length(radialW);
  vec2 radialDir = (radialLen > 1e-4) ? radialW / radialLen : keyDir;
  float weight = smoothstep(0.0, u_size * 0.6, radialLen);
  float alignment = dot(radialDir, keyDir);    // +1 toward key, -1 away
  float dirSoft = (0.5 - 0.5 * alignment) * weight;
  float softness = max(0.0008, u_blur * (1.0 + u_blur_var * dirSoft * 5.0));
  float cov = 1.0 - smoothstep(-softness, softness, d);

  // External lighting. Ambient colored lights bleed onto both blob and bg;
  // the white key light only lights the blob (never reaches the bg) so the
  // blob reads as "lit from in front" while the scene around it stays dim.
  vec3 ambient = ambient_lights(world);
  vec3 key     = key_light(world);
  vec3 bgLit   = u_color_bg + ambient * u_bg_brightness;
  vec3 blobLit = u_color_bg + (ambient + key) * u_blob_brightness;
  vec3 color   = mix(bgLit, blobLit, cov);

  color = finish(color, uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

export const blob: Preset = {
  kind: "shader",
  id: "blob",
  name: "Blob",
  description: "Inspired by Raycast wallpapers. Soft balls drifting inside a flexible luminous membrane, lit from off-canvas by three colored ambient lights and one bright white key light from below.",
  fragmentShader: fragment,
  colorSlots: [
    { kind: "color", key: "colorBg",     label: "Background" },
    { kind: "color", key: "colorLight1", label: "Light 1" },
    { kind: "color", key: "colorLight2", label: "Light 2" },
    { kind: "color", key: "colorLight3", label: "Light 3" },
    { kind: "color", key: "colorKey",    label: "Key light" },
  ],
  variants: [
    {
      name: "Default",
      params: {
        colorBg:     "#050308",
        colorLight1: "#4a6dff",
        colorLight2: "#8b3ee0",
        colorLight3: "#ff6b94",
        colorKey:    "#ffffff",
      },
    },
    {
      name: "Red",
      params: {
        colorBg:     "#050308",
        colorLight1: "#ff4060",
        colorLight2: "#ff5588",
        colorLight3: "#ff8055",
        colorKey:    "#ffffff",
      },
    },
  ],
  schema: [
    { kind: "range", key: "u_size",            label: "Size",          min: 0.30, max: 0.90, step: 0.01,   default: 0.80 },
    { kind: "range", key: "u_elongate",        label: "Elongation",    min: 0,    max: 0.70, step: 0.01,   default: 0.25 },
    { kind: "range", key: "u_morph",           label: "Morph amount",  min: 0,    max: 2.00, step: 0.01,   default: 1.08 },
    { kind: "range", key: "u_blur",            label: "Edge softness", min: 0.001, max: 0.30, step: 0.001, default: 0.050 },
    { kind: "range", key: "u_blur_var",        label: "Soft/solid mix",min: 0,    max: 1.00, step: 0.01,   default: 1.00 },
    { kind: "range", key: "u_light_radius",    label: "Light spread",  min: 0.20, max: 1.80, step: 0.01,   default: 0.40 },
    { kind: "range", key: "u_key_radius",      label: "Key spread",    min: 0.20, max: 1.50, step: 0.01,   default: 0.32 },
    { kind: "range", key: "u_key_strength",    label: "Key brightness", min: 0,   max: 3.50, step: 0.05,   default: 1.20 },
    { kind: "range", key: "u_bg_brightness",   label: "Background bleed", min: 0, max: 0.80, step: 0.01,   default: 0.21 },
    { kind: "range", key: "u_blob_brightness", label: "Blob brightness",  min: 0.5, max: 3.0, step: 0.05, default: 2.00 },
    { kind: "range", key: "u_speed",           label: "Speed",         min: 0,    max: 2.50, step: 0.05,   default: 0.80 },
    { kind: "range", key: "u_grain",           label: "Grain",         min: 0,    max: 0.06, step: 0.005,  default: 0.005 },
    { kind: "range", key: "u_vignette",        label: "Vignette",      min: 0,    max: 0.60, step: 0.02,   default: 0.24 },
    { kind: "seed",  key: "u_seed",            label: "Seed",                                              default: 1.7 },
  ],
  defaults: {
    u_size: 0.80,
    u_elongate: 0.25,
    u_morph: 1.08,
    u_blur: 0.050,
    u_blur_var: 1.00,
    u_light_radius: 0.40,
    u_key_radius: 0.32,
    u_key_strength: 1.20,
    u_bg_brightness: 0.21,
    u_blob_brightness: 2.00,
    u_speed: 0.80,
    u_grain: 0.005,
    u_vignette: 0.24,
    u_seed: 1.7,
    colorBg:     "#050308",
    colorLight1: "#4a6dff",
    colorLight2: "#8b3ee0",
    colorLight3: "#ff6b94",
    colorKey:    "#ffffff",
  },
  uniforms: (params) => {
    const bg  = hexToRgbTriple(typeof params.colorBg     === "string" ? params.colorBg     : "#050308");
    const l1  = hexToRgbTriple(typeof params.colorLight1 === "string" ? params.colorLight1 : "#4a6dff");
    const l2  = hexToRgbTriple(typeof params.colorLight2 === "string" ? params.colorLight2 : "#8b3ee0");
    const l3  = hexToRgbTriple(typeof params.colorLight3 === "string" ? params.colorLight3 : "#ff6b94");
    const key = hexToRgbTriple(typeof params.colorKey    === "string" ? params.colorKey    : "#ffffff");
    return {
      u_size:            params.u_size,
      u_elongate:        params.u_elongate,
      u_morph:           params.u_morph,
      u_blur:            params.u_blur,
      u_blur_var:        params.u_blur_var,
      u_light_radius:    params.u_light_radius,
      u_key_radius:      params.u_key_radius,
      u_key_strength:    params.u_key_strength,
      u_bg_brightness:   params.u_bg_brightness,
      u_blob_brightness: params.u_blob_brightness,
      u_speed:           params.u_speed,
      u_grain:           params.u_grain,
      u_vignette:        params.u_vignette,
      u_seed:            params.u_seed,
      u_color_bg:     bg,
      u_color_light1: l1,
      u_color_light2: l2,
      u_color_light3: l3,
      u_color_key:    key,
    };
  },
};
