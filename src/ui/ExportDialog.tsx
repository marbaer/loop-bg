import { useEffect, useRef, useState } from "react";
import { useStore, useActivePreset, useActiveParams, ASPECT_RATIO_RESOLUTIONS } from "../state/store";
import { buildPalette } from "../color/palette";
import { runExport, downloadBlob } from "../export/ExportController";
import { runPaperExport } from "../export/PaperExportController";
import { runShaderGradientExport } from "../export/ShaderGradientExportController";
import { runMobileExport } from "../export/MobileExportController";
import {
  detectCapabilities,
  shouldUseMobileExport,
  type ExportCapabilities,
} from "../export/capabilities";
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

  const isMobile = shouldUseMobileExport();
  // On mobile, hide the highest resolution — it can be too slow to render.
  const visibleResolutions = isMobile ? resolutions.slice(0, -1) : resolutions;

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
      const validDurations = isMobile ? [15, 30] : [15, 30, 45, 60];
      if (!validDurations.includes(duration)) {
        const closest = validDurations.reduce((a, b) =>
          Math.abs(b - duration) < Math.abs(a - duration) ? b : a
        );
        setDuration(closest);
      }
      if (isMobile) {
        // Step down from hidden highest resolution.
        const highest = resolutions[resolutions.length - 1];
        if (config.width === highest.width && config.height === highest.height) {
          const fallback = resolutions[resolutions.length - 2];
          setConfig({ width: fallback.width, height: fallback.height });
        }
        // Cap duration at 30s.
        if (duration > 30) setDuration(30);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (shouldUseMobileExport()) {
        const result = await runMobileExport({
          preset,
          params,
          palette,
          image: preset.kind === "paper" && preset.usesImage ? (uploadedImage ?? null) : null,
          config,
          signal: controller.signal,
          onProgress: (frame, total) => setProgress(frame / total),
        });
        downloadBlob(result.blob, result.filename);
        onClose();
        return;
      }

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
      if (preset.kind === "shadergradient") {
        const result = await runShaderGradientExport({
          preset,
          params,
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
      <div className="w-[440px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-popover/80 p-5 text-text shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline font-semibold text-text">Export video</h2>
          <button
            onClick={() => {
              if (busy) abortRef.current?.abort();
              else onClose();
            }}
            className="text-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <fieldset disabled={busy} className="space-y-3 disabled:opacity-50">
          <Field label="Video length">
            <Segmented
              options={[
                { v: "15", label: "15s" },
                { v: "30", label: "30s" },
                ...(!isMobile ? [
                  { v: "45", label: "45s" },
                  { v: "60", label: "60s" },
                ] : []),
              ]}
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
            />
          </Field>

          <Field label="Resolution">
            <Segmented
              options={visibleResolutions.map((r) => ({
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

          {!isMobile && (
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
          )}

          {!isMobile && (
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
          )}

          {(preset.kind === "paper" ||
            (preset.kind === "shadergradient" && params.loop !== "on")) && (
            <Field label="Playback">
              <Segmented
                options={[
                  { v: "ping-pong", label: "Ping-pong" },
                  { v: "linear", label: "One-way" },
                ]}
                value={config.loopMode}
                onChange={(v) => setConfig({ loopMode: v as "linear" | "ping-pong" })}
              />
              <div className="mt-1 text-xs text-text">
                {config.loopMode === "ping-pong"
                  ? "Plays to the midpoint then reverses — first and last frames match"
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
            <div className="text-xs text-text">
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
      <div className="mb-1 text-xs uppercase tracking-wider text-text">{label}</div>
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
                : "border-border bg-overlay-1 text-text hover:border-border-strong")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
