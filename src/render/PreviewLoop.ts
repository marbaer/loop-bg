import { Renderer } from "./Renderer";

export interface PreviewFrameContext {
  /** Wrapped at 1 — convenient for callers that don't care about speed scaling. */
  t: number;
  /** Raw monotonic progress = elapsed / duration (NOT wrapped). Callers that
   *  scale time by a speed factor must use this and wrap themselves, otherwise
   *  fractional speeds produce a seam each time wrapped `t` wraps. */
  progress: number;
  width: number;
  height: number;
}

export type PreviewRenderFn = (ctx: PreviewFrameContext) => void;

/**
 * Drives a requestAnimationFrame loop with t = (now / durationMs) % 1.
 * The render callback re-reads the current preset/params/palette each frame so
 * UI changes apply immediately.
 */
export class PreviewLoop {
  private rafId: number | null = null;
  private startTime = performance.now();
  private getDurationMs: () => number;
  private renderFn: PreviewRenderFn;
  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    renderFn: PreviewRenderFn,
    getDurationMs: () => number
  ) {
    this.canvas = canvas;
    this.renderFn = renderFn;
    this.getDurationMs = getDurationMs;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.startTime = performance.now();
    const tick = () => {
      const now = performance.now();
      const dur = Math.max(this.getDurationMs(), 1);
      const progress = (now - this.startTime) / dur;
      const t = progress % 1;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.floor(rect.width * dpr));
      const h = Math.max(2, Math.floor(rect.height * dpr));
      this.renderFn({ t, progress, width: w, height: h });
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// Re-export for convenience
export { Renderer };
