export interface ExportCapabilities {
  webCodecs: boolean;
  h264: boolean;
  vp9: boolean;
}

export async function detectCapabilities(): Promise<ExportCapabilities> {
  const hasWC = typeof (globalThis as any).VideoEncoder !== "undefined";
  if (!hasWC) return { webCodecs: false, h264: false, vp9: false };
  let h264 = false;
  let vp9 = false;
  try {
    const probeH264 = await (globalThis as any).VideoEncoder.isConfigSupported({
      codec: "avc1.640028", // H.264 High Profile, level 4.0
      width: 1920,
      height: 1080,
      bitrate: 20_000_000,
      framerate: 30,
      avc: { format: "annexb" },
    });
    h264 = !!probeH264?.supported;
  } catch {}
  try {
    const probeVp9 = await (globalThis as any).VideoEncoder.isConfigSupported({
      codec: "vp09.00.50.08",
      width: 1920,
      height: 1080,
      bitrate: 20_000_000,
      framerate: 30,
    });
    vp9 = !!probeVp9?.supported;
  } catch {}
  return { webCodecs: hasWC, h264, vp9 };
}

export function bitrateFor(width: number, height: number, quality: "standard" | "high" | "max", fps: number = 30): number {
  // Calibrated to observed output: ~4 Mbps @ 1080p / High / 30fps for smooth shader animations.
  const px = width * height;
  const base = (px / (1920 * 1080)) * 4_000_000;
  const qualityMult = quality === "standard" ? 0.6 : quality === "high" ? 1.0 : 1.6;
  // 60fps is ~1.6× 30fps empirically (not 2×) for this content type.
  const fpsMult = fps >= 60 ? 1.6 : 1.0;
  return Math.round(base * qualityMult * fpsMult);
}
