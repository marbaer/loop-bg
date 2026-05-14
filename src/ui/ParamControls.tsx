import { useActivePreset, useActiveParams, useStore } from "../state/store";
import type { ParamSchema, ParamValue } from "../presets/types";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
      <span className="text-sm text-text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-7 w-12 min-[768px]:h-5 min-[768px]:w-9 flex-shrink-0 items-center rounded-full transition-colors " +
          (checked ? "bg-accent" : "bg-overlay-2")
        }
      >
        <span
          className={
            "inline-block h-6 w-6 min-[768px]:h-4 min-[768px]:w-4 transform rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-[1.375rem] min-[768px]:translate-x-[1.125rem]" : "translate-x-0.5")
          }
        />
      </button>
    </label>
  );
}

export function ParamControls() {
  const preset = useActivePreset();
  const params = useActiveParams();
  const setParam = useStore((s) => s.setParam);

  return (
    <div className="space-y-2.5">
      {preset.schema.map((p) => (
        <Control
          key={p.key}
          schema={p}
          value={params[p.key] ?? p.default}
          onChange={(v) => setParam(p.key, v)}
        />
      ))}
    </div>
  );
}

function Control({
  schema,
  value,
  onChange,
}: {
  schema: ParamSchema;
  value: ParamValue;
  onChange: (v: ParamValue) => void;
}) {
  if (schema.kind === "select") {
    const current = typeof value === "string" ? value : schema.default;
    // Binary on/off selects render as a switch toggle with the label inline,
    // not as a pair of pills. Any other 2+ option select stays as pills.
    const isOnOff =
      schema.options.length === 2 &&
      schema.options.every((o) => o.value === "on" || o.value === "off");
    if (isOnOff) {
      return (
        <ToggleRow
          label={schema.label}
          checked={current === "on"}
          onChange={(on) => onChange(on ? "on" : "off")}
        />
      );
    }
    return (
      <div>
        <div className="mb-1 text-sm text-text-muted">{schema.label}</div>
        <div className="flex flex-wrap gap-1">
          {schema.options.map((opt) => {
            const active = opt.value === current;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={
                  "rounded-sm border px-2 py-1 text-sm transition " +
                  (active
                    ? "border-accent/60 bg-accent/15 text-text"
                    : "border-border bg-overlay-1 text-text-muted hover:border-border-strong")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // numeric controls — fall through gracefully if defaults somehow missing
  // (e.g. a schema entry references a param the shader doesn't actually expose).
  const numericValue =
    typeof value === "number"
      ? value
      : typeof schema.default === "number"
        ? schema.default
        : 0;

  if (schema.kind === "seed") {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">{schema.label}</span>
        <button
          onClick={() => onChange(Math.random() * 100)}
          className="rounded-sm border border-border px-2 py-1 font-mono text-xs text-text hover:border-border-strong hover:bg-overlay-2"
        >
          {numericValue.toFixed(3)} ↻
        </button>
      </div>
    );
  }
  const step = schema.kind === "int" ? 1 : schema.step;
  const fmt = schema.kind === "int" ? numericValue.toFixed(0) : numericValue.toFixed(2);
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-text-muted">{schema.label}</span>
        <span className="font-mono text-xs text-text-subtle">{fmt}</span>
      </div>
      <input
        type="range"
        min={schema.min}
        max={schema.max}
        step={step}
        value={numericValue}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          const percent = ((parseFloat(target.value) - parseFloat(target.min)) / (parseFloat(target.max) - parseFloat(target.min))) * 100;
          target.style.setProperty('--slider-fill', `${percent}%`);
        }}
        className="w-full accent-accent"
        style={{ '--slider-fill': `${((numericValue - schema.min) / (schema.max - schema.min)) * 100}%` } as React.CSSProperties}
      />
    </label>
  );
}
