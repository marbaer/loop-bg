import { createRoot, type Root } from "react-dom/client";
import { createElement, useEffect, useState, type ReactNode } from "react";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import type { ShaderGradientPreset, ParamValues } from "../presets/types";
import type { ExportConfig } from "../state/store";
import { detectCapabilities } from "./capabilities";
import { createWebCodecsEncoder } from "./WebCodecsEncoder";

export interface ShaderGradientExportArgs {
  preset: ShaderGradientPreset;
  params: ParamValues;
  config: ExportConfig;
  signal?: AbortSignal;
  onProgress?: (frame: number, total: number) => void;
}

export interface ShaderGradientExportResult {
  blob: Blob;
  filename: string;
}

/** Mounts a hidden ShaderGradient at export resolution and drives uTime
 *  deterministically frame-by-frame. Like PaperExportController, this avoids
 *  the rAF-driven preview loop so exports survive tab blur / OS hide and run
 *  as fast as the GPU can chew through frames.
 *
 *  Time model:
 *  ShaderGradient with `animate: "off"` reads uTime directly from the prop.
 *  We push uTime updates from the controller via a state setter exposed
 *  through a render-prop bridge, then wait two rAFs (one for React reconcile,
 *  one for the R3F render to flush) before capturing.
 *
 *  Two seam strategies, picked by the user-facing `loop` param:
 *  - `loop: "on"`: shader-native seamless loop. The GLSL's uLoop=1 branch
 *    samples 4 noise values around a closed circle, so frame 0 and frame N
 *    are identical by construction. We capture forward only.
 *  - `loop: "off"`: linear time progression (matches upstream's tuned visual
 *    character). The export uses `config.loopMode` to make it seamless:
 *      • "ping-pong" — capture forward half, mirror it for the second half
 *      • "linear"    — straight forward, first/last frames won't match
 */
export async function runShaderGradientExport(
  args: ShaderGradientExportArgs
): Promise<ShaderGradientExportResult> {
  const { preset, params, config, signal, onProgress } = args;
  signal?.throwIfAborted();
  const caps = await detectCapabilities();
  if (!caps.webCodecs || (config.format === "mp4" ? !caps.h264 : !caps.vp9)) {
    throw new Error(`WebCodecs ${config.format} encoding not supported in this browser.`);
  }

  const width = config.width % 2 === 0 ? config.width : config.width - 1;
  const height = config.height % 2 === 0 ? config.height : config.height - 1;

  const host = document.createElement("div");
  // iOS Safari throttles requestAnimationFrame for elements outside the visual
  // viewport, which stalls R3F's continuous frameloop and leaves the WebGL
  // backbuffer black. Keep the host on-screen at full export resolution and
  // hide it via clip-path + opacity instead of left:-99999px.
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "pointer-events:none",
    "opacity:0",
    "z-index:-1",
    "clip-path:inset(0 calc(100% - 1px) calc(100% - 1px) 0)",
  ].join(";");
  document.body.appendChild(host);

  // Pull color1/2/3 out of the colors array (the same expansion the live
  // preview does — see ShaderGradientPreview).
  const colors = Array.isArray(params.colors) ? (params.colors as string[]) : [];
  const loopOn = params.loop === "on";
  const baseProps: Record<string, unknown> = {
    ...(params as Record<string, unknown>),
    color1: colors[0] ?? "#ffffff",
    color2: colors[1] ?? "#ffffff",
    color3: colors[2] ?? "#ffffff",
    animate: "off" as const,
    enableCameraUpdate: false,
    control: "props" as const,
    // When loop is on, set loopDuration so the GLSL's uLoop=1 branch maps
    // uTime ∈ [0, durationSeconds) to one full closed-circle traversal.
    ...(loopOn ? { loopDuration: config.durationSeconds } : {}),
    // Skip the camera-controls smooth-transition animation that fires on
    // mount — otherwise the first ~30 frames capture the camera easing into
    // its final pose instead of holding still at the user's chosen pose.
    enableTransition: false,
    smoothTime: 0,
  };
  delete baseProps.colors;

  let setExternalUTime: ((t: number) => void) | null = null;

  function ExportBridge({ onReady }: { onReady: (setter: (t: number) => void) => void }): ReactNode {
    const [uTime, setUTime] = useState(0);
    useEffect(() => {
      onReady(setUTime);
    }, [onReady]);
    return createElement(ShaderGradientCanvas, {
      style: { width: `${width}px`, height: `${height}px` },
      pixelDensity: 1,
      preserveDrawingBuffer: true,
      // ShaderGradientCanvas uses an IntersectionObserver-based lazyLoad path
      // by default. The export host is clipped to a 1px footprint, which
      // makes the observer's intersection ratio negligible; force eager mount.
      lazyLoad: false,
      children: createElement(ShaderGradient, { ...baseProps, uTime }),
    });
  }

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      createElement(ExportBridge, {
        onReady: (setter) => {
          setExternalUTime = setter;
        },
      })
    );

    // Wait for the canvas to mount and the bridge to expose its setter.
    const canvas = await waitForCanvas(host, width, height, 5000);
    await waitFor(() => setExternalUTime !== null, 1000, "uTime setter never registered");
    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;

    // uTime is fed in raw seconds. In loop mode the GLSL maps uTime through
    // uTime/uLoopDuration; in linear mode it uses uTime*uSpeed directly.
    // Either way, frame i's uTime is i/fps.
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

    const frameToUTime = (frameIdx: number) => frameIdx / config.fps;

    // GPU sync — same fence path PaperExportController uses. preserveDrawingBuffer
    // is set on the canvas above so the backbuffer survives between draw and
    // VideoFrame snapshot.
    // Fence-sync settles on the most recently submitted GPU commands, but
    // R3F's render is async — on iOS Safari the fence can settle before R3F
    // submits the new uTime's draw, freezing capture on the prior frame's
    // (often empty) backbuffer. createImageBitmap forces a full GPU sync +
    // readback, which flushes pending draws too. Trade speed for correctness.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isIOSSafari =
      /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const useFence = !!gl && caps.webgl2FenceSync && !isIOSSafari;
    const waitForGpu = async (): Promise<void> => {
      if (!useFence) return;
      const sync = gl!.fenceSync(gl!.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) return;
      gl!.flush();
      try {
        for (let i = 0; i < 200; i++) {
          const r = gl!.clientWaitSync(sync, 0, 0);
          if (r === gl!.ALREADY_SIGNALED || r === gl!.CONDITION_SATISFIED) return;
          if (r === gl!.WAIT_FAILED) throw new Error("WebGL fence wait failed");
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        throw new Error("WebGL fence never signaled within 200 polls");
      } finally {
        gl!.deleteSync(sync);
      }
    };
    const captureAndEncode = async (outIdx: number) => {
      if (useFence) {
        await waitForGpu();
        await enc.encodeFrame(canvas, outIdx);
      } else {
        const bitmap = await createImageBitmap(canvas);
        try {
          await enc.encodeFrame(bitmap, outIdx);
        } finally {
          bitmap.close();
        }
      }
    };

    const advanceTo = async (uTime: number) => {
      setExternalUTime!(uTime);
      // Two rAFs: first lets React reconcile the new uTime prop, second lets
      // R3F's render loop flush the resulting scene update to the canvas.
      await nextFrame();
      await nextFrame();
    };
    const renderFrame = async (uTime: number, outIdx: number) => {
      await advanceTo(uTime);
      await captureAndEncode(outIdx);
    };

    // Warmup: env-map probe generation, camera transitions, and the very
    // first GPU draw all take more than a frame to settle. We render at
    // uTime=0 for ~30 rAFs (about half a second at 60fps) before encoding
    // anything so frame 0's canvas isn't a half-drawn intermediate.
    for (let i = 0; i < 30; i++) await advanceTo(0);

    if (loopOn) {
      // Shader-native seamless loop: GLSL ensures frame 0 ≈ frame N, so
      // a plain forward capture suffices.
      for (let i = 0; i < totalFrames; i++) {
        signal?.throwIfAborted();
        await renderFrame(frameToUTime(i), i);
      }
    } else if (config.loopMode === "ping-pong") {
      // Linear-time mode + ping-pong: capture half forward, mirror back
      // for the second half. uTime is monotonic inside each half.
      const halfFrames = Math.ceil(totalFrames / 2);
      for (let i = 0; i < halfFrames; i++) {
        signal?.throwIfAborted();
        await renderFrame(frameToUTime(i), i);
      }
      const reverseFramesNeeded = totalFrames - halfFrames;
      for (let r = 0; r < reverseFramesNeeded; r++) {
        signal?.throwIfAborted();
        const sourceIdx = Math.max(0, halfFrames - 2 - r);
        await renderFrame(frameToUTime(sourceIdx), halfFrames + r);
      }
    } else {
      // Linear-time mode + one-way: straight forward, no seam guarantee.
      for (let i = 0; i < totalFrames; i++) {
        signal?.throwIfAborted();
        await renderFrame(frameToUTime(i), i);
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
      await nextFrame();
      return c;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("ShaderGradient canvas never mounted within timeout");
}

async function waitFor(predicate: () => boolean, timeoutMs: number, message: string): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 16));
  }
  throw new Error(message);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
