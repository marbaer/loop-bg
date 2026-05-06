import { useEffect, useRef, useState } from "react";
import { useStore, useActivePreset, useActiveParams, ASPECT_RATIO_RESOLUTIONS } from "../state/store";
import { buildPalette } from "../color/palette";
import { runExport, downloadBlob } from "../export/ExportController";
import { runPaperExport } from "../export/PaperExportController";
import { detectCapabilities, type ExportCapabilities } from "../export/capabilities";
import { Button } from "./Button";

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const config = useStore((s) => s.exportConfig);
  const setConfig = useStore((s) => s.setExportConfig);
  const aspectRatio = useStore((s) => s.aspectRatio);
  const resolutions = ASPECT_RATIO_RESOLUTIONS[aspectRatio];
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      detectCapabilities().then(setCaps);
      setError(null);
      setProgress(0);
    }
  }, [open]);

  // If caps loaded and the currently-selected format isn't supported, fall
  // back to the one that is.
  useEffect(() => {
    if (!caps) return;
    if (config.format === "mp4" && !caps.h264 && caps.vp9) setConfig({ format: "webm" });
    else if (config.format === "webm" && !caps.vp9 && caps.h264) setConfig({ format: "mp4" });
  }, [caps, config.format, setConfig]);

  if (!open) return null;

  async function onExport() {
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
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
          signal: controller.signal,
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
        signal: controller.signal,
        onProgress: (frame, total) => setProgress(frame / total),
      });
      downloadBlob(result.blob, result.filename);
      onClose();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        onClose();
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-popover p-5 text-text shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline font-semibold text-text">Export video</h2>
          <button
            onClick={() => {
              if (busy) abortRef.current?.abort();
              else onClose();
            }}
            className="text-text-subtle hover:text-text"
            aria-label="Close"
          >
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
              options={resolutions.map((r) => ({
                v: `${r.width}x${r.height}`,
                label: r.label,
              }))}
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
                {
                  v: "mp4",
                  label: "MP4 / H.264",
                  disabled: !!caps && !caps.h264,
                  title: !!caps && !caps.h264 ? "H.264 not supported in this browser" : undefined,
                },
                {
                  v: "webm",
                  label: "WebM / VP9",
                  disabled: !!caps && !caps.vp9,
                  title: !!caps && !caps.vp9 ? "VP9 not supported in this browser" : undefined,
                },
              ]}
              value={config.format}
              onChange={(v) => setConfig({ format: v as "mp4" | "webm" })}
            />
          </Field>

          {preset.kind === "paper" && (
            <Field label="Playback">
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
                  : "Frames captured in sequence — first and last frames won't match"}
              </div>
            </Field>
          )}

        </fieldset>

        {error && (
          <div className="mt-3 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
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
          <Button
            size="md"
            variant="secondary"
            onClick={() => {
              if (busy) abortRef.current?.abort();
              else onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            onClick={onExport}
            disabled={busy}
          >
            {busy ? "Encoding…" : "Export"}
          </Button>
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
  options: { v: T; label: string; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          disabled={o.disabled}
          title={o.title}
          className={
            "flex-1 rounded-sm border px-2 py-1.5 text-sm transition " +
            (o.disabled
              ? "cursor-not-allowed border-border bg-overlay-1 text-text-subtle/50"
              : value === o.v
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
