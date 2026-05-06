import { useStore, type AspectRatio } from "../state/store";

const RATIOS: { value: AspectRatio; label: string; w: number; h: number }[] = [
  { value: "16:9", label: "16:9", w: 16, h: 9 },
  { value: "9:16", label: "9:16", w: 9, h: 16 },
  { value: "1:1", label: "1:1", w: 1, h: 1 },
  { value: "4:5", label: "4:5", w: 4, h: 5 },
];

const ICON_BOX = 18;

export function AspectRatioSwitcher() {
  const current = useStore((s) => s.aspectRatio);
  const setAspectRatio = useStore((s) => s.setAspectRatio);

  return (
    <div className="flex items-center gap-1">
      {RATIOS.map(({ value, label, w, h }) => {
        const active = current === value;
        const scale = Math.min(ICON_BOX / w, ICON_BOX / h);
        const rw = Math.round(w * scale);
        const rh = Math.round(h * scale);
        return (
          <button
            key={value}
            onClick={() => setAspectRatio(value)}
            title={label}
            aria-label={`Switch to ${label}`}
            className={
              "flex flex-col items-center gap-1 rounded px-2 py-1 text-xs transition " +
              (active
                ? "bg-accent/15 ring-1 ring-accent/40 text-text"
                : "text-text-muted hover:bg-overlay-2 hover:text-text")
            }
          >
            <svg
              width={ICON_BOX}
              height={ICON_BOX}
              viewBox={`0 0 ${ICON_BOX} ${ICON_BOX}`}
              fill="none"
            >
              <rect
                x={(ICON_BOX - rw) / 2 + 0.5}
                y={(ICON_BOX - rh) / 2 + 0.5}
                width={rw - 1}
                height={rh - 1}
                rx={1}
                stroke="currentColor"
                strokeWidth={active ? 1.5 : 1}
              />
            </svg>
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
