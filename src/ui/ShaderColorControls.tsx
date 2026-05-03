import { useState } from "react";
import { useStore, useActiveParams } from "../state/store";
import type { ColorSlot, PaperPreset } from "../presets/types";
import { shadesFromColor } from "../color/shades";
import { ColorSwatch } from "./ColorSwatch";

/** Per-shader color controls. Replaces the global brand-palette ColorPicker
 *  for paper-design presets. Each slot maps to one shader color prop (or one
 *  entry in a colors array) and is edited directly into the preset's params. */
export function ShaderColorControls({ preset }: { preset: PaperPreset }) {
  const params = useActiveParams();
  const setParam = useStore((s) => s.setParam);
  const slots = preset.colorSlots ?? [];

  if (slots.length === 0) return null;

  return (
    <div className="space-y-4">
      {slots.map((slot) => (
        <SlotControl
          key={slot.key}
          slot={slot}
          value={params[slot.key]}
          onChange={(v) => setParam(slot.key, v)}
        />
      ))}
    </div>
  );
}

function SlotControl({
  slot,
  value,
  onChange,
}: {
  slot: ColorSlot;
  value: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (v: any) => void;
}) {
  if (slot.kind === "color") {
    const hex = typeof value === "string" ? value : "#000000";
    return (
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wider text-text-subtle">{slot.label}</div>
        <ColorRow color={hex} onChange={onChange} />
      </div>
    );
  }
  // colorArray
  const arr: string[] = Array.isArray(value) ? (value as string[]) : [];
  const max = slot.maxCount ?? 10;
  const min = slot.minCount ?? 1;
  return (
    <ArrayControl
      label={slot.label}
      colors={arr}
      max={max}
      min={min}
      onChange={onChange}
    />
  );
}

function ColorRow({
  color,
  onChange,
  onRemove,
  dragHandleProps,
  dragging,
  dropIndicator,
}: {
  color: string;
  onChange: (hex: string) => void;
  onRemove?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  dragging?: boolean;
  dropIndicator?: "top" | "bottom" | null;
}) {
  return (
    <div
      className={
        "relative flex items-center gap-2 transition " +
        (dragging ? "opacity-40" : "")
      }
    >
      {dropIndicator && (
        <div
          className={
            "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-accent " +
            (dropIndicator === "top" ? "-top-1" : "-bottom-1")
          }
        />
      )}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="grid h-8 w-4 flex-shrink-0 cursor-grab place-items-center text-text-subtle hover:text-text active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripIcon />
        </div>
      )}
      <ColorSwatch value={color} onChange={onChange} size={32} ariaLabel="Edit color" />
      <input
        type="text"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 rounded border border-border bg-overlay-1 px-3 font-mono text-sm text-text focus:border-border-strong focus:outline-none"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded border border-border bg-overlay-1 text-text-subtle transition hover:border-danger/60 hover:text-danger"
          title="Remove color"
          aria-label="Remove color"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="2" r="1" />
      <circle cx="7.5" cy="2" r="1" />
      <circle cx="2.5" cy="7" r="1" />
      <circle cx="7.5" cy="7" r="1" />
      <circle cx="2.5" cy="12" r="1" />
      <circle cx="7.5" cy="12" r="1" />
    </svg>
  );
}

function ArrayControl({
  label,
  colors,
  max,
  min,
  onChange,
}: {
  label: string;
  colors: string[];
  max: number;
  min: number;
  onChange: (next: string[]) => void;
}) {
  const [shadesPickerOpen, setShadesPickerOpen] = useState(false);
  const [shadesSource, setShadesSource] = useState("#6366f1");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [overEdge, setOverEdge] = useState<"top" | "bottom" | null>(null);

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = colors.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-text-subtle">
          {label} <span className="text-text-subtle/40">({colors.length}/{max})</span>
        </div>
        <button
          onClick={() => setShadesPickerOpen((o) => !o)}
          className="rounded border border-border bg-overlay-1 px-2 py-0.5 text-xs uppercase tracking-wider text-text-muted hover:border-border-strong hover:text-text"
          title="Generate shades from one color"
        >
          Shades…
        </button>
      </div>
      {shadesPickerOpen && (
        <div className="rounded border border-border bg-overlay-1 p-2 space-y-2">
          <div className="text-xs text-text-muted">Pick a source color, fill {colors.length} shades:</div>
          <div className="flex items-center gap-2">
            <ColorRow color={shadesSource} onChange={setShadesSource} />
            <button
              onClick={() => {
                onChange(shadesFromColor(shadesSource, Math.max(min, colors.length || 4)));
                setShadesPickerOpen(false);
              }}
              className="rounded bg-accent px-2 py-1 text-xs font-medium uppercase tracking-wider text-accent-text hover:opacity-90"
            >
              Fill
            </button>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {colors.map((c, i) => {
          const isOver = overIndex === i;
          return (
            <div
              key={i}
              draggable={dragIndex !== null}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                const edge: "top" | "bottom" = e.clientY - rect.top < rect.height / 2 ? "top" : "bottom";
                setOverIndex(i);
                setOverEdge(edge);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex === null) return;
                let target = overEdge === "bottom" ? i + 1 : i;
                if (target > dragIndex) target -= 1;
                reorder(dragIndex, target);
                setDragIndex(null);
                setOverIndex(null);
                setOverEdge(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
                setOverEdge(null);
              }}
            >
              <ColorRow
                color={c}
                onChange={(hex) => {
                  const next = [...colors];
                  next[i] = hex;
                  onChange(next);
                }}
                onRemove={
                  colors.length > min
                    ? () => onChange(colors.filter((_, j) => j !== i))
                    : undefined
                }
                dragHandleProps={{
                  onMouseDown: () => setDragIndex(i),
                  onMouseUp: () => {
                    if (overIndex === null) setDragIndex(null);
                  },
                }}
                dragging={dragIndex === i}
                dropIndicator={isOver ? overEdge : null}
              />
            </div>
          );
        })}
      </div>
      {colors.length < max && (
        <button
          onClick={() => onChange([...colors, colors[colors.length - 1] ?? "#888888"])}
          className="w-full rounded border border-dashed border-border bg-overlay-1 px-2 py-1.5 text-xs uppercase tracking-wider text-text-subtle hover:border-border-strong hover:text-text"
        >
          + Add color
        </button>
      )}
    </div>
  );
}
