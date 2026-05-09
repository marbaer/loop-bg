import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { validate } from "./validate";
import { spawnFfmpeg } from "./encode";
import { runRender } from "./render-driver";
import type { ChildProcess } from "child_process";
import type { Browser } from "puppeteer";

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_ORIGINS = [
  "https://marbaer.github.io",
  "http://localhost:5180",
  "http://localhost:4173",
];

interface Session {
  ffmpegStdin: NodeJS.WritableStream;
  ffmpegProc: ChildProcess;
  browser: Browser | null;
  resolveFrame: (() => void) | null;
  abortController: AbortController;
}

const sessions = new Map<string, Session>();

const app = express();

// CORS only applies to the public /export endpoint — /frame is loopback-only.
const publicCors = cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["POST", "OPTIONS"],
});

app.use(express.json({ limit: "1mb" }));

// Serve the built harness SPA (harness.html + its assets).
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.options("/export", publicCors);
app.post("/export", publicCors, async (req: Request, res: Response): Promise<void> => {
  const validated = validate(req.body);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const sessionId = uuidv4();
  const abortController = new AbortController();

  // Begin streaming the video response immediately so the client knows the
  // request was accepted and can show progress UI.
  const mimeType = validated.format === "mp4" ? "video/mp4" : "video/webm";
  const ext = validated.format;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `loop-bg-${validated.presetId}-${validated.width}x${validated.height}-${stamp}.${ext}`;

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Session-Id", sessionId);

  const ffmpegProc = spawnFfmpeg(validated, res);

  const session: Session = {
    ffmpegStdin: ffmpegProc.stdin!,
    ffmpegProc,
    browser: null,
    resolveFrame: null,
    abortController,
  };
  sessions.set(sessionId, session);

  // Cancel everything if the client disconnects mid-render.
  // Use res.on("close") — not req.on("close"), which fires too early in modern
  // Node.js because IncomingMessage auto-destroys after body-parser reads the body.
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
      ffmpegProc.kill("SIGTERM");
      sessions.delete(sessionId);
    }
  });

  try {
    await runRender(validated, PORT, sessionId, abortController.signal);
    ffmpegProc.stdin!.end();
    // Wait for ffmpeg to flush and close the response stream.
    await new Promise<void>((resolve, reject) => {
      ffmpegProc.on("close", (code) => {
        if (code === 0 || code === null) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Render failed" });
    } else {
      res.end();
    }
    ffmpegProc.kill("SIGTERM");
    console.error("[export]", sessionId, err);
  } finally {
    sessions.delete(sessionId);
  }
});

// Receives raw RGBA frame data from the harness page (loopback fetch).
// Each POST is one video frame. The body is a raw binary octet-stream.
app.post(
  "/frame/:sessionId",
  express.raw({ type: "*/*", limit: "20mb" }),
  (req: Request, res: Response): void => {
    const sid = req.params.sessionId as string;
    const session = sessions.get(sid);
    if (!session) {
      res.status(404).end();
      return;
    }

    const buf: Buffer = req.body as Buffer;
    session.ffmpegStdin.write(buf, () => {
      // Acknowledge only after the data has been passed to ffmpeg's pipe so
      // the harness naturally waits before rendering the next frame.
      res.status(200).end();
    });
  }
);

app.listen(PORT, () => {
  console.log(`loop-bg export server listening on :${PORT}`);
});
