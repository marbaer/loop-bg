import { converter, parse, formatHex } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

/** Generate N shades from a single source color. The shades span lightness
 *  while keeping hue and a tapered chroma — by default a perceptually-spaced
 *  ramp from dark to light. Used to populate a paper-shader colors array
 *  from a single brand color. */
export function shadesFromColor(sourceHex: string, count: number): string[] {
  const src = toOklch(parse(sourceHex)) ?? { mode: "oklch" as const, l: 0.6, c: 0.16, h: 250 };
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5; // 0..1
    // L spans 0.22..0.88 — gives a wide visual range without crushed blacks or blown whites
    const l = 0.22 + t * 0.66;
    // Chroma tapers off at the ends (very dark / very light → less saturated)
    const cFalloff = 1 - Math.abs(t - 0.5) * 2 * 0.55;
    const c = Math.min(0.32, (src.c ?? 0.16) * cFalloff * 1.05);
    const rgb = toRgb({ mode: "oklch", l, c, h: src.h ?? 250 });
    if (rgb) {
      out.push(
        formatHex({
          mode: "rgb",
          r: Math.max(0, Math.min(1, rgb.r)),
          g: Math.max(0, Math.min(1, rgb.g)),
          b: Math.max(0, Math.min(1, rgb.b)),
        })
      );
    } else {
      out.push("#000000");
    }
  }
  return out;
}
