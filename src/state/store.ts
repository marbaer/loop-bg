import { create } from "zustand";
import { defaultsFromSchema } from "../presets/types";
import { presets } from "../presets";
import type { ParamValues, ParamValue } from "../presets/types";
import type { PaletteOverrides, PaletteSlot } from "../color/palette";

export type PaletteMode = "dark" | "light";
export type ChromeTheme = "dark" | "light";

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

export interface AppState {
  presetId: string;
  paramsByPreset: Record<string, ParamValues>;
  accentHex: string;
  paletteMode: PaletteMode;
  bgLightness: number;
  paletteOverrides: PaletteOverrides;
  durationSeconds: number;
  exportConfig: ExportConfig;
  /** Optional uploaded image (data URL) for "logo animation" presets that
   *  apply effects to a user-supplied logo. Null when no image is loaded. */
  uploadedImage: string | null;
  /** Chrome theme — only affects sidebar/modal/body. Preview canvas content
   *  is independent and driven by the user's chosen palette. */
  theme: ChromeTheme;
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
  resetParams: () => void;
  setUploadedImage: (dataUrl: string | null) => void;
  /** Track which library variant ("purple", "beach", etc.) is active per paper preset. */
  variantByPreset: Record<string, string>;
  /** Apply a paper preset's library variant: replaces the preset's stored
   *  params with the variant's params (deep-copied) and records the variant
   *  name. Pass null to clear the variant marker. */
  applyVariant: (presetId: string, variantName: string, variantParams: Record<string, unknown>) => void;
  clearVariant: (presetId: string) => void;
}

const initialParams: Record<string, ParamValues> = {};
for (const p of presets) initialParams[p.id] = { ...p.defaults };

export const useStore = create<AppState>((set, get) => ({
  presetId: presets[0].id,
  paramsByPreset: initialParams,
  // taste: a deep azure as the canonical default — looks premium against either light or dark bg.
  accentHex: "#6366f1",
  paletteMode: "dark",
  bgLightness: 0.5,
  paletteOverrides: {},
  durationSeconds: 10,
  exportConfig: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 10,
    format: "mp4",
    quality: "high",
    loopMode: "ping-pong",
  },
  uploadedImage: null,
  variantByPreset: {},
  theme: readPersistedTheme(),
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
  resetParams: () => {
    const id = get().presetId;
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    set((s) => ({
      paramsByPreset: { ...s.paramsByPreset, [id]: { ...preset.defaults } },
    }));
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

// Suppress unused-defaults import warning (used in defaultsFromSchema for tests).
void defaultsFromSchema;
