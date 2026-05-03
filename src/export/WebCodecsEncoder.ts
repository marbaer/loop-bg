import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from "webm-muxer";
import { bitrateFor } from "./capabilities";

declare global {
  // VideoEncoder/VideoFrame are part of WebCodecs; declare loosely to avoid lib mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoEncoder: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const VideoFrame: any;
}

export interface EncodeOptions {
  width: number;
  height: number;
  fps: 30 | 60;
  durationSeconds: number;
  format: "mp4" | "webm";
  quality: "standard" | "high" | "max";
  onProgress?: (frame: number, total: number) => void;
}

export type EncodeFrameSource = HTMLCanvasElement | OffscreenCanvas | ImageBitmap;
export interface EncoderHandle {
  encodeFrame: (frame: EncodeFrameSource, frameIndex: number) => Promise<void>;
  finish: () => Promise<Blob>;
}

export async function createWebCodecsEncoder(opts: EncodeOptions): Promise<EncoderHandle> {
  const { width, height, fps, durationSeconds, format, quality } = opts;
  if (width % 2 !== 0 || height % 2 !== 0) {
    throw new Error(`Encoder requires even dimensions; got ${width}x${height}`);
  }
  const bitrate = bitrateFor(width, height, quality);
  const totalFrames = Math.round(durationSeconds * fps);
  const microsPerFrame = 1_000_000 / fps;

  let muxer: Mp4Muxer<Mp4Target> | WebmMuxer<WebmTarget>;
  let codec: string;

  if (format === "mp4") {
    codec = "avc1.640028"; // H.264 High Profile, level 4.0
    muxer = new Mp4Muxer({
      target: new Mp4Target(),
      video: {
        codec: "avc",
        width,
        height,
        frameRate: fps,
      },
      fastStart: "in-memory",
    });
  } else {
    codec = "vp09.00.50.08";
    muxer = new WebmMuxer({
      target: new WebmTarget(),
      video: {
        codec: "V_VP9",
        width,
        height,
        frameRate: fps,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encoder = new (globalThis as any).VideoEncoder({
    output: (chunk: any, meta: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (muxer as any).addVideoChunk(chunk, meta);
    },
    error: (e: unknown) => {
      console.error("VideoEncoder error", e);
    },
  });

  encoder.configure({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
    bitrateMode: "constant",
    hardwareAcceleration: "prefer-hardware",
    // mp4-muxer requires AVCC format (length-prefixed NAL units). Annex-B
    // start codes inside an MP4 produce a file that no player can decode.
    avc: format === "mp4" ? { format: "avc" } : undefined,
  });

  return {
    async encodeFrame(canvas, frameIndex) {
      // Force keyframe every ~2s to keep seekability sane.
      const keyframe = frameIndex === 0 || frameIndex % (fps * 2) === 0;
      const frame = new (globalThis as any).VideoFrame(canvas, {
        timestamp: Math.round(frameIndex * microsPerFrame),
        duration: Math.round(microsPerFrame),
      });
      encoder.encode(frame, { keyFrame: keyframe });
      frame.close();
      // Yield to event loop occasionally so UI progress paints.
      if (frameIndex % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      opts.onProgress?.(frameIndex + 1, totalFrames);
    },
    async finish() {
      await encoder.flush();
      encoder.close();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (muxer as any).finalize();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buf: ArrayBuffer = (muxer as any).target.buffer;
      const mime = format === "mp4" ? "video/mp4" : "video/webm";
      return new Blob([buf], { type: mime });
    },
  };
}
