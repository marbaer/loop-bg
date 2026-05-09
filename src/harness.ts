import { presets } from "./presets";
import type { ParamValues } from "./presets/types";
import type { Palette } from "./color/palette";
import { HarnessRenderer } from "./export/HarnessRenderer";

// Parse export config from URL search params injected by the render driver.
const p = new URLSearchParams(location.search);
const presetId = p.get("presetId") ?? "";
const params = JSON.parse(p.get("params") ?? "{}") as ParamValues;
const palette = JSON.parse(p.get("palette") ?? "{}") as Palette;
const duration = Number(p.get("duration"));
const fps = Number(p.get("fps"));
const width = Number(p.get("width"));
const height = Number(p.get("height"));
const format = (p.get("format") ?? "mp4") as "mp4" | "webm";
const loopMode = (p.get("loopMode") ?? "linear") as "linear" | "ping-pong";
const sessionId = p.get("sessionId") ?? "";
const image = p.get("image") ?? null;

const preset = presets.find((pr) => pr.id === presetId);
if (!preset) {
  throw new Error(`Harness: unknown presetId "${presetId}"`);
}

declare global {
  interface Window {
    __ready: boolean;
    renderFrame: (outputIdx: number, total: number) => Promise<void>;
  }
}

(async () => {
  const renderer = new HarnessRenderer({
    preset,
    params,
    palette,
    image,
    duration,
    fps,
    width,
    height,
    format,
    loopMode,
    sessionId,
  });

  await renderer.init();

  window.renderFrame = (outputIdx: number, total: number) =>
    renderer.renderFrame(outputIdx, total);

  // Signal to the render driver that the harness is ready to accept frames.
  window.__ready = true;
})();
