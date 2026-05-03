import { useStore } from "../state/store";
import { buildPalette, type PaletteSlot } from "../color/palette";
import { useMemo } from "react";
import { ColorSwatch } from "./ColorSwatch";

export function ColorPicker() {
  const accent = useStore((s) => s.accentHex);
  const mode = useStore((s) => s.paletteMode);
  const bgLightness = useStore((s) => s.bgLightness);
  const overrides = useStore((s) => s.paletteOverrides);
  const setAccent = useStore((s) => s.setAccent);
  const setBgLightness = useStore((s) => s.setBgLightness);
  const setOverride = useStore((s) => s.setOverride);
  const clearOverride = useStore((s) => s.clearOverride);
  const resetPalette = useStore((s) => s.resetPalette);

  const palette = useMemo(
    () => buildPalette(accent, mode, { bgLightness, overrides }),
    [accent, mode, bgLightness, overrides]
  );

  const hasOverrides = Object.keys(overrides).length > 0 || bgLightness !== 0.5;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ColorSwatch value={accent} onChange={setAccent} size={36} ariaLabel="Accent color" />
        <input
          type="text"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className="h-8 flex-1 rounded border border-border bg-overlay-1 px-3 font-mono text-sm text-text focus:border-border-strong focus:outline-none"
        />
      </div>

      <div className="flex gap-1.5">
        {palette.shades.map((c, i) => (
          <div
            key={i}
            className="h-5 flex-1 rounded-sm"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      <label className="block">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-text-muted">Background lightness</span>
          <span className="font-mono text-text-subtle">{bgLightness.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={bgLightness}
          onChange={(e) => setBgLightness(parseFloat(e.target.value))}
          className="w-full accent-accent"
        />
      </label>

      <div className="space-y-1.5 pt-1">
        <SlotRow slot="bg" label="Background" color={palette.bg} overridden={!!overrides.bg} onChange={(v) => setOverride("bg", v)} onClear={() => clearOverride("bg")} />
        <SlotRow slot="surface" label="Surface" color={palette.surface} overridden={!!overrides.surface} onChange={(v) => setOverride("surface", v)} onClear={() => clearOverride("surface")} />
        <SlotRow slot="primary" label="Primary" color={palette.primary} overridden={!!overrides.primary} onChange={(v) => setOverride("primary", v)} onClear={() => clearOverride("primary")} />
        <SlotRow slot="secondary" label="Secondary" color={palette.secondary} overridden={!!overrides.secondary} onChange={(v) => setOverride("secondary", v)} onClear={() => clearOverride("secondary")} />
      </div>

      {hasOverrides && (
        <button
          onClick={resetPalette}
          className="w-full rounded-sm border border-border bg-overlay-1 px-2 py-1 text-xs uppercase tracking-wider text-text-muted hover:border-border-strong hover:text-text"
        >
          Reset palette to auto
        </button>
      )}
    </div>
  );
}

function SlotRow({
  slot,
  label,
  color,
  overridden,
  onChange,
  onClear,
}: {
  slot: PaletteSlot;
  label: string;
  color: string;
  overridden: boolean;
  onChange: (hex: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <ColorSwatch value={color} onChange={onChange} size={24} ariaLabel={`${label} color`} />
      <span className="flex-1 text-xs text-text-muted">{label}</span>
      <span className="font-mono text-xs text-text-subtle">{color}</span>
      {overridden ? (
        <button
          onClick={onClear}
          title="Reset to auto"
          className="rounded-sm border border-border px-1.5 py-0.5 text-xs uppercase tracking-wider text-text-muted hover:border-border-strong hover:text-text"
        >
          auto
        </button>
      ) : (
        <span className="px-1.5 text-xs uppercase tracking-wider text-text-subtle/40" title="Derived from accent">
          ·
        </span>
      )}
    </div>
  );
}
