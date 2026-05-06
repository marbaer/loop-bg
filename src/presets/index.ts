import { paperMeshGradient } from "./paper-mesh-gradient";
import { paperGrainGradient } from "./paper-grain-gradient";
import { paperWarp } from "./paper-warp";
import { paperLiquidMetal } from "./paper-liquid-metal";
import { paperGodRays } from "./paper-god-rays";
import { paperSmokeRing } from "./paper-smoke-ring";
import { paperNeuroNoise } from "./paper-neuro-noise";
import { paperMetaballs } from "./paper-metaballs";
import { paperSimplexNoise } from "./paper-simplex-noise";
import { paperSpiral } from "./paper-spiral";
import { paperSwirl } from "./paper-swirl";
import { paperPulsingBorder } from "./paper-pulsing-border";
import { paperDithering } from "./paper-dithering";
import { paperLogoLiquidMetal } from "./paper-logo-liquid-metal";
import { paperLogoHeatmap } from "./paper-logo-heatmap";
import { paperLogoGemSmoke } from "./paper-logo-gem-smoke";
import { softBlobs } from "./soft-blobs";
import { aurora } from "./aurora";
import { ribbons } from "./ribbons";
import { layers } from "./layers";

export const presets = [
  // Modern abstract backgrounds
  paperMeshGradient,
  paperGrainGradient,
  paperWarp,
  paperLiquidMetal,
  paperGodRays,
  paperSmokeRing,
  paperNeuroNoise,
  paperMetaballs,
  paperSimplexNoise,
  paperSpiral,
  paperSwirl,
  paperPulsingBorder,
  paperDithering,
  // Logo animations (image upload)
  paperLogoLiquidMetal,
  paperLogoHeatmap,
  paperLogoGemSmoke,
  // Hand-rolled
  softBlobs,
  aurora,
  ribbons,
  layers,
];
export type { Preset, ParamSchema, ParamValues } from "./types";
