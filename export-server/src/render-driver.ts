import puppeteer, { type Browser, type Page } from "puppeteer";
import type { ExportRequest } from "./validate";

const CHROME_FLAGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  // SwiftShader provides software WebGL2 without a physical GPU.
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  // Prevent /dev/shm exhaustion in Docker containers.
  "--disable-dev-shm-usage",
  // --single-process and --disable-gpu-sandbox crash Chrome on macOS; Linux/Docker only.
  ...(process.platform !== "darwin" ? ["--disable-gpu-sandbox", "--single-process"] : []),
  // Ensure rAF fires at full speed in headless mode.
  "--disable-frame-rate-limit",
  "--run-all-compositor-stages-before-draw",
];

export async function runRender(
  req: ExportRequest,
  port: number,
  sessionId: string,
  signal: AbortSignal
): Promise<void> {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "chromium",
      headless: true,
      args: CHROME_FLAGS,
    });

    const page: Page = await browser.newPage();
    await page.setViewport({ width: req.width, height: req.height });

    // Silence console noise from the harness page in production.
    if (!process.env.HARNESS_DEBUG) {
      page.on("console", () => {});
      page.on("pageerror", (err) => {
        console.error("[harness]", err.message);
      });
    } else {
      page.on("console", (msg) => console.log("[harness]", msg.text()));
      page.on("pageerror", (err) => console.error("[harness]", err.message));
    }

    const harnessUrl = buildHarnessUrl(req, port, sessionId);
    await page.goto(harnessUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for the harness to finish initialising (renderer mounted, warmup done).
    await page.waitForFunction(() => (window as unknown as Record<string, unknown>).__ready === true, {
      timeout: 30_000,
      polling: 100,
    });

    signal.throwIfAborted();

    const totalFrames = Math.round(req.duration * req.fps);
    for (let i = 0; i < totalFrames; i++) {
      signal.throwIfAborted();
      // renderFrame is async in the harness; Puppeteer awaits the returned Promise.
      // It resolves only after the RGBA has been POSTed to /frame/:sessionId and
      // the server has written the data to ffmpeg's stdin — natural backpressure.
      await page.evaluate(
        (frameIdx: number, total: number) =>
          (window as unknown as { renderFrame: (i: number, n: number) => Promise<void> }).renderFrame(frameIdx, total),
        i,
        totalFrames
      );
    }
  } finally {
    await browser?.close().catch(() => {});
  }
}

function buildHarnessUrl(req: ExportRequest, port: number, sessionId: string): string {
  const entries: Record<string, string> = {
    presetId: req.presetId,
    params: JSON.stringify(req.params),
    palette: JSON.stringify(req.palette),
    duration: String(req.duration),
    fps: String(req.fps),
    width: String(req.width),
    height: String(req.height),
    format: req.format,
    loopMode: req.loopMode,
    sessionId,
  };
  if (req.image) entries.image = req.image;
  return `http://localhost:${port}/harness.html?${new URLSearchParams(entries).toString()}`;
}
