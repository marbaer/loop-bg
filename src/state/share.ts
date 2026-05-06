import { zlibSync, unzlibSync } from "fflate";
import { presets } from "../presets";
import type { ParamValues } from "../presets/types";
import type { PaletteOverrides, PaletteSlot } from "../color/palette";
import type { AspectRatio } from "./store";

// v1: plain base64 JSON (legacy, still decoded for backward compat)
// v2: delta-encoded JSON + deflate-raw + base64url
const SHARE_VERSION = 2;
const HASH_KEY = "s";

const DEFAULT_ACCENT = "#6366f1";
const DEFAULT_MODE: "dark" | "light" = "dark";
const DEFAULT_BL = 0.5;
const DEFAULT_DURATION = 10;
const DEFAULT_AR: AspectRatio = "16:9";

interface SharePayload {
  v: number;
  p: string;
  pr: ParamValues;
  a?: string;
  m?: "dark" | "light";
  bl?: number;
  ov?: PaletteOverrides;
  vr?: string;
  d?: number;
  ar?: AspectRatio;
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

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isZlib(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  // zlib header: CMF byte has deflate method (low nibble = 8), FLG byte satisfies
  // (CMF * 256 + FLG) % 31 === 0. JSON bytes ('{' = 0x7B) never satisfy this.
  const cmf = bytes[0];
  const flg = bytes[1];
  return (cmf & 0xf) === 8 && (cmf * 256 + flg) % 31 === 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

export function encodeShareState(snap: ShareSnapshot): string {
  const preset = presets.find((x) => x.id === snap.presetId);

  // Delta-encode: only params that differ from preset defaults.
  const deltaPr: ParamValues = {};
  if (preset) {
    for (const [key, value] of Object.entries(snap.params)) {
      if (!deepEqual(value, preset.defaults[key])) deltaPr[key] = value;
    }
  } else {
    Object.assign(deltaPr, snap.params);
  }

  const payload: SharePayload = { v: SHARE_VERSION, p: snap.presetId, pr: deltaPr };
  if (snap.accentHex !== DEFAULT_ACCENT) payload.a = snap.accentHex;
  if (snap.paletteMode !== DEFAULT_MODE) payload.m = snap.paletteMode;
  if (snap.bgLightness !== DEFAULT_BL) payload.bl = snap.bgLightness;
  if (Object.keys(snap.paletteOverrides).length > 0) payload.ov = snap.paletteOverrides;
  if (snap.variantName) payload.vr = snap.variantName;
  if (snap.durationSeconds !== DEFAULT_DURATION) payload.d = snap.durationSeconds;
  if (snap.aspectRatio !== DEFAULT_AR) payload.ar = snap.aspectRatio;

  const compressed = zlibSync(new TextEncoder().encode(JSON.stringify(payload)));
  return encodeBytes(compressed);
}

export function decodeShareState(encoded: string): ShareSnapshot | null {
  let payload: SharePayload;
  try {
    const bytes = decodeToBytes(encoded);
    const json = isZlib(bytes)
      ? new TextDecoder().decode(unzlibSync(bytes))
      : new TextDecoder().decode(bytes);
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload || typeof payload.v !== "number" || payload.v < 1 || payload.v > SHARE_VERSION) return null;

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
  const ar = payload.ar && validAR.includes(payload.ar) ? payload.ar : DEFAULT_AR;
  const accentHex = /^#[0-9a-fA-F]{6}$/.test(payload.a ?? "") ? payload.a! : DEFAULT_ACCENT;
  const paletteMode = payload.m === "light" ? "light" : "dark";
  const bgLightness = clamp01(typeof payload.bl === "number" ? payload.bl : DEFAULT_BL);
  const durationSeconds = clampNumber(payload.d, 1, 600, DEFAULT_DURATION);

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
  if (!Number.isFinite(n)) return DEFAULT_BL;
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
