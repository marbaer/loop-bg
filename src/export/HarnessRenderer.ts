import { createElement, useEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { Renderer } from "../render/Renderer";
import type { Preset, ShaderPreset, PaperPreset, ShaderGradientPreset, ParamValues } from "../presets/types";
import type { Palette } from "../color/palette";

export interface HarnessConfig {
  preset: Preset;
  params: ParamValues;
  palette: Palette;
  /** Data URL of the uploaded logo image, or null for non-logo presets. */
  image: string | null;
  duration: number;
  fps: number;
  width: number;
  height: number;
  format: "mp4" | "webm";
  loopMode: "linear" | "ping-pong";
  sessionId: string;
}

export class HarnessRenderer {
  private readonly config: HarnessConfig;

  // Shader preset state
  private renderer: Renderer | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private cycles = 1;

  // Paper preset state
  private paperCanvas: HTMLCanvasElement | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private paperMount: any = null;
  private paperRoot: Root | null = null;
  private paperHost: HTMLElement | null = null;
  private paperSpeed = 1;

  // ShaderGradient preset state
  private sgCanvas: HTMLCanvasElement | null = null;
  private setUTime: ((t: number) => void) | null = null;
  private sgRoot: Root | null = null;
  private sgHost: HTMLElement | null = null;

  constructor(config: HarnessConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const { preset, params, palette, image, width, height } = this.config;
    if (preset.kind === "shader") {
      this.initShader(preset as ShaderPreset, params, palette, width, height);
    } else if (preset.kind === "paper") {
      await this.initPaper(preset as PaperPreset, params, palette, image, width, height);
    } else if (preset.kind === "shadergradient") {
      await this.initShaderGradient(preset as ShaderGradientPreset, params, width, height);
    } else {
      throw new Error(`Harness: unsupported preset kind "${(preset as Preset).kind}"`);
    }
  }

  async renderFrame(outputIdx: number, total: number): Promise<void> {
    const { preset } = this.config;
    if (preset.kind === "shader") {
      await this.renderShaderFrame(outputIdx, total);
    } else if (preset.kind === "paper") {
      await this.renderPaperFrame(outputIdx, total);
    } else if (preset.kind === "shadergradient") {
      await this.renderSGFrame(outputIdx, total);
    }
  }

  // ── Shader preset ─────────────────────────────────────────────────────────

  private initShader(
    preset: ShaderPreset,
    params: ParamValues,
    palette: Palette,
    width: number,
    height: number
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = "position:fixed;left:-99999px;top:0;";
    document.body.appendChild(canvas);

    this.renderer = new Renderer(canvas);
    this.gl = this.renderer.gl;

    // Snap to the nearest integer cycle count so frame 0 === frame N.
    // Mirrors the logic in ExportController.ts.
    const rawSpeed = typeof params.u_speed === "number" ? params.u_speed : 1;
    this.cycles = rawSpeed === 0 ? 0 : Math.max(1, Math.round(rawSpeed));

    // One warm-up frame so the shader compiles before the timed loop begins.
    this.renderer.render(preset, params, palette, 0, width, height);
  }

  private async renderShaderFrame(outputIdx: number, total: number): Promise<void> {
    const { preset, params, palette, width, height } = this.config;
    const t = outputIdx / total;
    const tScaled = this.cycles === 0 ? 0 : (t * this.cycles) % 1;
    this.renderer!.render(preset as ShaderPreset, params, palette, tScaled, width, height);
    await this.readAndPost(this.gl!);
  }

  // ── Paper preset ───────────────────────────────────────────────────────────

  private async initPaper(
    preset: PaperPreset,
    params: ParamValues,
    palette: Palette,
    image: string | null,
    width: number,
    height: number
  ): Promise<void> {
    const componentProps = preset.propsFor(params, palette, image);
    this.paperSpeed = typeof componentProps.speed === "number" ? componentProps.speed : 1;

    const host = document.createElement("div");
    host.style.cssText = [
      "position:fixed",
      "left:-99999px",
      "top:0",
      `width:${width}px`,
      `height:${height}px`,
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(host);
    this.paperHost = host;

    const root = createRoot(host);
    this.paperRoot = root;
    root.render(
      createElement(preset.Component, {
        ...componentProps,
        webGlContextAttributes: { preserveDrawingBuffer: true },
        style: { width: `${width}px`, height: `${height}px`, display: "block" },
      })
    );

    this.paperCanvas = await waitForCanvas(host, width, height, 5000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mount: any = (this.paperCanvas.parentElement as any)?.paperShaderMount;
    if (!mount || typeof mount.setFrame !== "function") {
      throw new Error("paper-design ShaderMount not found on canvas parent");
    }
    mount.setSpeed(0);
    this.paperMount = mount;
  }

  private async renderPaperFrame(outputIdx: number, total: number): Promise<void> {
    const { loopMode, fps } = this.config;
    const sourceIdx = pingPongIdx(outputIdx, total, loopMode);
    const ms = (sourceIdx * 1000 * this.paperSpeed) / fps;
    this.paperMount.setFrame(ms);
    const gl = this.paperCanvas!.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) throw new Error("Paper canvas has no WebGL2 context");
    await this.readAndPost(gl);
  }

  // ── ShaderGradient preset ──────────────────────────────────────────────────

  private async initShaderGradient(
    _preset: ShaderGradientPreset,
    params: ParamValues,
    width: number,
    height: number
  ): Promise<void> {
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
      ...(loopOn ? { loopDuration: this.config.duration } : {}),
      enableTransition: false,
      smoothTime: 0,
    };
    delete baseProps.colors;

    let capturedSetter: ((t: number) => void) | null = null;
    const onReady = (setter: (t: number) => void) => {
      capturedSetter = setter;
    };

    // Inline bridge component — mirrors ShaderGradientExportController.ts.
    function ExportBridge({ onReady: ready }: { onReady: (s: (t: number) => void) => void }): ReactNode {
      const [uTime, setUTime] = useState(0);
      useEffect(() => { ready(setUTime); }, [ready]);
      return createElement(ShaderGradientCanvas, {
        style: { width: `${width}px`, height: `${height}px` },
        pixelDensity: 1,
        preserveDrawingBuffer: true,
        lazyLoad: false,
        children: createElement(ShaderGradient, { ...baseProps, uTime }),
      });
    }

    const host = document.createElement("div");
    host.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      `width:${width}px`,
      `height:${height}px`,
      "pointer-events:none",
      "opacity:0",
      "z-index:-1",
    ].join(";");
    document.body.appendChild(host);
    this.sgHost = host;

    const root = createRoot(host);
    this.sgRoot = root;
    root.render(createElement(ExportBridge, { onReady }));

    this.sgCanvas = await waitForCanvas(host, width, height, 5000);
    await waitFor(() => capturedSetter !== null, 5000, "uTime setter never registered");
    this.setUTime = capturedSetter!;

    // Warm up: let env-map probe, camera transitions, and first draw fully settle.
    for (let i = 0; i < 30; i++) await nextFrame();
  }

  private async renderSGFrame(outputIdx: number, total: number): Promise<void> {
    const { params, fps, loopMode } = this.config;
    const loopOn = params.loop === "on";

    let uTime: number;
    if (loopOn) {
      // Shader-native seamless loop — always forward.
      uTime = outputIdx / fps;
    } else {
      const sourceIdx = pingPongIdx(outputIdx, total, loopMode);
      uTime = sourceIdx / fps;
    }

    this.setUTime!(uTime);
    // Two rAFs: first for React reconcile, second for R3F to flush the draw.
    await nextFrame();
    await nextFrame();

    const gl = this.sgCanvas!.getContext("webgl2") as WebGL2RenderingContext | null;
    if (!gl) throw new Error("ShaderGradient canvas has no WebGL2 context");
    await this.readAndPost(gl);
  }

  // ── Shared pixel readback ──────────────────────────────────────────────────

  private async readAndPost(gl: WebGL2RenderingContext): Promise<void> {
    const { width, height, sessionId } = this.config;
    const pixels = new Uint8Array(width * height * 4);
    // readPixels is synchronous and implicitly flushes all pending GPU commands
    // before reading — no explicit fence required on desktop Chrome/SwiftShader.
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    await fetch(`/frame/${sessionId}`, {
      method: "POST",
      body: pixels.buffer,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pingPongIdx(outputIdx: number, total: number, loopMode: "linear" | "ping-pong"): number {
  if (loopMode !== "ping-pong") return outputIdx;
  const half = Math.ceil(total / 2);
  if (outputIdx < half) return outputIdx;
  const r = outputIdx - half;
  return Math.max(0, half - 2 - r);
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
