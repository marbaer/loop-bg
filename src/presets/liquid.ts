import type { Preset } from "./types";

// True 3D liquid metal / iridescent silk via SDF raymarching.
//
// Architecture:
//   - Per-pixel ray marched into a 3D distance field where the surface is a
//     height-displaced plane (z = h(x, y, t)). Rays start above the maximum
//     possible peak and march downward (with a small tilt for parallax) until
//     they intersect the surface.
//   - Surface normal computed analytically from the height field gradient.
//   - True 3D mirror reflection: the view ray is reflected off the surface
//     normal and sampled against a procedural sky/floor environment.
//   - Soft shadows via a second raymarch from each hit point toward the sun
//     (Inigo-Quilez-style). Shadows are what make the deep dark crevices in
//     refs #2/#4 read as REAL geometry, not painted shading.
//   - Loop guarantee: the height field uses anchored standing waves (cos+sin
//     time envelopes at integer cycles), so the surface wobbles in place
//     without horizontal translation, and frame 0 == frame N.
const fragment = /* glsl */ `
precision highp float;

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

uniform float u_speed;
uniform float u_relief;
uniform float u_scale;
uniform float u_glossiness;
uniform float u_chrome;
uniform float u_iridescence;
uniform float u_horizon;
uniform float u_shadow;
uniform float u_seed;
uniform float u_grain;
uniform float u_vignette;

const float TAU = 6.28318530718;

// === HEIGHT FIELD ============================================================
// Anchored standing-wave height field (no horizontal drift over t). Returns
// height h and analytic 2D gradient grad. Used both as the SDF z-offset and
// for surface-normal computation.
void heightField(vec2 p, out float h, out vec2 grad) {
  h = 0.0;
  grad = vec2(0.0);

  // Classic fBm: each octave doubles in frequency and halves in amplitude.
  // The lowest octave dominates and produces the big sweeping forms; higher
  // octaves only add subtle perturbation.
  for (int i = 0; i < 5; i++) {
    float fi = float(i);

    // Two anchored spatial patterns per component, with different directions
    // and frequencies. Their crests don't translate with t.
    float angleA = TAU * (fi * 0.27 + u_seed * 0.13) + 0.7 * fi;
    float angleB = TAU * (fi * 0.19 + u_seed * 0.41 + 0.37) + 0.7 * (fi + 0.5);
    vec2 dA = vec2(cos(angleA), sin(angleA));
    vec2 dB = vec2(cos(angleB), sin(angleB));

    float baseFreq = u_scale * 0.55 * pow(2.0, fi);
    float fA = baseFreq;
    float fB = baseFreq * 1.21;

    float phaseA = (u_seed * 1.7 + fi * 0.31) * TAU;
    float phaseB = (u_seed * 2.3 + fi * 0.71) * TAU;

    float aA = TAU * dot(dA, p) * fA + phaseA;
    float aB = TAU * dot(dB, p) * fB + phaseB;

    // Standing-wave time envelope at integer cycles → loop-perfect.
    float cyc = intcyc(u_speed + fi * 0.4);
    float env1 = cos(TAU * u_t * cyc);
    float env2 = sin(TAU * u_t * cyc);

    // fBm amplitude: 1/2^i. Lowest octave (big fold) is amp 1.0; finest is
    // amp 0.0625 — barely perceptible surface texture, like fabric weave.
    float amp = pow(0.5, fi);
    h += amp * (sin(aA) * env1 + sin(aB) * env2);
    grad += amp * TAU * (dA * fA * cos(aA) * env1 + dB * fB * cos(aB) * env2);
  }
  // Normalize: total amp converges to 2 (geometric sum). Scale h back so it
  // ranges ~[-1,1] like before so existing relief slider behaves consistently.
  h *= 0.5;
  grad *= 0.5;
}

// === SDF =====================================================================
// The surface is the height-displaced plane z = h * u_relief.
// Above the surface: positive distance estimate; below: negative.
// This isn't a true Euclidean distance for oblique rays — only an upper bound
// in the vertical direction — so we step conservatively (× 0.6).
float sceneSDF(vec3 p) {
  float h;
  vec2 grad;
  heightField(p.xy, h, grad);
  return p.z - h * u_relief;
}

// Analytic surface normal. For SDF f(x,y,z) = z - h(x,y)*relief, the gradient
// is (-relief * dh/dx, -relief * dh/dy, 1). Normalize.
vec3 surfaceNormal(vec3 p) {
  float h;
  vec2 grad;
  heightField(p.xy, h, grad);
  return normalize(vec3(-grad * u_relief, 1.0));
}

// === RAYMARCH ================================================================
// Returns hit distance along the ray, or -1 on miss.
float raymarch(vec3 ro, vec3 rd, out int steps) {
  float t = 0.0;
  const int MAX_STEPS = 96;
  const float MAX_DIST = 5.0;
  const float HIT_EPS = 0.0008;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < HIT_EPS) {
      steps = i;
      return t;
    }
    if (t > MAX_DIST) {
      steps = i;
      return -1.0;
    }
    // Conservative step: the SDF is an over-estimate for non-vertical rays.
    t += max(d * 0.6, 0.001);
  }
  steps = MAX_STEPS;
  return -1.0;
}

// Inigo-Quilez-style soft shadow: march from the surface point toward the
// light; if the ray gets close to other geometry, partial shadow. Returns
// 1.0 = unshadowed, 0.0 = fully shadowed.
float softShadow(vec3 ro, vec3 rd, float k) {
  float res = 1.0;
  float t = 0.01;
  for (int i = 0; i < 28; i++) {
    float h = sceneSDF(ro + rd * t);
    if (h < 0.0005) return 0.0;
    res = min(res, k * h / t);
    t += max(h * 0.65, 0.004);
    if (t > 1.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

// === ENVIRONMENT =============================================================
// Procedural studio environment approximating an HDRI map: multiple softboxes
// at varying angular sizes, a key light, and a horizon-tinted base. Produces
// the bright varied streaks across the chrome surface.
vec3 envSky(vec3 r) {
  float h = clamp(u_horizon, 0.05, 1.0);

  // Base gradient: dark warm floor to bright cool sky.
  float skyT = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  float ground = smoothstep(0.5 - h * 0.4, 0.5 + h * 0.4, skyT);
  vec3 floorCol = u_palette_shade0;
  vec3 skyCol = u_palette_shade4;
  vec3 base = mix(floorCol, skyCol, ground);

  // KEY LIGHT — large bright softbox upper-left. Produces the dominant
  // bright streaks on ridges facing toward it.
  vec3 K = normalize(vec3(-0.45, 0.7, 0.55));
  float key = pow(max(dot(r, K), 0.0), 6.0);
  base += vec3(1.0, 0.99, 0.98) * key * 1.4;

  // FILL LIGHT — softer, warmer, opposite side.
  vec3 F = normalize(vec3(0.55, 0.4, 0.5));
  float fill = pow(max(dot(r, F), 0.0), 12.0);
  base += vec3(1.0, 0.96, 0.92) * fill * 1.0;

  // RIM — sharp, narrow, behind. Gives the thin bright edge highlights.
  vec3 Rim = normalize(vec3(0.0, 0.55, -0.7));
  float rim = pow(max(dot(r, Rim), 0.0), 60.0);
  base += vec3(1.0) * rim * 1.6;

  // Tight bright "window" highlight — the very crisp white streaks.
  vec3 W = normalize(vec3(0.3, 0.85, 0.4));
  float win = pow(max(dot(r, W), 0.0), 200.0);
  base += vec3(1.0) * win * 3.0;

  // Iridescent variant: blend in a palette-driven hue cycle on top of the
  // studio (refs #2 silk look).
  vec3 iri = ramp3(u_palette_secondary, u_palette_primary, u_palette_shade3, skyT);
  vec3 col = mix(base, base * 0.4 + iri * 0.85, u_iridescence);

  // Chrome variant: nearly achromatic studio reflection. Floor is medium-gray
  // (not black) so deep crevices in the surface still read as polished metal
  // reflecting bounced light, not as voids.
  vec3 chromeBase = mix(vec3(0.32), vec3(0.82), ground);
  chromeBase += vec3(1.0, 0.99, 0.98) * key * 1.4;
  chromeBase += vec3(1.0, 0.96, 0.92) * fill * 1.0;
  chromeBase += vec3(1.0) * rim * 1.6;
  chromeBase += vec3(1.0) * win * 3.0;
  // Subtle palette tint for "blue-silver" / "warm-silver" character.
  vec3 tintNorm = u_palette_primary / max(max(u_palette_primary.r, u_palette_primary.g), max(u_palette_primary.b, 0.001));
  chromeBase = mix(chromeBase, chromeBase * (0.85 + 0.15 * tintNorm), 0.35);
  return mix(col, chromeBase, u_chrome);
}

void main() {
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(u_aspect, 1.0);

  // Camera: orthographic top-down with a slight forward tilt for parallax.
  // ro starts well above the maximum possible peak height (relief * ~2.5)
  // so the surface SDF is reliably positive at t=0.
  vec3 ro = vec3(p, u_relief * 3.0 + 1.5);
  vec3 rd = normalize(vec3(0.0, 0.32, -1.0));

  int steps;
  float td = raymarch(ro, rd, steps);

  vec3 color;
  if (td < 0.0) {
    color = u_palette_bg;
  } else {
    vec3 hit = ro + rd * td;
    vec3 n = surfaceNormal(hit);
    vec3 v = -rd; // view direction toward camera

    // Sun direction — fixed in world space so highlights "stay put" as the
    // surface wobbles, which matches how light works in real life.
    vec3 L = normalize(vec3(0.45, 0.75, 0.6));

    // Real 3D shadows from one fold occluding another.
    float shadow = mix(1.0, softShadow(hit + n * 0.002, L, 28.0), u_shadow);

    // Mirror reflection of env map by reflection ray direction.
    vec3 r = reflect(rd, n);
    vec3 env = envSky(r);

    // Sharp directional sun specular (Blinn).
    float shininess = mix(40.0, 700.0, u_glossiness);
    vec3 H = normalize(L + v);
    float specHi = pow(max(dot(n, H), 0.0), shininess);

    // Fresnel — grazing-angle brightness.
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

    // Compose. Real metal has zero diffuse — everything is reflection.
    color = env;
    color += env * fres * 0.5;
    color += vec3(1.0) * specHi * shadow * (0.7 + 0.6 * u_glossiness);

    // Subtle AO from height: deeper valleys → slightly darker base.
    float ao = clamp(0.78 + 0.22 * (hit.z / max(u_relief, 0.001)), 0.5, 1.05);
    color *= ao;

    // Darken in the deepest crevices. The amount depends on the chrome dial
    // — chrome should keep deep gray (not pure black) so reflections still
    // read; colored metal can crush to bg for dramatic gold/silk.
    float depth = clamp(0.5 - hit.z / max(u_relief, 0.001) * 0.4, 0.0, 1.0);
    float darknessAmt = mix(0.5, 0.18, u_chrome);
    color = mix(color, u_palette_bg, pow(depth, 3.0) * darknessAmt);

    // Apply shadow term — softer on chrome (real polished chrome has lifted
    // shadows because it reflects bounce light from everywhere).
    float shadowFloor = mix(0.55, 0.78, u_chrome);
    color *= mix(shadowFloor, 1.0, shadow);
  }

  color = finish(color, uv, gl_FragCoord.xy, u_t, u_grain, u_vignette);
  fragColor = vec4(color, 1.0);
}
`;

export const liquid: Preset = {
  kind: "shader",
  id: "liquid",
  name: "Liquid",
  description: "True 3D liquid metal / iridescent silk via SDF raymarching.",
  fragmentShader: fragment,
  schema: [
    { kind: "range", key: "u_speed", label: "Wobble speed", min: 0.05, max: 1.5, step: 0.05, default: 0.3 },
    { kind: "range", key: "u_relief", label: "Relief", min: 0.05, max: 0.7, step: 0.01, default: 0.45 },
    { kind: "range", key: "u_scale", label: "Fold scale", min: 0.3, max: 2.5, step: 0.05, default: 0.55 },
    { kind: "range", key: "u_glossiness", label: "Glossiness", min: 0, max: 1, step: 0.02, default: 0.85 },
    { kind: "range", key: "u_horizon", label: "Horizon sharpness", min: 0.05, max: 1.0, step: 0.02, default: 0.4 },
    { kind: "range", key: "u_shadow", label: "Shadow strength", min: 0, max: 1, step: 0.02, default: 0.9 },
    { kind: "range", key: "u_chrome", label: "Chrome", min: 0, max: 1, step: 0.02, default: 0.0 },
    { kind: "range", key: "u_iridescence", label: "Iridescence", min: 0, max: 1, step: 0.02, default: 0.15 },
    { kind: "range", key: "u_grain", label: "Grain", min: 0, max: 0.06, step: 0.005, default: 0.012 },
    { kind: "range", key: "u_vignette", label: "Vignette", min: 0, max: 0.6, step: 0.02, default: 0.22 },
    { kind: "seed", key: "u_seed", label: "Seed", default: 0.314 },
  ],
  defaults: {
    u_speed: 0.3,
    u_relief: 0.45,
    u_scale: 0.55,
    u_glossiness: 0.85,
    u_horizon: 0.4,
    u_shadow: 0.9,
    u_chrome: 0.0,
    u_iridescence: 0.15,
    u_grain: 0.012,
    u_vignette: 0.22,
    u_seed: 0.314,
  },
  uniforms: (params) => ({
    u_speed: params.u_speed,
    u_relief: params.u_relief,
    u_scale: params.u_scale,
    u_glossiness: params.u_glossiness,
    u_horizon: params.u_horizon,
    u_shadow: params.u_shadow,
    u_chrome: params.u_chrome,
    u_iridescence: params.u_iridescence,
    u_grain: params.u_grain,
    u_vignette: params.u_vignette,
    u_seed: params.u_seed,
  }),
};
