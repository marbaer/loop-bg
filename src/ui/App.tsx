import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, useActivePreset, useActiveParams, selectShareSnapshot } from "../state/store";
import { getShareUrl } from "../state/share";
import { buildPalette } from "../color/palette";
import { Renderer } from "../render/Renderer";
import { PreviewLoop } from "../render/PreviewLoop";
import { R3FPreview } from "../render/R3FPreview";
import { PaperPreview } from "../render/PaperPreview";
import { PresetCurrentCard } from "./PresetCurrentCard";
import { ColorPicker } from "./ColorPicker";
import { ParamControls } from "./ParamControls";
import { ExportDialog } from "./ExportDialog";
import { ImageUploader } from "./ImageUploader";
import { VariantSelector } from "./VariantSelector";
import { ShaderColorControls } from "./ShaderColorControls";
import { presets } from "../presets";
import { AspectRatioSwitcher } from "./AspectRatioSwitcher";
import { BrandKitPanel } from "./BrandKitPanel";
import { aspectRatioNumber } from "../state/store";
import { Button } from "./Button";

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const preset = useActivePreset();
  const params = useActiveParams();
  const accent = useStore((s) => s.accentHex);
  const mode = useStore((s) => s.paletteMode);
  const bgLightness = useStore((s) => s.bgLightness);
  const overrides = useStore((s) => s.paletteOverrides);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const aspectRatio = useStore((s) => s.aspectRatio);

  const palette = useMemo(
    () => buildPalette(accent, mode, { bgLightness, overrides }),
    [accent, mode, bgLightness, overrides]
  );

  void params;
  void palette;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const showVariants = preset.kind === "paper" && (preset.variants?.length ?? 0) > 1;

  return (
    <div className="flex min-h-full w-full flex-col bg-surface text-text lg:h-full lg:flex-row">
      <main className="relative flex flex-col items-center justify-center gap-5 bg-surface p-4 lg:flex-1 lg:gap-7 lg:p-6">
        <AspectRatioSwitcher />
        <div
          className="relative w-full"
          style={{ maxWidth: `min(100%, calc((100vh - 11rem) * ${aspectRatioNumber(aspectRatio)}))` }}
        >
          <div
            className="w-full overflow-hidden rounded border border-border shadow-panel"
            style={{ aspectRatio: aspectRatio.replace(":", "/") }}
          >
            {preset.kind === "shader" ? (
              <ShaderPreview />
            ) : preset.kind === "r3f" ? (
              <R3FPreview preset={preset} />
            ) : (
              <PaperPreview preset={preset} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="primary"
            onClick={() => setExportOpen(true)}
            disabled={preset.kind === "r3f"}
            title={preset.kind === "r3f" ? "Export not wired up for R3F presets" : undefined}
          >
            Export video
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              const snap = selectShareSnapshot(useStore.getState());
              navigator.clipboard.writeText(getShareUrl(snap)).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            title="Copy share link"
            className={
              "relative w-[7.5rem] overflow-hidden active:scale-[0.97] " +
              (copied
                ? "!border-green-500/30 !bg-green-500/15 !text-green-700 dark:!text-green-400"
                : "")
            }
          >
            <span className={"block transition-all duration-200 " + (copied ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100")}>
              Copy link
            </span>
            <span className={"absolute inset-0 flex items-center justify-center transition-all duration-200 " + (copied ? "translate-y-0 opacity-100" : "translate-y-full opacity-0")}>
              Copied
            </span>
          </Button>
        </div>
      </main>
      <aside className="w-full border-t border-border bg-surface-raised p-4 lg:w-[340px] lg:flex-shrink-0 lg:overflow-y-scroll lg:border-l lg:border-t-0 lg:p-5">
        <header className="mb-5 flex items-center justify-between">
          <div className="text-headline font-semibold text-text">Loop BG</div>
          <IconButton
            label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </header>
        <Section title="Preset">
          <div className="space-y-2">
            <PresetCurrentCard />
            {showVariants && preset.kind === "paper" && (
              <VariantSelector preset={preset} />
            )}
          </div>
        </Section>
        <Section title="Saved palettes">
          <BrandKitPanel />
        </Section>
        {preset.kind === "paper" && preset.usesImage && (
          <Section title="Logo">
            <ImageUploader />
          </Section>
        )}
        <Section>
          {"colorSlots" in preset && preset.colorSlots && preset.colorSlots.length > 0 ? (
            <ShaderColorControls preset={preset} />
          ) : (
            <ColorPicker />
          )}
        </Section>
        <Section
          title="Parameters"
          action={
            <IconButton label="Reset parameters" onClick={() => useStore.getState().resetParams()}>
              <ResetIcon />
            </IconButton>
          }
        >
          <ParamControls />
        </Section>
      </aside>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

/** Shader preview pipeline — only mounted when a shader preset is active so
 *  its WebGL2 context doesn't conflict with R3F's. */
function ShaderPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const loopRef = useRef<PreviewLoop | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new Renderer(canvas);
    } catch (e) {
      console.error(e);
      return;
    }
    const loop = new PreviewLoop(
      canvas,
      ({ progress, width, height }) => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        const s = useStore.getState();
        const presetNow = presets.find((p) => p.id === s.presetId);
        if (!presetNow || presetNow.kind !== "shader") return;
        const p = s.paramsByPreset[s.presetId];
        const palette = buildPalette(s.accentHex, s.paletteMode, {
          bgLightness: s.bgLightness,
          overrides: s.paletteOverrides,
        });
        // Scale time BEFORE wrapping so fractional speeds wrap at shader-loop
        // boundaries (every 1/speed wall-clock loops). Otherwise the wrapped
        // `t` would jump from speed→0 each duration and break the seam.
        const speed = typeof p.u_speed === "number" ? p.u_speed : 1;
        const tScaled = (progress * speed) % 1;
        renderer.render(presetNow, p, palette, tScaled, width, height);
      },
      () => useStore.getState().durationSeconds * 1000
    );
    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      loopRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}

function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-text-subtle">
            {title}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded text-text-muted transition hover:bg-overlay-2 hover:text-text"
    >
      {children}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

