import { useRef, useState } from "react";
import { useStore, useActiveParams } from "../state/store";
import type { ColorSlot } from "../presets/types";
import { shadesFromColor } from "../color/shades";
import { ColorSwatch } from "./ColorSwatch";
import { Button } from "./Button";

/** Per-shader color controls. Replaces the global brand-palette ColorPicker
 *  for paper-design presets. Each slot maps to one shader color prop (or one
 *  entry in a colors array) and is edited directly into the preset's params. */
export function ShaderColorControls({ preset }: { preset: { colorSlots?: ColorSlot[] } }) {
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
          className="grid h-11 w-11 flex-shrink-0 cursor-grab touch-none place-items-center text-text-subtle hover:text-text active:cursor-grabbing lg:h-8 lg:w-5"
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
        className="h-8 min-w-0 flex-1 rounded border border-border bg-overlay-1 px-3 font-mono text-sm text-text focus:border-border-strong focus:outline-none"
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
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragStateRef = useRef<{ from: number; over: number | null; edge: "top" | "bottom" | null }>({
    from: -1,
    over: null,
    edge: null,
  });

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = colors.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function resetDrag() {
    dragStateRef.current = { from: -1, over: null, edge: null };
    setDragIndex(null);
    setOverIndex(null);
    setOverEdge(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-text-subtle">
          {label} <span className="text-text-subtle/40">({colors.length}/{max})</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShadesPickerOpen((o) => !o)}
          title="Generate shades from one color"
        >
          Shades…
        </Button>
      </div>
      {shadesPickerOpen && (
        <div className="rounded border border-border bg-overlay-1 p-2 space-y-2">
          <div className="text-sm text-text-muted">Pick a source color, fill {colors.length} shades:</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <ColorRow color={shadesSource} onChange={setShadesSource} />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onChange(shadesFromColor(shadesSource, Math.max(min, colors.length || 4)));
                setShadesPickerOpen(false);
              }}
            >
              Fill
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {colors.map((c, i) => {
          const isOver = overIndex === i;
          return (
            <div
              key={i}
              ref={(el) => {
                itemRefs.current[i] = el;
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
                  onPointerDown: (e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragStateRef.current = { from: i, over: null, edge: null };
                    setDragIndex(i);
                  },
                  onPointerMove: (e) => {
                    e.preventDefault(); // suppress page scroll throughout the drag
                    const state = dragStateRef.current;
                    if (state.from < 0) return;
                    const y = e.clientY;
                    let foundOver: number | null = null;
                    let foundEdge: "top" | "bottom" | null = null;
                    for (let j = 0; j < itemRefs.current.length; j++) {
                      const el = itemRefs.current[j];
                      if (!el) continue;
                      const rect = el.getBoundingClientRect();
                      if (y >= rect.top && y <= rect.bottom) {
                        foundOver = j;
                        foundEdge = y - rect.top < rect.height / 2 ? "top" : "bottom";
                        break;
                      }
                    }
                    if (foundOver !== state.over || foundEdge !== state.edge) {
                      dragStateRef.current = { from: state.from, over: foundOver, edge: foundEdge };
                      setOverIndex(foundOver);
                      setOverEdge(foundEdge);
                    }
                  },
                  onPointerUp: () => {
                    const { from, over, edge } = dragStateRef.current;
                    if (from >= 0 && over !== null && edge !== null) {
                      let target = edge === "bottom" ? over + 1 : over;
                      if (target > from) target -= 1;
                      reorder(from, target);
                    }
                    resetDrag();
                  },
                  onPointerCancel: () => {
                    resetDrag();
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
        <Button
          size="sm"
          variant="dashed"
          onClick={() => onChange([...colors, colors[colors.length - 1] ?? "#888888"])}
        >
          + Add color
        </Button>
      )}
    </div>
  );
}
