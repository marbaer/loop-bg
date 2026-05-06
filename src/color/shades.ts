import { converter, parse, formatHex } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

/** Returns the most saturated color — the one the user likely picked as their
 *  "main" brand color when generating shades. Falls back to the last (lightest)
 *  color if all chroma values are similar. */
export function findMainColor(colors: string[]): string {
  if (colors.length === 0) return "#000000";
  if (colors.length === 1) return colors[0];
  let best = colors[colors.length - 1];
  let bestC = -Infinity;
  for (const hex of colors) {
    const c = toOklch(parse(hex))?.c ?? 0;
    if (c > bestC) { bestC = c; best = hex; }
  }
  return best;
}

/** Returns the darkest color (lowest OKLCH lightness). */
export function findDarkestColor(colors: string[]): string {
  if (colors.length === 0) return "#000000";
  let best = colors[0];
  let bestL = Infinity;
  for (const hex of colors) {
    const l = toOklch(parse(hex))?.l ?? 1;
    if (l < bestL) { bestL = l; best = hex; }
  }
  return best;
}

/** Generate a plain dark→light ramp of N stops at the given color's hue/chroma,
 *  without anchoring any specific color. Used as a base for gap-filling. */
export function plainRamp(referenceHex: string, count: number): string[] {
  const src = toOklch(parse(referenceHex)) ?? { mode: "oklch" as const, l: 0.6, c: 0.16, h: 250 };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const l = 0.22 + t * 0.66;
    const cFalloff = 1 - Math.abs(t - 0.5) * 2 * 0.55;
    const c = Math.min(0.32, (src.c ?? 0.16) * cFalloff * 1.05);
    const rgb = toRgb({ mode: "oklch", l, c, h: src.h ?? 250 });
    out.push(
      rgb
        ? formatHex({ mode: "rgb", r: Math.max(0, Math.min(1, rgb.r)), g: Math.max(0, Math.min(1, rgb.g)), b: Math.max(0, Math.min(1, rgb.b)) })
        : "#000000"
    );
  }
  return out;
}

/** Generate N shades from a single source color. The shades span lightness
 *  while keeping hue and a tapered chroma — by default a perceptually-spaced
 *  ramp from dark to light. Used to populate a paper-shader colors array
 *  from a single brand color. */
export function shadesFromColor(sourceHex: string, count: number): string[] {
  const src = toOklch(parse(sourceHex)) ?? { mode: "oklch" as const, l: 0.6, c: 0.16, h: 250 };
  const L_MIN = 0.22;
  const L_MAX = 0.88;
  const out: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const l = L_MIN + t * (L_MAX - L_MIN);
    const cFalloff = 1 - Math.abs(t - 0.5) * 2 * 0.55;
    const c = Math.min(0.32, (src.c ?? 0.16) * cFalloff * 1.05);
    const rgb = toRgb({ mode: "oklch", l, c, h: src.h ?? 250 });
    out.push(
      rgb
        ? formatHex({ mode: "rgb", r: Math.max(0, Math.min(1, rgb.r)), g: Math.max(0, Math.min(1, rgb.g)), b: Math.max(0, Math.min(1, rgb.b)) })
        : "#000000"
    );
  }

  // Snap the stop closest to the source color's lightness to the exact source hex
  // so the picked color always appears in the output.
  const srcL = Math.max(L_MIN, Math.min(L_MAX, src.l ?? 0.6));
  const srcT = (srcL - L_MIN) / (L_MAX - L_MIN);
  let closest = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const d = Math.abs(t - srcT);
    if (d < bestDist) { bestDist = d; closest = i; }
  }
  out[closest] = formatHex(parse(sourceHex) ?? { mode: "rgb", r: 0, g: 0, b: 0 });

  return out;
}
