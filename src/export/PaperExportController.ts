import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type { PaperPreset } from "../presets/types";
import type { ExportConfig } from "../state/store";
import { detectCapabilities } from "./capabilities";
import { createWebCodecsEncoder } from "./WebCodecsEncoder";

export interface PaperExportArgs {
  preset: PaperPreset;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps: Record<string, any>;
  config: ExportConfig;
  onProgress?: (frame: number, total: number) => void;
}

export interface PaperExportResult {
  blob: Blob;
  filename: string;
}

/** Mounts the paper-design React component into a hidden DOM container at
 *  export resolution, captures frames in real time, and feeds them into the
 *  existing WebCodecs encoder.
 *
 *  Loop mode:
 *  - "linear": straightforward real-time capture for the full duration. Loop
 *    seamlessness depends on the shader's natural periodicity (most paper
 *    shaders drift forward, so this won't loop perfectly).
 *  - "ping-pong": capture the first half forward into ImageBitmaps, then
 *    encode them in reverse for the second half. The result is guaranteed
 *    seamless because frame[N] == frame[0] by construction. Wall-time is
 *    duration/2 for capture + small encode overhead. */
export async function runPaperExport(args: PaperExportArgs): Promise<PaperExportResult> {
  const { preset, componentProps, config, onProgress } = args;
  const caps = await detectCapabilities();
  if (!caps.webCodecs || (config.format === "mp4" ? !caps.h264 : !caps.vp9)) {
    throw new Error(`WebCodecs ${config.format} encoding not supported in this browser.`);
  }

  const width = config.width % 2 === 0 ? config.width : config.width - 1;
  const height = config.height % 2 === 0 ? config.height : config.height - 1;

  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "pointer-events:none",
    "opacity:0",
  ].join(";");
  document.body.appendChild(host);

  let root: Root | null = null;
  const captured: ImageBitmap[] = [];
  try {
    root = createRoot(host);
    root.render(
      createElement(preset.Component, {
        ...componentProps,
        style: { width: `${width}px`, height: `${height}px`, display: "block" },
      })
    );

    const canvas = await waitForCanvas(host, width, height, 3000);
    const totalFrames = Math.round(config.durationSeconds * config.fps);
    const enc = await createWebCodecsEncoder({
      width,
      height,
      fps: config.fps,
      durationSeconds: config.durationSeconds,
      format: config.format,
      quality: config.quality,
      onProgress,
    });

    const frameInterval = 1000 / config.fps;

    if (config.loopMode === "ping-pong") {
      // Capture the FORWARD half. We need ceil(totalFrames/2) so the math
      // works out for both even and odd totals.
      const halfFrames = Math.ceil(totalFrames / 2);
      let lastTickAt = performance.now();
      for (let i = 0; i < halfFrames; i++) {
        const target = lastTickAt + frameInterval;
        while (performance.now() < target) {
          await new Promise((r) => setTimeout(r, 0));
        }
        lastTickAt = target;
        // Snapshot the live canvas. createImageBitmap is GPU-friendly and
        // cheaper than getImageData/PNG.
        const bmp = await createImageBitmap(canvas);
        captured.push(bmp);
        onProgress?.(i + 1, totalFrames);
      }

      // Encode FORWARD: 0 .. halfFrames-1
      for (let i = 0; i < halfFrames; i++) {
        await enc.encodeFrame(captured[i], i);
      }
      // Encode REVERSE for the second half. Skip the boundary frame
      // (halfFrames-1 already played) so motion is smooth at the turnaround,
      // and skip frame 0 so when the video loops, frame 0 doesn't repeat.
      // Forward played: 0,1,...,H-1
      // Reverse plays: H-2, H-3, ..., 1, 0   (H-1 frames)
      // Total: H + (H-1) = 2H-1
      // We need exactly totalFrames; pad/trim by adjusting the reverse range.
      const reverseFramesNeeded = totalFrames - halfFrames;
      for (let r = 0; r < reverseFramesNeeded; r++) {
        // Map r=0..reverseFramesNeeded-1 to source indices halfFrames-2..end.
        // Clamp at 0 to handle the unlikely case where reverseFramesNeeded > halfFrames-1.
        const sourceIdx = Math.max(0, halfFrames - 2 - r);
        await enc.encodeFrame(captured[sourceIdx], halfFrames + r);
      }
    } else {
      // Linear: real-time capture, encode each frame as it arrives.
      let lastTickAt = performance.now();
      for (let i = 0; i < totalFrames; i++) {
        const target = lastTickAt + frameInterval;
        while (performance.now() < target) {
          await new Promise((r) => setTimeout(r, 0));
        }
        lastTickAt = target;
        await enc.encodeFrame(canvas, i);
      }
    }

    const blob = await enc.finish();
    const ext = config.format === "mp4" ? "mp4" : "webm";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `loop-bg-${preset.id}-${width}x${height}-${stamp}.${ext}`;
    return { blob, filename };
  } finally {
    for (const bmp of captured) {
      try {
        bmp.close();
      } catch {
        /* noop */
      }
    }
    if (root) {
      try {
        root.unmount();
      } catch {
        /* noop */
      }
    }
    if (host.parentElement) host.parentElement.removeChild(host);
  }
}

async function waitForCanvas(
  host: HTMLElement,
  width: number,
  height: number,
  timeoutMs: number
): Promise<HTMLCanvasElement> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const c = host.querySelector("canvas") as HTMLCanvasElement | null;
    if (c && c.width >= Math.min(width, 2) && c.height >= Math.min(height, 2)) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      return c;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("Paper shader canvas never mounted within timeout");
}
