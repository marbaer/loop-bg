import { downloadBlob } from "./ExportController";

/**
 * Snapshot the current frame of a preview canvas to PNG. Relies on
 * preserveDrawingBuffer:true being set on the preview canvases — without it,
 * toBlob would return a cleared image on iOS Safari.
 */
export function captureCanvasImage(
  canvas: HTMLCanvasElement,
  presetId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas snapshot failed"));
        return;
      }
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      downloadBlob(blob, `loop-bg-${presetId}-${stamp}.png`);
      resolve();
    }, "image/png");
  });
}
