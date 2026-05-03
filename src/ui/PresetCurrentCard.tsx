import { useEffect, useMemo, useRef, useState } from "react";
import { useActivePreset, useStore } from "../state/store";
import { presets } from "../presets";

type PresetGroup = { label: string; ids: Set<string> };

function buildGroups(): PresetGroup[] {
  // Paper Shader presets (from the paper-design library) all have ids prefixed
  // with `paper-`. Everything else is hand-rolled for Loop BG.
  const paper = new Set<string>();
  const custom = new Set<string>();
  for (const p of presets) {
    if (p.id.startsWith("paper-")) paper.add(p.id);
    else custom.add(p.id);
  }
  return [
    { label: "Paper shaders", ids: paper },
    { label: "Loop BG", ids: custom },
  ];
}

export function PresetCurrentCard() {
  const preset = useActivePreset();
  const setPreset = useStore((s) => s.setPreset);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const groups = useMemo(buildGroups, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || cardRef.current?.contains(t)) return;
      setOpen(false);
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
    <div className="relative">
      <button
        ref={cardRef}
        onClick={() => setOpen((o) => !o)}
        className={
          "group relative block w-full overflow-hidden rounded border px-3 py-2.5 text-left transition " +
          (open
            ? "border-accent/60 bg-accent/15"
            : "border-border bg-overlay-1 hover:border-border-strong hover:bg-overlay-2")
        }
      >
        <div className="flex items-start gap-2.5">
          <KindBadge kind={preset.kind} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-text">{preset.name}</div>
            <div className="line-clamp-2 text-xs leading-tight text-text-subtle">
              {preset.description}
            </div>
          </div>
        </div>
        <div
          className={
            "pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-popover/80 text-xs font-medium uppercase tracking-wider text-text backdrop-blur-sm transition " +
            (open ? "opacity-0" : "opacity-0 group-hover:opacity-100")
          }
        >
          Browse presets
        </div>
      </button>
      {open && (
        <div
          ref={popRef}
          className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-surface-popover p-2 shadow-panel"
        >
          {groups.map((g) => {
            const items = presets.filter((p) => g.ids.has(p.id));
            if (items.length === 0) return null;
            return (
              <div key={g.label} className="space-y-1.5">
                <div className="px-1 text-xs font-medium uppercase tracking-wider text-text-subtle">
                  {g.label}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map((p) => {
                    const active = p.id === preset.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPreset(p.id);
                          setOpen(false);
                        }}
                        className={
                          "rounded border px-2.5 py-2 text-left transition " +
                          (active
                            ? "border-accent/60 bg-accent/15"
                            : "border-border bg-overlay-1 hover:border-border-strong hover:bg-overlay-2")
                        }
                      >
                        <div className="truncate text-xs font-medium text-text">
                          {p.name}
                        </div>
                        <div className="line-clamp-2 text-xs leading-tight text-text-subtle">
                          {p.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <div
      className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-sm bg-accent/15 font-mono text-xs uppercase tracking-wider text-accent"
      title={kind}
    >
      {kind === "shader" ? "SH" : kind === "r3f" ? "3D" : "PA"}
    </div>
  );
}
