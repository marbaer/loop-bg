import { Renderer } from "../render/Renderer";
import type { Preset, ParamValues } from "../presets/types";
import type { Palette } from "../color/palette";
import type { ExportConfig } from "../state/store";
import { detectCapabilities } from "./capabilities";
import { createWebCodecsEncoder } from "./WebCodecsEncoder";

export interface ExportArgs {
  preset: Preset;
  params: ParamValues;
  palette: Palette;
  config: ExportConfig;
  onProgress?: (frame: number, total: number) => void;
}

/** R3F-preset export path is intentionally NOT implemented yet — that's a
 *  separate piece of work (off-screen R3F render via three.js WebGLRenderer
 *  with deterministic frame stepping). */

export interface ExportResult {
  blob: Blob;
  encoder: "webcodecs" | "ffmpeg-fallback";
  filename: string;
}

/**
 * Render N = duration * fps frames deterministically with t = i/N (NOT i/(N-1))
 * so frame 0 and frame N are identical — guaranteeing a seamless loop.
 */
export async function runExport(args: ExportArgs): Promise<ExportResult> {
  const { preset, params, palette, config, onProgress } = args;
  if (preset.kind !== "shader") {
    throw new Error(
      `Export not yet supported for "${preset.kind}" presets. The R3F export ` +
        `pipeline (offscreen Three.js render + frame capture) is the next thing to build.`
    );
  }
  const totalFrames = Math.round(config.durationSeconds * config.fps);

  const caps = await detectCapabilities();
  if (!caps.webCodecs || (config.format === "mp4" ? !caps.h264 : !caps.vp9)) {
    throw new Error(
      `WebCodecs ${config.format} encoding not supported in this browser. ` +
        `Try a different format, or use Chrome/Edge/Safari 16.4+/Firefox 130+.`
    );
  }

  // Even-dimension guard for yuv420p chroma subsampling.
  const width = config.width % 2 === 0 ? config.width : config.width - 1;
  const height = config.height % 2 === 0 ? config.height : config.height - 1;

  const offscreen = new OffscreenCanvas(width, height);
  const renderer = new Renderer(offscreen);

  const enc = await createWebCodecsEncoder({
    width,
    height,
    fps: config.fps,
    durationSeconds: config.durationSeconds,
    format: config.format,
    quality: config.quality,
    onProgress,
  });

  // For seamless export, the shader must complete an INTEGER number of cycles
  // over the captured duration. With preview's continuous time-scaling we get
  // smooth speed control, but export captures a fixed number of frames — so we
  // snap effective cycles to the nearest integer (≥1, or 0 for static).
  const rawSpeed = typeof (params as Record<string, unknown>).u_speed === "number"
    ? ((params as Record<string, unknown>).u_speed as number)
    : 1;
  const cycles = rawSpeed === 0 ? 0 : Math.max(1, Math.round(rawSpeed));
  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames; // critical: not i/(totalFrames-1)
    const tScaled = cycles === 0 ? 0 : (t * cycles) % 1;
    renderer.render(preset, params, palette, tScaled, width, height);
    // Read GPU work into a VideoFrame via the canvas itself.
    await enc.encodeFrame(offscreen, i);
  }

  const blob = await enc.finish();
  renderer.dispose();

  const ext = config.format === "mp4" ? "mp4" : "webm";
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `loop-bg-${preset.id}-${width}x${height}-${stamp}.${ext}`;

  return { blob, encoder: "webcodecs", filename };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
