import { useMemo } from "react";
import { useStore, useActiveParams } from "../state/store";
import { buildPalette } from "../color/palette";
import type { PaperPreset } from "../presets/types";

/** Wrapper that renders a paper-design/shaders-react component, mapping our
 *  store state (accent / palette / params) into the component's props. The
 *  shader's animation runs internally; we just pass colors + knobs and React
 *  re-renders on store changes. */
export function PaperPreview({ preset }: { preset: PaperPreset }) {
  const params = useActiveParams();
  const accent = useStore((s) => s.accentHex);
  const mode = useStore((s) => s.paletteMode);
  const bgLightness = useStore((s) => s.bgLightness);
  const overrides = useStore((s) => s.paletteOverrides);

  const uploadedImage = useStore((s) => s.uploadedImage);

  const palette = useMemo(
    () => buildPalette(accent, mode, { bgLightness, overrides }),
    [accent, mode, bgLightness, overrides]
  );

  const props = useMemo(
    () => preset.propsFor(params, palette, preset.usesImage ? uploadedImage : null),
    [preset, params, palette, uploadedImage]
  );
  const Component = preset.Component;

  return (
    <Component
      {...props}
      style={{ width: "100%", height: "100%", display: "block", ...preset.style }}
    />
  );
}
