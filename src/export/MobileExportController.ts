import { createRoot, type Root } from "react-dom/client";
import { createElement, useEffect, useState, type ReactNode } from "react";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { Renderer } from "../render/Renderer";
import type { Preset, ShaderPreset, PaperPreset, ShaderGradientPreset, ParamValues } from "../presets/types";
import type { Palette } from "../color/palette";
import type { ExportConfig } from "../state/store";

export interface MobileExportArgs {
  preset: Preset;
  params: ParamValues;
  palette: Palette;
  image: string | null;
  config: ExportConfig;
  signal?: AbortSignal;
  onProgress?: (frame: number, total: number) => void;
}

export interface MobileExportResult {
  blob: Blob;
  filename: string;
}

export async function runMobileExport(args: MobileExportArgs): Promise<MobileExportResult> {
  const { preset, params, palette, image, config, signal, onProgress } = args;
  signal?.throwIfAborted();

  const width = config.width % 2 === 0 ? config.width : config.width - 1;
  const height = config.height % 2 === 0 ? config.height : config.height - 1;
  const totalFrames = Math.round(config.durationSeconds * config.fps);

  const mimeType = pickMimeType();
  const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `loop-bg-${preset.id}-${width}x${height}-${stamp}.${ext}`;

  let blob: Blob;
  if (preset.kind === "shader") {
    blob = await exportShader(preset as ShaderPreset, params, palette, config, width, height, totalFrames, mimeType, signal, onProgress);
  } else if (preset.kind === "paper") {
    blob = await exportPaper(preset as PaperPreset, params, palette, image, config, width, height, totalFrames, mimeType, signal, onProgress);
  } else if (preset.kind === "shadergradient") {
    blob = await exportShaderGradient(preset as ShaderGradientPreset, params, config, width, height, totalFrames, mimeType, signal, onProgress);
  } else {
    throw new Error(`Mobile export: unsupported preset kind "${(preset as Preset).kind}"`);
  }

  return { blob, filename };
}

// ── Codec detection ──────────────────────────────────────────────────────────

function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

// ── 2D canvas bridge + MediaRecorder ────────────────────────────────────────
//
// iOS Safari's Metal-backed WebGL doesn't participate in the compositor path
// that captureStream taps, so captureStream on a WebGL canvas only ever sees
// the initial frame. Fix: MediaRecorder captures a plain 2D canvas; each frame
// is painted to it via a captureFrame callback supplied by the preset.
//
// captureFrame is responsible for both driving animation AND painting to the 2D
// canvas — this lets each preset choose the right GPU-sync strategy:
//   • Shader / ShaderGradient: ctx.drawImage(webglCanvas) — fast, works because
//     renderer.render() / R3F rAF flush happens before the call
//   • Paper: createImageBitmap(canvas) → ctx.drawImage(bmp) — needed because
//     paper-design's setFrame() submits Metal commands asynchronously; only
//     createImageBitmap forces the flush before readback (same as the iOS
//     fallback path in PaperExportController.ts)
//
// We pre-paint frame 0 to canvas2d before recorder.start() so the recorder
// never samples a blank canvas on its first tick.

async function recordWithBridge(
  width: number,
  height: number,
  fps: number,
  totalFrames: number,
  mimeType: string,
  captureFrame: (frameIdx: number, ctx: CanvasRenderingContext2D) => Promise<void>,
  signal: AbortSignal | undefined,
  onProgress: ((frame: number, total: number) => void) | undefined
): Promise<Blob> {
  const canvas2d = document.createElement("canvas");
  canvas2d.width = width;
  canvas2d.height = height;
  canvas2d.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none;";
  document.body.appendChild(canvas2d);
  const ctx = canvas2d.getContext("2d")!;

  // Pre-paint frame 0 before the recorder starts so the first sample isn't black.
  await captureFrame(0, ctx);

  const stream = canvas2d.captureStream(fps);
  const recorderOptions = mimeType ? { mimeType } : {};
  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = () => reject(new Error("MediaRecorder error"));
  });

  recorder.start();

  const frameDuration = 1000 / fps;
  try {
    for (let i = 0; i < totalFrames; i++) {
      signal?.throwIfAborted();
      const t0 = performance.now();

      await captureFrame(i, ctx);
      onProgress?.(i + 1, totalFrames);

      const wait = frameDuration - (performance.now() - t0);
      if (wait > 2) await new Promise<void>((r) => setTimeout(r, wait));
    }
  } catch (err) {
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    canvas2d.remove();
    throw err;
  }

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  canvas2d.remove();
  return finished;
}

// ── Shader preset ────────────────────────────────────────────────────────────

async function exportShader(
  preset: ShaderPreset,
  params: ParamValues,
  palette: Palette,
  config: ExportConfig,
  width: number,
  height: number,
  totalFrames: number,
  mimeType: string,
  signal: AbortSignal | undefined,
  onProgress: ((frame: number, total: number) => void) | undefined
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none;";
  document.body.appendChild(canvas);

  const renderer = new Renderer(canvas, { preserveDrawingBuffer: true });

  const rawSpeed = typeof (params as Record<string, unknown>).u_speed === "number"
    ? ((params as Record<string, unknown>).u_speed as number)
    : 1;
  const cycles = rawSpeed === 0 ? 0 : Math.max(1, Math.round(rawSpeed));

  // Warm-up frame so the shader compiles before recording starts.
  renderer.render(preset, params, palette, 0, width, height);

  try {
    return await recordWithBridge(width, height, config.fps, totalFrames, mimeType,
      async (i, ctx) => {
        const t = i / totalFrames;
        const tScaled = cycles === 0 ? 0 : (t * cycles) % 1;
        renderer.render(preset, params, palette, tScaled, width, height);
        ctx.drawImage(canvas, 0, 0);
      },
      signal, onProgress
    );
  } finally {
    renderer.dispose();
    canvas.remove();
  }
}

// ── Paper preset ─────────────────────────────────────────────────────────────

async function exportPaper(
  preset: PaperPreset,
  params: ParamValues,
  palette: Palette,
  image: string | null,
  config: ExportConfig,
  width: number,
  height: number,
  totalFrames: number,
  mimeType: string,
  signal: AbortSignal | undefined,
  onProgress: ((frame: number, total: number) => void) | undefined
): Promise<Blob> {
  const componentProps = preset.propsFor(params, palette, image);
  const speed = typeof componentProps.speed === "number" ? componentProps.speed : 1;
  const frameToMs = (idx: number) => (idx * 1000 * speed) / config.fps;

  // On-screen clipped host — iOS GPU culls elements at left:-99999px and won't render them.
  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed", "left:0", "top:0",
    `width:${width}px`, `height:${height}px`,
    "pointer-events:none", "opacity:0", "z-index:-1",
    "clip-path:inset(0 calc(100% - 1px) calc(100% - 1px) 0)",
  ].join(";");
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      createElement(preset.Component, {
        ...componentProps,
        webGlContextAttributes: { preserveDrawingBuffer: true },
        style: { width: `${width}px`, height: `${height}px`, display: "block" },
      })
    );

    const canvas = await waitForCanvas(host, width, height, 5000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mount: any = (canvas.parentElement as any)?.paperShaderMount;
    if (!mount || typeof mount.setFrame !== "function") {
      throw new Error("Paper shader mount not found");
    }
    mount.setSpeed(0);

    return await recordWithBridge(width, height, config.fps, totalFrames, mimeType,
      async (i, ctx) => {
        const sourceIdx = pingPongIdx(i, totalFrames, config.loopMode);
        mount.setFrame(frameToMs(sourceIdx));
        // setFrame submits Metal commands asynchronously; one rAF tick lets the
        // GPU complete the render before ctx.drawImage reads the framebuffer.
        await nextFrame();
        ctx.drawImage(canvas, 0, 0);
      },
      signal, onProgress
    );
  } finally {
    try { root?.unmount(); } catch { /* noop */ }
    host.remove();
  }
}

// ── ShaderGradient preset ────────────────────────────────────────────────────

async function exportShaderGradient(
  preset: ShaderGradientPreset,
  params: ParamValues,
  config: ExportConfig,
  width: number,
  height: number,
  totalFrames: number,
  mimeType: string,
  signal: AbortSignal | undefined,
  onProgress: ((frame: number, total: number) => void) | undefined
): Promise<Blob> {
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
    ...(loopOn ? { loopDuration: config.durationSeconds } : {}),
    enableTransition: false,
    smoothTime: 0,
  };
  delete baseProps.colors;

  let setUTime: ((t: number) => void) | null = null;

  function ExportBridge({ onReady }: { onReady: (s: (t: number) => void) => void }): ReactNode {
    const [uTime, setU] = useState(0);
    useEffect(() => { onReady(setU); }, [onReady]);
    return createElement(ShaderGradientCanvas, {
      style: { width: `${width}px`, height: `${height}px` },
      pixelDensity: 1,
      preserveDrawingBuffer: true,
      lazyLoad: false,
      children: createElement(ShaderGradient, { ...baseProps, uTime }),
    });
  }

  // On-screen clipped host — iOS Safari throttles rAF for off-screen elements.
  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed", "left:0", "top:0",
    `width:${width}px`, `height:${height}px`,
    "pointer-events:none", "opacity:0", "z-index:-1",
    "clip-path:inset(0 calc(100% - 1px) calc(100% - 1px) 0)",
  ].join(";");
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(createElement(ExportBridge, { onReady: (s) => { setUTime = s; } }));

    const canvas = await waitForCanvas(host, width, height, 5000);
    await waitFor(() => setUTime !== null, 2000, "uTime setter never registered");

    // Warmup: let env-map, camera transitions, and first draw fully settle.
    for (let i = 0; i < 30; i++) {
      setUTime!(0);
      await nextFrame();
      await nextFrame();
    }

    return await recordWithBridge(width, height, config.fps, totalFrames, mimeType,
      async (i, ctx) => {
        let uTime: number;
        if (loopOn) {
          uTime = i / config.fps;
        } else {
          const sourceIdx = pingPongIdx(i, totalFrames, config.loopMode);
          uTime = sourceIdx / config.fps;
        }
        setUTime!(uTime);
        // Two rAFs: React reconcile + R3F render flush. After these, the WebGL
        // canvas has the new frame and ctx.drawImage reads it correctly.
        await nextFrame();
        await nextFrame();
        ctx.drawImage(canvas, 0, 0);
      },
      signal, onProgress
    );
  } finally {
    try { root?.unmount(); } catch { /* noop */ }
    host.remove();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pingPongIdx(outputIdx: number, total: number, loopMode: "linear" | "ping-pong"): number {
  if (loopMode !== "ping-pong") return outputIdx;
  const half = Math.ceil(total / 2);
  if (outputIdx < half) return outputIdx;
  const r = outputIdx - half;
  return Math.max(0, half - 2 - r);
}

async function waitForCanvas(host: HTMLElement, width: number, height: number, timeoutMs: number): Promise<HTMLCanvasElement> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const c = host.querySelector("canvas") as HTMLCanvasElement | null;
    if (c && c.width >= Math.min(width, 2) && c.height >= Math.min(height, 2)) {
      await nextFrame();
      return c;
    }
    await new Promise<void>((r) => setTimeout(r, 30));
  }
  throw new Error(`Canvas never mounted within ${timeoutMs}ms`);
}

async function waitFor(pred: () => boolean, timeoutMs: number, message: string): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (pred()) return;
    await new Promise<void>((r) => setTimeout(r, 16));
  }
  throw new Error(message);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
