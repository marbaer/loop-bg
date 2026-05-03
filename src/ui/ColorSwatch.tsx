import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
  ariaLabel?: string;
}

export function ColorSwatch({ value, onChange, size = 32, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: size, height: size, backgroundColor: value }}
        className="block overflow-hidden rounded border border-border transition hover:border-border-strong"
        aria-label={ariaLabel ?? "Pick color"}
      />
      {open && (
        <ColorPopover value={value} onChange={onChange} />
      )}
    </div>
  );
}

function ColorPopover({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 };
  const hsl = rgbToHsl(rgb);
  const [hexDraft, setHexDraft] = useState(value);
  const [mode, setMode] = useState<"rgb" | "hsl">("rgb");
  useEffect(() => setHexDraft(value), [value]);

  const setRgbChannel = (key: "r" | "g" | "b", n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(Number.isFinite(n) ? n : 0)));
    onChange(rgbToHex({ ...rgb, [key]: clamped }));
  };

  const setHslChannel = (key: "h" | "s" | "l", n: number) => {
    const max = key === "h" ? 360 : 100;
    const clamped = Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));
    onChange(rgbToHex(hslToRgb({ ...hsl, [key]: clamped })));
  };

  const commitHex = () => {
    const norm = normalizeHex(hexDraft);
    if (norm) onChange(norm);
    else setHexDraft(value);
  };

  return (
    <div className="absolute left-0 top-full z-50 mt-1.5 w-[260px] space-y-3 rounded-lg border border-border bg-surface-popover p-3 shadow-panel">
      <HexColorPicker color={value} onChange={onChange} className="loop-bg-color-picker" />
      <div className="flex items-center gap-2">
        <EyedropperButton onChange={onChange} />
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitHex();
              e.currentTarget.blur();
            }
          }}
          spellCheck={false}
          className="h-8 flex-1 rounded border border-border bg-overlay-1 px-3 font-mono text-sm text-text focus:border-border-strong focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex overflow-hidden rounded border border-border text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("rgb")}
            className={
              "flex-1 px-2 py-0.5 uppercase tracking-wider transition " +
              (mode === "rgb" ? "bg-accent/15 text-text" : "text-text-subtle hover:text-text")
            }
          >
            RGB
          </button>
          <button
            type="button"
            onClick={() => setMode("hsl")}
            className={
              "flex-1 px-2 py-0.5 uppercase tracking-wider transition " +
              (mode === "hsl" ? "bg-accent/15 text-text" : "text-text-subtle hover:text-text")
            }
          >
            HSL
          </button>
        </div>
        {mode === "rgb" ? (
          <div className="grid grid-cols-3 gap-2">
            <ChannelInput label="R" max={255} value={rgb.r} onChange={(n) => setRgbChannel("r", n)} />
            <ChannelInput label="G" max={255} value={rgb.g} onChange={(n) => setRgbChannel("g", n)} />
            <ChannelInput label="B" max={255} value={rgb.b} onChange={(n) => setRgbChannel("b", n)} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <ChannelInput label="H" max={360} value={hsl.h} onChange={(n) => setHslChannel("h", n)} />
            <ChannelInput label="S" max={100} value={hsl.s} onChange={(n) => setHslChannel("s", n)} />
            <ChannelInput label="L" max={100} value={hsl.l} onChange={(n) => setHslChannel("l", n)} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="block">
      <input
        type="number"
        min={0}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onChange(parseInt(draft, 10))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(parseInt(draft, 10));
            e.currentTarget.blur();
          }
        }}
        className="h-8 w-full rounded border border-border bg-overlay-1 px-2 text-center text-sm text-text focus:border-border-strong focus:outline-none"
      />
      <div className="mt-1 text-center text-xs text-text-subtle">{label}</div>
    </label>
  );
}

function EyedropperButton({ onChange }: { onChange: (hex: string) => void }) {
  const supported = typeof window !== "undefined" && "EyeDropper" in window;
  if (!supported) return <div className="h-8 w-8" />;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const EyeDropperCtor = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
          const ed = new EyeDropperCtor();
          const result = await ed.open();
          onChange(result.sRGBHex);
        } catch {
          /* user dismissed */
        }
      }}
      title="Pick from screen"
      aria-label="Pick from screen"
      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded border border-border bg-overlay-1 text-text-muted transition hover:border-border-strong hover:text-text"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 22 1-1h3l9-9" />
        <path d="M3 21v-3l9-9" />
        <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
      </svg>
    </button>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

function normalizeHex(input: string): string | null {
  const rgb = hexToRgb(input);
  return rgb ? rgbToHex(rgb) : null;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      case bN:
        h = (rN - gN) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
  const hN = ((h % 360) + 360) % 360 / 360;
  const sN = s / 100;
  const lN = l / 100;
  if (sN === 0) {
    const v = Math.round(lN * 255);
    return { r: v, g: v, b: v };
  }
  const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
  const p = 2 * lN - q;
  const hue2rgb = (t: number) => {
    let tN = t;
    if (tN < 0) tN += 1;
    if (tN > 1) tN -= 1;
    if (tN < 1 / 6) return p + (q - p) * 6 * tN;
    if (tN < 1 / 2) return q;
    if (tN < 2 / 3) return p + (q - p) * (2 / 3 - tN) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(hN + 1 / 3) * 255),
    g: Math.round(hue2rgb(hN) * 255),
    b: Math.round(hue2rgb(hN - 1 / 3) * 255),
  };
}
