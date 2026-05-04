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
    // Level 4.0 (0x28) caps at 2,097,152 px (1080p and below).
    // Level 5.0 (0x32) caps at 5,652,480 px (1440p).
    const avcLevel = width * height <= 2_097_152 ? "28" : "32";
    codec = `avc1.6400${avcLevel}`; // H.264 High Profile
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

  // Captured asynchronously from the encoder's error callback. We surface it
  // on the next encodeFrame / finish call so a broken encoder aborts the
  // export loudly instead of silently dropping frames into a frozen file.
  let encodeError: Error | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encoder = new (globalThis as any).VideoEncoder({
    output: (chunk: any, meta: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (muxer as any).addVideoChunk(chunk, meta);
    },
    error: (e: unknown) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
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
      if (encodeError) throw encodeError;
      // Backpressure: yield until the encoder drains its queue. Without this,
      // a render loop that produces frames faster than the GPU encoder can
      // consume them overruns the encoder, which then silently drops frames.
      // Those gaps appear in the muxed file as frozen sections during playback.
      while (encoder.encodeQueueSize > 2) {
        await new Promise((r) => setTimeout(r, 0));
        if (encodeError) throw encodeError;
      }
      // Force keyframe every ~2s to keep seekability sane.
      const keyframe = frameIndex === 0 || frameIndex % (fps * 2) === 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const frame = new (globalThis as any).VideoFrame(canvas, {
        timestamp: Math.round(frameIndex * microsPerFrame),
        duration: Math.round(microsPerFrame),
      });
      encoder.encode(frame, { keyFrame: keyframe });
      frame.close();
      // Yield every few frames so the UI progress bar can paint.
      if (frameIndex % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      opts.onProgress?.(frameIndex + 1, totalFrames);
    },
    async finish() {
      if (encodeError) throw encodeError;
      await encoder.flush();
      if (encodeError) throw encodeError;
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
