export interface ExportRequest {
  presetId: string;
  params: Record<string, unknown>;
  palette: Record<string, unknown>;
  /** Data URL of the uploaded logo image (logo presets only). Transmitted in
   *  the POST body (no URL length concern) and forwarded to the harness via
   *  URL param so the renderer can pass it to preset.propsFor(). */
  image: string | null;
  duration: number;
  fps: number;
  width: number;
  height: number;
  format: "mp4" | "webm";
  loopMode: "linear" | "ping-pong";
}

// Keep in sync with src/presets/index.ts in the SPA repo.
const KNOWN_PRESET_IDS = new Set([
  "paper-mesh-gradient",
  "paper-grain-gradient",
  "paper-warp",
  "paper-liquid-metal",
  "paper-god-rays",
  "paper-smoke-ring",
  "paper-neuro-noise",
  "paper-metaballs",
  "paper-simplex-noise",
  "paper-spiral",
  "paper-swirl",
  "paper-pulsing-border",
  "paper-dithering",
  "paper-logo-liquid-metal",
  "paper-logo-heatmap",
  "paper-logo-gem-smoke",
  "soft-blobs",
  "aurora",
  "ribbons",
  "layers",
  "loupe",
  "blob",
  "gradient",
  "shadergradient-halo",
  "shadergradient-pensive",
  "shadergradient-mint",
  "shadergradient-interstella",
  "shadergradient-nightyNight",
  "shadergradient-violaOrientalis",
  "shadergradient-universe",
  "shadergradient-sunset",
  "shadergradient-mandarin",
  "shadergradient-cottonCandy",
]);

const VALID_FPS = new Set([24, 30, 60]);
const VALID_FORMATS = new Set(["mp4", "webm"]);
const VALID_LOOP_MODES = new Set(["linear", "ping-pong"]);

export function validate(body: unknown): ExportRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.presetId !== "string" || !KNOWN_PRESET_IDS.has(b.presetId))
    return { error: `Unknown presetId: ${b.presetId}` };

  const duration = Number(b.duration);
  if (!Number.isFinite(duration) || duration < 1 || duration > 60)
    return { error: "duration must be 1–60 seconds" };

  const fps = Number(b.fps);
  if (!VALID_FPS.has(fps)) return { error: "fps must be 24, 30, or 60" };

  const width = Number(b.width);
  const height = Number(b.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2)
    return { error: "width and height must be positive integers" };
  if (width % 2 !== 0 || height % 2 !== 0)
    return { error: "width and height must be even (yuv420p requirement)" };
  if (width > 2560 || height > 1440)
    return { error: "Maximum resolution is 2560×1440" };

  if (!VALID_FORMATS.has(b.format as string))
    return { error: "format must be mp4 or webm" };

  const loopMode = (b.loopMode as string) ?? "linear";
  if (!VALID_LOOP_MODES.has(loopMode))
    return { error: "loopMode must be linear or ping-pong" };

  if (!b.params || typeof b.params !== "object")
    return { error: "params must be an object" };

  if (!b.palette || typeof b.palette !== "object")
    return { error: "palette must be an object" };

  const image = typeof b.image === "string" ? b.image : null;

  return {
    presetId: b.presetId as string,
    params: b.params as Record<string, unknown>,
    palette: b.palette as Record<string, unknown>,
    image,
    duration,
    fps,
    width,
    height,
    format: b.format as "mp4" | "webm",
    loopMode: loopMode as "linear" | "ping-pong",
  };
}
