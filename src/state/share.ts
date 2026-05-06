import { presets } from "../presets";
import type { ParamValues } from "../presets/types";
import type { PaletteOverrides, PaletteSlot } from "../color/palette";
import type { AspectRatio } from "./store";

const SHARE_VERSION = 1;
const HASH_KEY = "s";

interface SharePayload {
  v: number;
  p: string;
  pr: ParamValues;
  a: string;
  m: "dark" | "light";
  bl: number;
  ov: PaletteOverrides;
  vr?: string;
  d: number;
  ar: AspectRatio;
}

export interface ShareSnapshot {
  presetId: string;
  params: ParamValues;
  accentHex: string;
  paletteMode: "dark" | "light";
  bgLightness: number;
  paletteOverrides: PaletteOverrides;
  variantName?: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
}

function toBase64Url(s: string): string {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return decodeURIComponent(escape(atob(b64 + pad)));
}

export function encodeShareState(snap: ShareSnapshot): string {
  const payload: SharePayload = {
    v: SHARE_VERSION,
    p: snap.presetId,
    pr: snap.params,
    a: snap.accentHex,
    m: snap.paletteMode,
    bl: snap.bgLightness,
    ov: snap.paletteOverrides,
    vr: snap.variantName,
    d: snap.durationSeconds,
    ar: snap.aspectRatio,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeShareState(encoded: string): ShareSnapshot | null {
  let payload: SharePayload;
  try {
    payload = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }
  if (!payload || payload.v !== SHARE_VERSION) return null;

  const preset = presets.find((x) => x.id === payload.p);
  if (!preset) return null;

  // Reconcile params against current schema: keep keys that exist in defaults,
  // drop unknowns, fall back to defaults for missing.
  const incoming = (payload.pr ?? {}) as ParamValues;
  const reconciled: ParamValues = { ...preset.defaults };
  for (const key of Object.keys(reconciled)) {
    if (key in incoming) reconciled[key] = incoming[key];
  }

  // Drop variant marker if it no longer exists.
  let variantName: string | undefined = payload.vr;
  if (variantName && preset.kind === "paper") {
    const found = preset.variants?.some((v) => v.name === variantName);
    if (!found) variantName = undefined;
  } else if (variantName) {
    variantName = undefined;
  }

  // Sanitize palette overrides to known slots.
  const validSlots: PaletteSlot[] = ["bg", "surface", "primary", "secondary"];
  const ov: PaletteOverrides = {};
  if (payload.ov && typeof payload.ov === "object") {
    for (const slot of validSlots) {
      const v = payload.ov[slot];
      if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) ov[slot] = v;
    }
  }

  const validAR: AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];
  const ar = validAR.includes(payload.ar) ? payload.ar : "16:9";

  const accentHex = /^#[0-9a-fA-F]{6}$/.test(payload.a ?? "") ? payload.a : "#6366f1";
  const paletteMode = payload.m === "light" ? "light" : "dark";
  const bgLightness = clamp01(typeof payload.bl === "number" ? payload.bl : 0.5);
  const durationSeconds = clampNumber(payload.d, 1, 600, 10);

  return {
    presetId: preset.id,
    params: reconciled,
    accentHex,
    paletteMode,
    bgLightness,
    paletteOverrides: ov,
    variantName,
    durationSeconds,
    aspectRatio: ar,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function clampNumber(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function readShareFromHash(): ShareSnapshot | null {
  if (typeof location === "undefined") return null;
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const encoded = params.get(HASH_KEY);
  if (!encoded) return null;
  return decodeShareState(encoded);
}

export function writeShareToHash(snap: ShareSnapshot): void {
  if (typeof location === "undefined" || typeof history === "undefined") return;
  const encoded = encodeShareState(snap);
  const url = `${location.pathname}${location.search}#${HASH_KEY}=${encoded}`;
  history.replaceState(null, "", url);
}

export function getShareUrl(snap: ShareSnapshot): string {
  const encoded = encodeShareState(snap);
  return `${location.origin}${location.pathname}${location.search}#${HASH_KEY}=${encoded}`;
}
