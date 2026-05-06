import { create } from "zustand";
import { presets } from "../presets";
import type { ParamValues, ParamValue } from "../presets/types";
import type { PaletteOverrides, PaletteSlot } from "../color/palette";
import {
  loadKits,
  saveKits,
  newKitId,
  BrandKitQuotaError,
  type BrandKit,
} from "./brandKits";
import { readShareFromHash, writeShareToHash, type ShareSnapshot } from "./share";
import { shadesFromColor, plainRamp, findMainColor, findDarkestColor } from "../color/shades";

export type PaletteMode = "dark" | "light";
export type ChromeTheme = "dark" | "light";
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

const THEME_STORAGE_KEY = "loop-bg-theme";

function readPersistedTheme(): ChromeTheme {
  if (typeof localStorage === "undefined") return "dark";
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

export interface ExportConfig {
  width: number;
  height: number;
  fps: 30 | 60;
  durationSeconds: number;
  format: "mp4" | "webm";
  /** Quality tier maps to bitrate. */
  quality: "standard" | "high" | "max";
  /** "linear" plays through; "ping-pong" captures first half then plays it
   *  in reverse for the second half — guarantees a seamless loop even when
   *  the underlying shader doesn't naturally repeat. */
  loopMode: "linear" | "ping-pong";
}

export interface ResolutionPreset {
  width: number;
  height: number;
  label: string;
}

export const ASPECT_RATIO_RESOLUTIONS: Record<AspectRatio, ResolutionPreset[]> = {
  "16:9": [
    { width: 1280, height: 720, label: "720p" },
    { width: 1920, height: 1080, label: "1080p" },
    { width: 2560, height: 1440, label: "1440p" },
  ],
  "9:16": [
    { width: 720, height: 1280, label: "720p" },
    { width: 1080, height: 1920, label: "1080p" },
    { width: 1440, height: 2560, label: "1440p" },
  ],
  "1:1": [
    { width: 720, height: 720, label: "720" },
    { width: 1080, height: 1080, label: "1080" },
    { width: 1440, height: 1440, label: "1440" },
  ],
  "4:5": [
    { width: 864, height: 1080, label: "1080" },
    { width: 1080, height: 1350, label: "1350" },
    { width: 1440, height: 1800, label: "1800" },
  ],
};

export function defaultResolution(ar: AspectRatio): ResolutionPreset {
  const list = ASPECT_RATIO_RESOLUTIONS[ar];
  return list[Math.min(1, list.length - 1)];
}

export function aspectRatioNumber(ar: AspectRatio): number {
  const [w, h] = ar.split(":").map(Number);
  return w / h;
}

export interface AppState {
  presetId: string;
  paramsByPreset: Record<string, ParamValues>;
  accentHex: string;
  paletteMode: PaletteMode;
  bgLightness: number;
  paletteOverrides: PaletteOverrides;
  durationSeconds: number;
  exportConfig: ExportConfig;
  aspectRatio: AspectRatio;
  /** Optional uploaded image (data URL) for "logo animation" presets that
   *  apply effects to a user-supplied logo. Null when no image is loaded. */
  uploadedImage: string | null;
  /** Chrome theme — only affects sidebar/modal/body. Preview canvas content
   *  is independent and driven by the user's chosen palette. */
  theme: ChromeTheme;
  brandKits: BrandKit[];
  /** ID of the most recently applied brand kit — drives color picker swatches. */
  lastAppliedKitId: string | null;
  setTheme: (t: ChromeTheme) => void;
  setPreset: (id: string) => void;
  setParam: (key: string, value: ParamValue) => void;
  setAccent: (hex: string) => void;
  setPaletteMode: (mode: PaletteMode) => void;
  setBgLightness: (v: number) => void;
  setOverride: (slot: PaletteSlot, hex: string) => void;
  clearOverride: (slot: PaletteSlot) => void;
  resetPalette: () => void;
  setDuration: (s: number) => void;
  setExportConfig: (patch: Partial<ExportConfig>) => void;
  setAspectRatio: (r: AspectRatio) => void;
  resetParams: () => void;
  setUploadedImage: (dataUrl: string | null) => void;
  /** Track which library variant ("purple", "beach", etc.) is active per paper preset. */
  variantByPreset: Record<string, string>;
  /** Apply a paper preset's library variant: replaces the preset's stored
   *  params with the variant's params (deep-copied) and records the variant
   *  name. Pass null to clear the variant marker. */
  applyVariant: (presetId: string, variantName: string, variantParams: Record<string, unknown>) => void;
  clearVariant: (presetId: string) => void;
  /** Capture the current preset's colors as a named brand kit.
   *  Throws BrandKitQuotaError if localStorage is full. */
  saveCurrentAsBrandKit: (name: string) => BrandKit;
  applyBrandKit: (id: string) => void;
  deleteBrandKit: (id: string) => void;
  renameBrandKit: (id: string, name: string) => void;
}

const initialParams: Record<string, ParamValues> = {};
for (const p of presets) initialParams[p.id] = { ...p.defaults };

const sharedSnapshot = readShareFromHash();

function applyShareToInitial(snap: ShareSnapshot): {
  presetId: string;
  paramsByPreset: Record<string, ParamValues>;
  accentHex: string;
  paletteMode: PaletteMode;
  bgLightness: number;
  paletteOverrides: PaletteOverrides;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  variantByPreset: Record<string, string>;
} {
  const params = { ...initialParams };
  params[snap.presetId] = { ...params[snap.presetId], ...snap.params };
  const variants: Record<string, string> = {};
  if (snap.variantName) variants[snap.presetId] = snap.variantName;
  return {
    presetId: snap.presetId,
    paramsByPreset: params,
    accentHex: snap.accentHex,
    paletteMode: snap.paletteMode,
    bgLightness: snap.bgLightness,
    paletteOverrides: snap.paletteOverrides,
    durationSeconds: snap.durationSeconds,
    aspectRatio: snap.aspectRatio,
    variantByPreset: variants,
  };
}

const hydrated = sharedSnapshot ? applyShareToInitial(sharedSnapshot) : null;

const initialAspectRatio: AspectRatio = hydrated?.aspectRatio ?? "16:9";
const initialResolution = defaultResolution(initialAspectRatio);
const initialDuration = hydrated?.durationSeconds ?? 10;

export const useStore = create<AppState>((set, get) => ({
  presetId: hydrated?.presetId ?? presets[0].id,
  paramsByPreset: hydrated?.paramsByPreset ?? initialParams,
  accentHex: hydrated?.accentHex ?? "#6366f1",
  paletteMode: hydrated?.paletteMode ?? "dark",
  bgLightness: hydrated?.bgLightness ?? 0.5,
  paletteOverrides: hydrated?.paletteOverrides ?? {},
  durationSeconds: initialDuration,
  exportConfig: {
    width: initialResolution.width,
    height: initialResolution.height,
    fps: 30,
    durationSeconds: initialDuration,
    format: "mp4",
    quality: "high",
    loopMode: "ping-pong",
  },
  aspectRatio: initialAspectRatio,
  uploadedImage: null,
  variantByPreset: hydrated?.variantByPreset ?? {},
  theme: readPersistedTheme(),
  brandKits: loadKits(),
  lastAppliedKitId: null,
  setTheme: (t) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    }
    set({ theme: t });
  },
  setPreset: (id) => set({ presetId: id }),
  setUploadedImage: (dataUrl) => set({ uploadedImage: dataUrl }),
  applyVariant: (presetId, variantName, variantParams) =>
    set((s) => ({
      variantByPreset: { ...s.variantByPreset, [presetId]: variantName },
      paramsByPreset: {
        ...s.paramsByPreset,
        [presetId]: { ...(variantParams as ParamValues) },
      },
    })),
  clearVariant: (presetId) =>
    set((s) => {
      const { [presetId]: _, ...rest } = s.variantByPreset;
      return { variantByPreset: rest };
    }),
  setParam: (key, value) =>
    set((s) => ({
      paramsByPreset: {
        ...s.paramsByPreset,
        [s.presetId]: { ...s.paramsByPreset[s.presetId], [key]: value },
      },
    })),
  setAccent: (hex) => set({ accentHex: hex }),
  setPaletteMode: (mode) => set({ paletteMode: mode }),
  setBgLightness: (v) => set({ bgLightness: Math.max(0, Math.min(1, v)) }),
  setOverride: (slot, hex) =>
    set((s) => ({ paletteOverrides: { ...s.paletteOverrides, [slot]: hex } })),
  clearOverride: (slot) =>
    set((s) => {
      const { [slot]: _, ...rest } = s.paletteOverrides;
      return { paletteOverrides: rest };
    }),
  resetPalette: () => set({ paletteOverrides: {}, bgLightness: 0.5 }),
  setDuration: (s) =>
    set((state) => ({
      durationSeconds: s,
      exportConfig: { ...state.exportConfig, durationSeconds: s },
    })),
  setExportConfig: (patch) =>
    set((s) => ({ exportConfig: { ...s.exportConfig, ...patch } })),
  setAspectRatio: (r) =>
    set((s) => {
      const res = defaultResolution(r);
      return {
        aspectRatio: r,
        exportConfig: { ...s.exportConfig, width: res.width, height: res.height },
      };
    }),
  resetParams: () => {
    const id = get().presetId;
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    const schemaKeys = new Set(preset.schema.map((p) => p.key));
    const schemaDefaults = Object.fromEntries(
      Object.entries(preset.defaults).filter(([k]) => schemaKeys.has(k))
    );
    set((s) => ({
      paramsByPreset: {
        ...s.paramsByPreset,
        [id]: { ...s.paramsByPreset[id], ...schemaDefaults },
      },
    }));
  },
  saveCurrentAsBrandKit: (name) => {
    const s = get();
    const preset = presets.find((p) => p.id === s.presetId);
    const params = s.paramsByPreset[s.presetId];
    let colors: string[] = [];
    if (preset && "colorSlots" in preset && preset.colorSlots?.length) {
      for (const slot of preset.colorSlots) {
        if (slot.kind === "color") {
          const hex = params[slot.key];
          if (typeof hex === "string") colors.push(hex);
        } else {
          const arr = params[slot.key];
          if (Array.isArray(arr)) colors.push(...(arr as string[]));
        }
      }
    }
    if (colors.length === 0) colors = [s.accentHex];
    const kit: BrandKit = {
      id: newKitId(),
      name: name.trim() || "Untitled kit",
      colors,
      createdAt: Date.now(),
    };
    const next = [...s.brandKits, kit];
    saveKits(next);
    set({ brandKits: next });
    return kit;
  },
  applyBrandKit: (id) => {
    const s = get();
    const kit = s.brandKits.find((k) => k.id === id);
    if (!kit || kit.colors.length === 0) return;
    const preset = presets.find((p) => p.id === s.presetId);
    if (preset && "colorSlots" in preset && preset.colorSlots?.length) {
      const newParams = { ...s.paramsByPreset[s.presetId] };
      const singleSlots = preset.colorSlots.filter((sl) => sl.kind === "color");
      const arraySlots = preset.colorSlots.filter((sl) => sl.kind !== "color");

      // Assign single-color slots semantically: background slots get the darkest
      // color; all other slots (foreground, bloom, etc.) get the main brand color
      // (highest chroma — the color the user picked as their source in Shades).
      const mainColor = findMainColor(kit.colors);
      const darkestColor = findDarkestColor(kit.colors);
      const usedColors = new Set<string>();
      singleSlots.forEach((sl) => {
        const isBackground = sl.key.toLowerCase().includes("back");
        const assigned = isBackground ? darkestColor : mainColor;
        newParams[sl.key] = assigned;
        usedColors.add(assigned);
      });

      // Only exclude colors that were actually assigned to single slots.
      const remaining = kit.colors.filter((c) => !usedColors.has(c));
      const arraySource = remaining.length > 0 ? remaining : kit.colors;

      for (const slot of arraySlots) {
        const max = (slot as { maxCount?: number }).maxCount ?? 10;
        const min = (slot as { minCount?: number }).minCount ?? 1;
        const defaultArr = preset.defaults[slot.key];
        const defaultCount = Array.isArray(defaultArr) ? defaultArr.length : min;
        // Always target the preset's default count, clamped to slot bounds.
        const targetCount = Math.max(min, Math.min(max, defaultCount));
        // Fill with kit colors; cycle if the kit is smaller, truncate if larger.
        const chunk: string[] = Array.from({ length: targetCount }, (_, i) => arraySource[i % arraySource.length]);
        newParams[slot.key] = chunk;
      }
      set({ paramsByPreset: { ...s.paramsByPreset, [s.presetId]: newParams }, lastAppliedKitId: id });
    } else {
      set({
        accentHex: findMainColor(kit.colors),
        paletteOverrides: { ...s.paletteOverrides, bg: findDarkestColor(kit.colors) },
        lastAppliedKitId: id,
      });
    }
  },
  deleteBrandKit: (id) => {
    const next = get().brandKits.filter((k) => k.id !== id);
    saveKits(next);
    set({ brandKits: next });
  },
  renameBrandKit: (id, name) => {
    const next = get().brandKits.map((k) =>
      k.id === id ? { ...k, name: name.trim() || k.name } : k
    );
    saveKits(next);
    set({ brandKits: next });
  },
}));

export function useActivePreset() {
  const id = useStore((s) => s.presetId);
  return presets.find((p) => p.id === id)!;
}

export function useActiveParams() {
  const id = useStore((s) => s.presetId);
  return useStore((s) => s.paramsByPreset[id]);
}

/** Snapshot the slots that participate in shareable URLs. */
export function selectShareSnapshot(s: AppState): ShareSnapshot {
  return {
    presetId: s.presetId,
    params: s.paramsByPreset[s.presetId],
    accentHex: s.accentHex,
    paletteMode: s.paletteMode,
    bgLightness: s.bgLightness,
    paletteOverrides: s.paletteOverrides,
    variantName: s.variantByPreset[s.presetId],
    durationSeconds: s.durationSeconds,
    aspectRatio: s.aspectRatio,
  };
}

/** Subscribe to state changes and mirror them into the URL hash, debounced. */
let hashSyncTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((state) => {
  if (hashSyncTimer) clearTimeout(hashSyncTimer);
  hashSyncTimer = setTimeout(() => {
    writeShareToHash(selectShareSnapshot(state));
  }, 200);
});

export { BrandKitQuotaError };
export type { BrandKit };

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__loopBgStore = useStore;
}
