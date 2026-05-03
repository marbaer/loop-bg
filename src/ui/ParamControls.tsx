import { useActivePreset, useActiveParams, useStore } from "../state/store";
import type { ParamSchema, ParamValue } from "../presets/types";

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
    return (
      <div>
        <div className="mb-1 text-xs text-text-muted">{schema.label}</div>
        <div className="flex flex-wrap gap-1">
          {schema.options.map((opt) => {
            const active = opt.value === current;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={
                  "rounded-sm border px-2 py-1 text-xs transition " +
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
        <span className="text-xs text-text-muted">{schema.label}</span>
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
      <div className="mb-1 flex items-center justify-between text-xs">
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
        className="w-full accent-accent"
      />
    </label>
  );
}
