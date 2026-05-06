import { converter, formatHex, parse, type Oklch } from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");

export interface Palette {
  /** sRGB hex, e.g. "#0b0b0e" */
  bg: string;
  surface: string;
  primary: string;
  secondary: string;
  /** 5-stop ramp from dark→light, OKLCH-spaced. */
  shades: [string, string, string, string, string];
  /** Same colors as Float32 RGB triples in linear-ish sRGB (0..1) for shader uniforms. */
  rgb: {
    bg: [number, number, number];
    primary: [number, number, number];
    secondary: [number, number, number];
    shades: Array<[number, number, number]>;
  };
}

export function hexToRgbTriple(hex: string): [number, number, number] {
  const c = toRgb(parse(hex));
  if (!c) return [0, 0, 0];
  return [c.r, c.g, c.b];
}

function clampOklch(c: Oklch): Oklch {
  // Clamp chroma so out-of-gamut accents don't clip.
  const maxC = 0.32;
  return {
    mode: "oklch",
    l: Math.max(0, Math.min(1, c.l ?? 0)),
    c: Math.max(0, Math.min(maxC, c.c ?? 0)),
    h: c.h ?? 0,
    alpha: 1,
  };
}

function toHex(c: Oklch): string {
  const rgb = toRgb(c);
  if (!rgb) return "#000000";
  // gamut-clip via culori's rgb conversion, then format
  return formatHex({
    mode: "rgb",
    r: Math.max(0, Math.min(1, rgb.r)),
    g: Math.max(0, Math.min(1, rgb.g)),
    b: Math.max(0, Math.min(1, rgb.b)),
  });
}

export type PaletteSlot = "bg" | "surface" | "primary" | "secondary";
export type PaletteOverrides = Partial<Record<PaletteSlot, string>>;

export interface BuildOptions {
  /** 0..1 — shifts the background L within a tasteful range. 0.5 = the default. */
  bgLightness?: number;
  /** Per-slot manual overrides; any provided slot wins over the derived value. */
  overrides?: PaletteOverrides;
}

export function buildPalette(
  accentHex: string,
  mode: "dark" | "light",
  opts: BuildOptions = {}
): Palette {
  const accent = toOklch(parse(accentHex)) ?? { mode: "oklch", l: 0.6, c: 0.18, h: 250 };
  const accentClamped = clampOklch(accent as Oklch);

  // bgLightness slider remaps within [0.05, 0.42] for dark mode and [0.85, 1.0]
  // for light mode, centered on the default at 0.5.
  const bgL01 = opts.bgLightness ?? 0.5;
  const bgL =
    mode === "dark"
      ? 0.05 + (0.42 - 0.05) * bgL01
      : 0.85 + (1.0 - 0.85) * bgL01;

  const bg: Oklch = { mode: "oklch", l: bgL, c: 0.02, h: accentClamped.h };

  const surfaceL = mode === "dark" ? Math.min(0.5, bgL + 0.04) : Math.max(0.78, bgL - 0.04);
  const surface: Oklch = { mode: "oklch", l: surfaceL, c: 0.025, h: accentClamped.h };

  // Secondary: analogous, +30° in hue.
  const secondary: Oklch = {
    mode: "oklch",
    l: accentClamped.l,
    c: accentClamped.c * 0.9,
    h: ((accentClamped.h ?? 0) + 30) % 360,
  };

  // Shade ramp around the accent — perceptually-uniform L spacing, with chroma
  // tapered at the extremes.
  const lights = [0.22, 0.4, accentClamped.l, 0.78, 0.94] as const;
  const chromas = [accentClamped.c * 0.4, accentClamped.c * 0.85, accentClamped.c, accentClamped.c * 0.7, accentClamped.c * 0.3];
  const shades = lights.map((l, i) =>
    toHex({
      mode: "oklch",
      l,
      c: chromas[i],
      h: accentClamped.h,
    })
  ) as [string, string, string, string, string];

  // Per-slot overrides win over the derived value.
  const ov = opts.overrides ?? {};
  const bgHex = ov.bg ?? toHex(bg);
  const surfaceHex = ov.surface ?? toHex(surface);
  const primaryHex = ov.primary ?? toHex(accentClamped);
  const secondaryHex = ov.secondary ?? toHex(secondary);

  return {
    bg: bgHex,
    surface: surfaceHex,
    primary: primaryHex,
    secondary: secondaryHex,
    shades,
    rgb: {
      bg: hexToRgbTriple(bgHex),
      primary: hexToRgbTriple(primaryHex),
      secondary: hexToRgbTriple(secondaryHex),
      shades: shades.map(hexToRgbTriple),
    },
  };
}
