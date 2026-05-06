import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/hero.png");
const BASE_URL = "http://localhost:5173";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE_URL);
await page.waitForSelector("canvas");
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT });
await browser.close();
console.log("wrote", OUT);
