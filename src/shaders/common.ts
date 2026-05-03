// Helpers prepended to every preset fragment shader. All taste-critical pieces
// live here: periodic noise, OKLCH color mixing, dither, grain, vignette, tone curve.
export const commonGlsl = /* glsl */ `
precision highp float;

// ---------- periodic noise ------------------------------------------------
// 2D simplex-ish hash + value noise. Combined with the (cos(2πt), sin(2πt))
// sampling trick in callers below, this gives perfectly periodic animation.
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// Periodic noise: sample a 4D-equivalent by orbiting noise input on a circle in
// time. Period is exactly 1.0 in t.
float pnoise2(vec2 p, float t, float radius) {
  vec2 orbit = vec2(cos(6.28318530718 * t), sin(6.28318530718 * t)) * radius;
  return vnoise(p + orbit);
}

float pfbm2(vec2 p, float t, float radius) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * pnoise2(p, t, radius);
    p *= 2.0;
    a *= 0.5;
    radius *= 1.0; // keep period across octaves
  }
  return v;
}

// ---------- loop-seam guarantee -------------------------------------------
// Any sin/cos call whose argument depends on u_t MUST receive an integer
// multiple of 2π over t ∈ [0,1] — otherwise frame 0 ≠ frame N and the loop
// stutters at the seam. Use intcyc() to round any frequency-like value to a
// non-zero integer. The user-facing "speed" slider is interpreted as a coarse
// driver of cycle count: speed × ~4 → integer cycles per loop.
float intcyc(float x) {
  return max(1.0, floor(x + 0.5));
}

// ---------- smooth-min for blob blending ----------------------------------
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// ---------- OKLCH / Oklab color mixing ------------------------------------
// Reference: Björn Ottosson, https://bottosson.github.io/posts/oklab/
// taste: OKLCH lerp is THE thing that separates premium gradients from muddy ones.
vec3 srgb_to_oklab(vec3 c) {
  // assumes input is already linear-ish (we treat shader input as linear sRGB
  // for simplicity — close enough for color-mix taste improvements at this scale)
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklab_to_srgb(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 mix_oklch(vec3 a, vec3 b, float t) {
  vec3 oa = srgb_to_oklab(a);
  vec3 ob = srgb_to_oklab(b);
  vec3 om = mix(oa, ob, t);
  return oklab_to_srgb(om);
}

// Sample a 3-stop palette ramp in OKLCH (the lower, mid, and upper shades the
// caller passes in). t is in [0,1].
vec3 ramp3(vec3 lo, vec3 mid, vec3 hi, float t) {
  if (t < 0.5) return mix_oklch(lo, mid, t * 2.0);
  return mix_oklch(mid, hi, (t - 0.5) * 2.0);
}

// ---------- finishing pass ------------------------------------------------
// Applied at the end of every preset fragment shader.
//   - subtle film grain (animated, periodic)
//   - ordered dither to kill banding
//   - soft vignette
//   - mild tone curve (ACES-lite)

float ordered_dither(vec2 frag) {
  // 8x8 Bayer matrix folded into a hash-y offset. Adds ~1/255 noise — enough
  // to break banding on yuv420p without being visible.
  float x = mod(frag.x, 8.0);
  float y = mod(frag.y, 8.0);
  float i = y * 8.0 + x;
  return (i / 64.0 - 0.5) / 255.0;
}

vec3 aces_lite(vec3 x) {
  // Narkowicz ACES approximation, slightly softened for our purposes.
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 finish(vec3 color, vec2 uv, vec2 fragCoord, float t, float grainAmt, float vignetteAmt) {
  // soft vignette
  vec2 q = uv - 0.5;
  float v = 1.0 - dot(q, q) * vignetteAmt * 1.6;
  color *= v;

  // film grain (periodic in t so it loops)
  float g = (vnoise(fragCoord * 0.7 + vec2(cos(6.28318530718 * t), sin(6.28318530718 * t)) * 50.0) - 0.5) * grainAmt;
  color += g;

  // tone curve
  color = aces_lite(color);

  // dither
  color += vec3(ordered_dither(fragCoord));

  return color;
}
`;
