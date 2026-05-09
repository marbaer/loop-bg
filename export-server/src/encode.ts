import { spawn, type ChildProcess } from "child_process";
import type { Writable } from "stream";
import type { ExportRequest } from "./validate";

export function spawnFfmpeg(req: ExportRequest, output: Writable): ChildProcess {
  // gl.readPixels gives RGBA rows bottom-to-top (OpenGL convention).
  // -vf vflip corrects to top-to-bottom for video containers.
  const inputArgs = [
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "-s", `${req.width}x${req.height}`,
    "-r", String(req.fps),
    "-i", "pipe:0",
    "-vf", "vflip",
  ];

  const mp4Args = [
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "18",
    "-f", "mp4",
    // Fragment the output so it is streamable before the file is complete.
    "-movflags", "frag_keyframe+empty_moov",
  ];

  const webmArgs = [
    "-c:v", "libvpx-vp9",
    "-b:v", "0",
    "-crf", "33",
    "-row-mt", "1",
    "-f", "webm",
  ];

  const outputArgs = req.format === "mp4" ? mp4Args : webmArgs;

  const proc = spawn("ffmpeg", [...inputArgs, ...outputArgs, "pipe:1"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.stdout.pipe(output, { end: false });

  proc.stderr.on("data", (chunk: Buffer) => {
    // Log ffmpeg stderr only in debug mode to keep server logs clean.
    if (process.env.FFMPEG_DEBUG) process.stderr.write(chunk);
  });

  proc.on("error", (err) => {
    console.error("[ffmpeg] spawn error:", err.message);
  });

  return proc;
}
