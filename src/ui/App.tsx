import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, useActivePreset, useActiveParams, selectShareSnapshot } from "../state/store";
import { getShareUrl } from "../state/share";
import { buildPalette } from "../color/palette";
import { Renderer } from "../render/Renderer";
import { PreviewLoop } from "../render/PreviewLoop";
import { PaperPreview } from "../render/PaperPreview";
import { ShaderGradientPreview } from "../render/ShaderGradientPreview";
import { PresetCurrentCard } from "./PresetCurrentCard";
import { ColorPicker } from "./ColorPicker";
import { ParamControls } from "./ParamControls";
import { ExportDialog } from "./ExportDialog";
import { captureCanvasImage } from "../export/captureImage";
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

  useEffect(() => {
    const mainEl = document.querySelector('main') as HTMLElement | null;
    const asideEl = document.querySelector('aside') as HTMLElement | null;
    const spacerEl = document.querySelector('.loopbg-aside-spacer') as HTMLElement | null;

    let rafId: number | null = null;
    const updateProgress = () => {
      rafId = null;
      const scrollY = window.scrollY;
      const progress = Math.min(scrollY / 200, 1);
      document.documentElement.style.setProperty('--scroll-progress', String(progress));
      document.documentElement.style.setProperty(
        '--scroll-fade-buttons-pe',
        progress > 0.75 ? 'none' : 'auto'
      );
      if (spacerEl && mainEl && asideEl) {
        // Cap the scroll contribution at 200 (the animation boundary) so the
        // spacer freezes once the canvas reaches minimum size. Without the cap,
        // growing the spacer makes the document taller → allows more scroll →
        // spacer grows more → infinite feedback loop.
        const cappedScrollY = Math.min(scrollY, 200);
        const mainBottom = mainEl.getBoundingClientRect().bottom;
        // aside.offsetTop equivalent — document-absolute position, unaffected
        // by how much we've scrolled. Spacer lives inside aside so it never
        // changes aside's start position.
        const asideDocTop = asideEl.getBoundingClientRect().top + scrollY;
        // Push aside content (Loop BG header) to sit at main's bottom edge.
        // 16px = p-4 aside padding-top on mobile.
        spacerEl.style.height = Math.max(0, mainBottom - (asideDocTop - cappedScrollY) - 16) + 'px';
      }
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const showVariants =
    (preset.kind === "paper" || preset.kind === "shader" || preset.kind === "composite") &&
    (preset.variants?.length ?? 0) > 1;

  return (
    <div className="flex min-h-full w-full flex-col bg-surface text-text min-[768px]:h-full min-[768px]:flex-row">
      {/* Mobile only: switcher lives before main so it scrolls off the top when main sticks */}
      <div className="flex justify-center px-4 pt-4 min-[768px]:hidden">
        <AspectRatioSwitcher />
      </div>
      <main className="loopbg-sticky-canvas relative flex flex-col items-center justify-center gap-5 bg-surface p-4 min-[768px]:min-w-0 min-[768px]:flex-1 min-[768px]:gap-7 min-[768px]:p-6">
        <div className="loopbg-glass-bar" aria-hidden="true" />
        {/* Desktop only: switcher lives inside main */}
        <div className="hidden min-[768px]:flex loopbg-aspect-switcher"><AspectRatioSwitcher /></div>
        <div
          className="group relative z-[1] w-full cursor-pointer"
          style={{ maxWidth: `min(100%, calc((100vh - 11rem) * ${aspectRatioNumber(aspectRatio)}))` }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div
            className="loopbg-sticky-canvas-inner relative w-full overflow-hidden rounded border border-border shadow-panel"
            style={{ aspectRatio: aspectRatio.replace(":", "/"), '--canvas-ar': aspectRatioNumber(aspectRatio) } as React.CSSProperties}
          >
            {(preset.kind === "shader" || preset.kind === "composite") ? (
              <ShaderPreview />
            ) : preset.kind === "shadergradient" ? (
              <ShaderGradientPreview key={preset.id} preset={preset} />
            ) : (
              <PaperPreview preset={preset} />
            )}
            <ImageDownloadButton presetId={preset.id} />
          </div>
        </div>
        <div className="loopbg-scroll-fade-buttons relative z-[1] flex items-center gap-2">
          <Button
            size="lg"
            variant="primary"
            onClick={() => setExportOpen(true)}

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
      <aside className="w-full border-t border-border bg-surface-raised p-4 min-[768px]:w-[370px] min-[768px]:flex-shrink-0 min-[768px]:overflow-y-scroll min-[768px]:border-l min-[768px]:border-t-0 min-[768px]:p-5">
        <div className="loopbg-aside-spacer" aria-hidden="true" />
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
            {showVariants && (
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
 *  its WebGL2 context doesn't conflict with ShaderGradientPreview's. */
function ShaderPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const loopRef = useRef<PreviewLoop | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new Renderer(canvas, { preserveDrawingBuffer: true });
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
        if (!presetNow || (presetNow.kind !== "shader" && presetNow.kind !== "composite")) return;
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
        if (presetNow.kind === "composite") {
          renderer.renderComposite(
            presetNow.backgroundPreset,
            presetNow.backgroundUniforms(p),
            presetNow.id,
            presetNow.foregroundShader,
            presetNow.foregroundUniforms(p),
            tScaled,
            width,
            height,
          );
        } else {
          renderer.render(presetNow, p, palette, tScaled, width, height);
        }
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
      className="grid h-10 w-10 place-items-center rounded text-text-muted transition hover:bg-overlay-2 hover:text-text min-[768px]:h-7 min-[768px]:w-7"
    >
      {children}
    </button>
  );
}

function SunIcon() {
  return (
    <svg className="h-5 w-5 min-[768px]:h-[14px] min-[768px]:w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5 min-[768px]:h-[14px] min-[768px]:w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ImageDownloadButton({ presetId }: { presetId: string }) {
  const [saving, setSaving] = useState(false);
  return (
    <button
      type="button"
      title="Download image"
      aria-label="Download current frame as PNG"
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (saving) return;
        const canvas = e.currentTarget
          .closest(".loopbg-sticky-canvas-inner")
          ?.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) return;
        setSaving(true);
        captureCanvasImage(canvas, presetId)
          .catch((err) => console.error("Image capture failed", err))
          .finally(() => setSaving(false));
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (saving) return;
        const canvas = e.currentTarget
          .closest(".loopbg-sticky-canvas-inner")
          ?.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) return;
        setSaving(true);
        captureCanvasImage(canvas, presetId)
          .catch((err) => console.error("Image capture failed", err))
          .finally(() => setSaving(false));
      }}
      className={
        "loopbg-dl-btn absolute bottom-3 right-3 z-10 grid h-9 w-9 place-items-center rounded " +
        "bg-black/40 text-white/90 backdrop-blur-sm " +
        "hover:bg-black/55 hover:text-white active:scale-95 " +
        "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 " +
        "[@media(hover:hover)]:focus-visible:opacity-100 " +
        (saving ? "!opacity-100" : "")
      }
    >
      <DownloadIcon />
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="h-5 w-5 min-[768px]:h-[13px] min-[768px]:w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

