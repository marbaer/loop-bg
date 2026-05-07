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
  signal?: AbortSignal;
  onProgress?: (frame: number, total: number) => void;
}

export interface PaperExportResult {
  blob: Blob;
  filename: string;
}

/** Mounts the paper-design React component into a hidden DOM container at
 *  export resolution and drives its shader DETERMINISTICALLY via
 *  ShaderMount.setFrame(ms), which performs a synchronous render. We then
 *  snapshot the canvas and feed the frame into the WebCodecs encoder.
 *
 *  Why deterministic and not real-time capture:
 *  paper-design's ShaderMount listens to document visibilitychange and pauses
 *  its rAF loop when document.hidden is true. Real-time capture would freeze
 *  whenever the user switched tabs / the OS hid the window, producing static
 *  sections in the exported video. setFrame() bypasses rAF entirely, so
 *  exports are immune to focus/visibility changes and finish as fast as the
 *  GPU + encoder can chew through frames.
 *
 *  Loop mode:
 *  - "linear": straightforward forward stepping. Loop seamlessness depends on
 *    the shader's natural periodicity (most paper shaders drift forward, so
 *    this won't loop perfectly).
 *  - "ping-pong": render the first half forward, then re-render the same
 *    frame indices in reverse for the second half. Seamless by construction. */
export async function runPaperExport(args: PaperExportArgs): Promise<PaperExportResult> {
  const { preset, componentProps, config, signal, onProgress } = args;
  signal?.throwIfAborted();
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
  try {
    root = createRoot(host);
    root.render(
      createElement(preset.Component, {
        ...componentProps,
        style: { width: `${width}px`, height: `${height}px`, display: "block" },
      })
    );

    const canvas = await waitForCanvas(host, width, height, 3000);

    // ShaderMount attaches itself to the parent <div> paper-design wraps
    // around the canvas. Grab it so we can drive frames synchronously.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mount: any = (canvas.parentElement as any)?.paperShaderMount;
    if (!mount || typeof mount.setFrame !== "function") {
      throw new Error("Paper shader mount not found on canvas parent");
    }
    // Stop the auto-rAF loop so only our explicit setFrame calls advance time.
    mount.setSpeed(0);

    const speed = typeof componentProps.speed === "number" ? componentProps.speed : 1;
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

    // ShaderMount frames are "milliseconds from zero since animation start"
    // and the auto-rAF loop multiplies elapsed time by speed. Replicate that
    // here so a 10s export at speed=2 covers the same animation distance as
    // 10s of preview at speed=2.
    const frameToMs = (frameIdx: number) => (frameIdx * 1000 * speed) / config.fps;

    // iOS Safari (Metal-backed WebGL2) doesn't drain the GPU command queue
    // before `new VideoFrame(canvas)` snapshots it, so the encoder captures
    // partial / stale frames and the export flickers (both MP4 and WebM).
    // createImageBitmap synchronizes with the GPU before producing the bitmap,
    // so the snapshot reflects a fully rendered frame. Desktop Chrome hides
    // the bug with internal buffer copies; do not remove this without testing
    // on real iOS Safari.
    const captureAndEncode = async (outIdx: number) => {
      const bitmap = await createImageBitmap(canvas);
      try {
        await enc.encodeFrame(bitmap, outIdx);
      } finally {
        bitmap.close();
      }
    };

    if (config.loopMode === "ping-pong") {
      const halfFrames = Math.ceil(totalFrames / 2);
      // Forward: 0 .. halfFrames-1
      for (let i = 0; i < halfFrames; i++) {
        signal?.throwIfAborted();
        mount.setFrame(frameToMs(i));
        await captureAndEncode(i);
      }
      // Reverse: halfFrames-2 .. 0, re-rendering each frame deterministically.
      // setFrame is pure (same input → same output), so no need to buffer.
      const reverseFramesNeeded = totalFrames - halfFrames;
      for (let r = 0; r < reverseFramesNeeded; r++) {
        signal?.throwIfAborted();
        const sourceIdx = Math.max(0, halfFrames - 2 - r);
        mount.setFrame(frameToMs(sourceIdx));
        await captureAndEncode(halfFrames + r);
      }
    } else {
      for (let i = 0; i < totalFrames; i++) {
        signal?.throwIfAborted();
        mount.setFrame(frameToMs(i));
        await captureAndEncode(i);
      }
    }

    const blob = await enc.finish();
    const ext = config.format === "mp4" ? "mp4" : "webm";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `loop-bg-${preset.id}-${width}x${height}-${stamp}.${ext}`;
    return { blob, filename };
  } finally {
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
