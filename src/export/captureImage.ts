import { downloadBlob } from "./ExportController";

/**
 * Snapshot the current frame of a preview canvas to PNG. Relies on
 * preserveDrawingBuffer:true being set on the preview canvases — without it,
 * toBlob would return a cleared image on iOS Safari.
 *
 * On mobile, uses the Web Share API (native share sheet) because iOS Safari
 * ignores programmatic anchor.click() on blob URLs.
 */
export function captureCanvasImage(
  canvas: HTMLCanvasElement,
  presetId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Canvas snapshot failed"));
        return;
      }
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const filename = `loop-bg-${presetId}-${stamp}.png`;

      const file = new File([blob], filename, { type: "image/png" });
      if (
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file] });
          resolve();
        } catch (err) {
          // User dismissed share sheet — not an error
          if (err instanceof Error && err.name === "AbortError") {
            resolve();
          } else {
            reject(err);
          }
        }
      } else {
        downloadBlob(blob, filename);
        resolve();
      }
    }, "image/png");
  });
}
