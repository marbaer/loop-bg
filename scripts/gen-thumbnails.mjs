/**
 * Generates static thumbnails for every preset and saves them to
 * public/thumbnails/{preset-id}.jpg.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Usage (dev server must be running on :5180):
 *   node scripts/gen-thumbnails.mjs
 *
 * Browser console fallback (if Playwright is unavailable):
 *   Open http://localhost:5173, paste the following in DevTools console:
 *
 *   const store = window.__loopBgStore;
 *   const ids = store.getState().paramsByPreset ? Object.keys(store.getState().paramsByPreset) : [];
 *   for (const id of ids) {
 *     store.getState().setPreset(id);
 *     await new Promise(r => setTimeout(r, 800));
 *     const canvas = document.querySelector('canvas');
 *     const a = document.createElement('a');
 *     a.href = canvas.toDataURL('image/jpeg', 0.9);
 *     a.download = id + '.jpg';
 *     a.click();
 *     await new Promise(r => setTimeout(r, 200));
 *   }
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/thumbnails");
const BASE_URL = "http://localhost:5180";
const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 270;
const SETTLE_MS = 800;

const ALL_PRESET_IDS = [
  "paper-mesh-gradient",
  "paper-grain-gradient",
  "paper-warp",
  "paper-liquid-metal",
  "paper-god-rays",
  "paper-smoke-ring",
  "paper-neuro-noise",
  "paper-metaballs",
  "paper-simplex-noise",
  "paper-spiral",
  "paper-swirl",
  "paper-pulsing-border",
  "paper-dithering",
  "paper-logo-liquid-metal",
  "paper-logo-heatmap",
  "paper-logo-gem-smoke",
  "soft-blobs",
  "aurora",
  "ribbons",
  "layers",
  "loupe",
  "blob",
  "gradient",
  "shadergradient-halo",
  "shadergradient-pensive",
  "shadergradient-mint",
  "shadergradient-interstella",
  "shadergradient-nightyNight",
  "shadergradient-violaOrientalis",
  "shadergradient-universe",
  "shadergradient-sunset",
  "shadergradient-mandarin",
  "shadergradient-cottonCandy",
];

// CLI: pass preset ids as args to regenerate just those (e.g. `node
// scripts/gen-thumbnails.mjs loupe blob`). With no args, regenerate all.
const argIds = process.argv.slice(2).filter(Boolean);
const PRESET_IDS = argIds.length > 0 ? argIds : ALL_PRESET_IDS;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log(`Opening ${BASE_URL} …`);
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // Dismiss any overlay / modal that might be present
  await page.waitForTimeout(500);

  for (const id of PRESET_IDS) {
    console.log(`  ${id} …`);

    // Switch preset via the exposed store
    await page.evaluate((presetId) => {
      const store = window.__loopBgStore;
      if (!store) throw new Error("__loopBgStore not found — is DEV mode on?");
      store.getState().setPreset(presetId);
    }, id);

    // Wait for the canvas to be present (it unmounts/remounts when switching
    // between shader ↔ paper ↔ r3f renderers) then give it time to render.
    // ShaderGradient (R3F) takes longer to compose lighting + camera settle.
    await page.waitForSelector("canvas", { state: "visible", timeout: 5000 });
    const settle = id.startsWith("shadergradient-") ? 2000 : SETTLE_MS;
    await page.waitForTimeout(settle);

    // Grab the canvas and screenshot it at thumbnail resolution
    const canvas = page.locator("canvas").first();
    const outPath = resolve(OUT_DIR, `${id}.jpg`);

    await canvas.screenshot({
      path: outPath,
      type: "jpeg",
      quality: 90,
      // Playwright screenshots the element at its rendered size; we'll rely on
      // the canvas being full-viewport. For resizing, post-process with sharp
      // if needed — the canvas is typically 1280×800 here and browsers display
      // it well at 480×270 via CSS object-fit.
    });

    console.log(`    → ${outPath}`);
  }

  await browser.close();
  console.log(`\nDone — ${PRESET_IDS.length} thumbnails saved to public/thumbnails/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
