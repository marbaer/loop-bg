import { useEffect, useState } from "react";
import { useStore, useActivePreset, useActiveParams } from "../state/store";
import { buildPalette } from "../color/palette";
import { runExport, downloadBlob } from "../export/ExportController";
import { runPaperExport } from "../export/PaperExportController";
import { detectCapabilities, type ExportCapabilities } from "../export/capabilities";

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config = useStore((s) => s.exportConfig);
  const setConfig = useStore((s) => s.setExportConfig);
  const duration = useStore((s) => s.durationSeconds);
  const setDuration = useStore((s) => s.setDuration);
  const accentHex = useStore((s) => s.accentHex);
  const mode = useStore((s) => s.paletteMode);
  const bgLightness = useStore((s) => s.bgLightness);
  const overrides = useStore((s) => s.paletteOverrides);
  const uploadedImage = useStore((s) => s.uploadedImage);
  const preset = useActivePreset();
  const params = useActiveParams();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<ExportCapabilities | null>(null);

  useEffect(() => {
    if (open) {
      detectCapabilities().then(setCaps);
      setError(null);
      setProgress(0);
    }
  }, [open]);

  if (!open) return null;

  const totalFrames = Math.round(config.durationSeconds * config.fps);

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const palette = buildPalette(accentHex, mode, { bgLightness, overrides });
      if (preset.kind === "paper") {
        const componentProps = preset.propsFor(
          params,
          palette,
          preset.usesImage ? uploadedImage : null
        );
        const result = await runPaperExport({
          preset,
          componentProps,
          config,
          onProgress: (frame, total) => setProgress(frame / total),
        });
        downloadBlob(result.blob, result.filename);
        onClose();
        return;
      }
      const result = await runExport({
        preset,
        params,
        palette,
        config,
        onProgress: (frame, total) => setProgress(frame / total),
      });
      downloadBlob(result.blob, result.filename);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] rounded-lg border border-border bg-surface-popover p-5 text-text shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Export video</h2>
          <button onClick={onClose} disabled={busy} className="text-text-subtle hover:text-text disabled:opacity-30" aria-label="Close">
            ✕
          </button>
        </div>

        <fieldset disabled={busy} className="space-y-3 disabled:opacity-50">
          <Field label="Video length">
            <Segmented
              options={[
                { v: "10", label: "10s" },
                { v: "30", label: "30s" },
                { v: "60", label: "60s" },
                { v: "90", label: "90s" },
                { v: "120", label: "120s" },
              ]}
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
            />
          </Field>

          <Field label="Resolution">
            <Segmented
              options={[
                { v: "1280x720", label: "720p" },
                { v: "1920x1080", label: "1080p" },
                { v: "2560x1440", label: "1440p" },
              ]}
              value={`${config.width}x${config.height}`}
              onChange={(v) => {
                const [w, h] = v.split("x").map(Number);
                setConfig({ width: w, height: h });
              }}
            />
          </Field>

          <Field label="Frame rate">
            <Segmented
              options={[
                { v: "30", label: "30 fps" },
                { v: "60", label: "60 fps" },
              ]}
              value={String(config.fps)}
              onChange={(v) => setConfig({ fps: Number(v) as 30 | 60 })}
            />
          </Field>

          <Field label="Quality">
            <Segmented
              options={[
                { v: "standard", label: "Standard" },
                { v: "high", label: "High" },
                { v: "max", label: "Max" },
              ]}
              value={config.quality}
              onChange={(v) => setConfig({ quality: v as typeof config.quality })}
            />
          </Field>

          <Field label="Format">
            <Segmented
              options={[
                { v: "mp4", label: "MP4 / H.264" },
                { v: "webm", label: "WebM / VP9" },
              ]}
              value={config.format}
              onChange={(v) => setConfig({ format: v as "mp4" | "webm" })}
            />
          </Field>

          {preset.kind === "paper" && (
            <Field label="Loop">
              <Segmented
                options={[
                  { v: "ping-pong", label: "Ping-pong (seamless)" },
                  { v: "linear", label: "Linear" },
                ]}
                value={config.loopMode}
                onChange={(v) => setConfig({ loopMode: v as "linear" | "ping-pong" })}
              />
              <div className="mt-1 text-xs text-text-subtle">
                {config.loopMode === "ping-pong"
                  ? `Captures ${Math.ceil(config.durationSeconds / 2)}s forward, plays remaining ${
                      config.durationSeconds - Math.ceil(config.durationSeconds / 2)
                    }s in reverse → seamless`
                  : "Real-time capture; loop seamlessness depends on shader periodicity"}
              </div>
            </Field>
          )}

          <div className="pt-1 text-xs text-text-subtle">
            {totalFrames} frames · seamless loop
          </div>
          {caps && (
            <div className="text-xs text-text-subtle">
              WebCodecs: {caps.webCodecs ? "✓" : "✗"} · H.264: {caps.h264 ? "✓" : "✗"} · VP9:{" "}
              {caps.vp9 ? "✓" : "✗"}
            </div>
          )}

        </fieldset>

        {error && (
          <div className="mt-3 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {busy && (
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-overlay-2">
              <div
                className="h-full bg-accent transition-[width] duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="text-xs text-text-subtle">
              Encoding… {Math.round(progress * 100)}%
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded border border-border px-3 py-1.5 text-xs text-text-muted hover:border-border-strong hover:text-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onExport}
            disabled={busy}
            className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-accent-text hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Encoding…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wider text-text-subtle">{label}</div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={
            "flex-1 rounded-sm border px-2 py-1.5 text-xs transition " +
            (value === o.v
              ? "border-accent/60 bg-accent/15 text-text"
              : "border-border bg-overlay-1 text-text-muted hover:border-border-strong")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
