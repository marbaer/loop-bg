import { useStore } from "../state/store";
import type { PaperPreset } from "../presets/types";

/** Pill row of named variants from the paper-design library, displayed above
 *  the parameter sliders. Selecting a variant copies its params into the
 *  user's stored params so the sliders & colors update accordingly. */
export function VariantSelector({ preset }: { preset: PaperPreset }) {
  const variants = preset.variants ?? [];
  const activeVariant = useStore((s) => s.variantByPreset[preset.id]);
  const applyVariant = useStore((s) => s.applyVariant);

  if (variants.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {variants.map((v) => {
        const active = activeVariant === v.name;
        return (
          <button
            key={v.name}
            onClick={() => applyVariant(preset.id, v.name, v.params)}
            className={
              "rounded-sm border px-2 py-1 text-sm transition " +
              (active
                ? "border-accent/60 bg-accent/15 text-text"
                : "border-border bg-overlay-1 text-text-muted hover:border-border-strong hover:text-text")
            }
          >
            {v.name}
          </button>
        );
      })}
    </div>
  );
}

