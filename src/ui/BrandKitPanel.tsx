import { useState } from "react";
import { useStore, BrandKitQuotaError } from "../state/store";
import type { BrandKit } from "../state/brandKits";
import { Button } from "./Button";

export function BrandKitPanel() {
  const kits = useStore((s) => s.brandKits);
  const saveCurrentAsBrandKit = useStore((s) => s.saveCurrentAsBrandKit);
  const applyBrandKit = useStore((s) => s.applyBrandKit);
  const deleteBrandKit = useStore((s) => s.deleteBrandKit);
  const renameBrandKit = useStore((s) => s.renameBrandKit);

  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function handleSave() {
    setError(null);
    try {
      saveCurrentAsBrandKit(draftName || "Untitled palette");
      setDraftName("");
      setSaving(false);
    } catch (e) {
      setError(e instanceof BrandKitQuotaError ? e.message : "Could not save palette");
    }
  }

  function handleRenameCommit(kit: BrandKit) {
    if (renameValue.trim()) renameBrandKit(kit.id, renameValue.trim());
    setRenamingId(null);
    setRenameValue("");
  }

  if (kits.length === 0 && !saving) {
    return (
      <Button size="sm" variant="dashed" onClick={() => setSaving(true)}>
        + Save current colors as palette
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {kits.map((kit) => (
        <div
          key={kit.id}
          className="flex items-center gap-2 rounded border border-border bg-overlay-1 px-2.5 py-1.5"
        >
          <ColorDots colors={kit.colors} />
          {renamingId === kit.id ? (
            <input
              autoFocus
              className="flex-1 min-w-0 bg-transparent text-xs text-text outline-none"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameCommit(kit)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCommit(kit);
                if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
              }}
            />
          ) : (
            <span
              className="flex-1 min-w-0 truncate text-xs text-text cursor-pointer"
              onDoubleClick={() => { setRenamingId(kit.id); setRenameValue(kit.name); }}
              title="Double-click to rename"
            >
              {kit.name}
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyBrandKit(kit.id)}
            className="flex-shrink-0"
            title="Apply palette to current preset"
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => deleteBrandKit(kit.id)}
            className="flex-shrink-0 hover:!border-danger/60 hover:!text-danger"
            title="Delete palette"
            aria-label="Delete palette"
          >
            ✕
          </Button>
        </div>
      ))}

      {saving ? (
        <div className="space-y-2">
          <input
            autoFocus
            placeholder="Palette name…"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setSaving(false); setDraftName(""); setError(null); }
            }}
            className="w-full rounded border border-border bg-overlay-1 px-2.5 py-1.5 text-xs text-text placeholder-text-subtle outline-none focus:border-accent/60"
          />
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              className="flex-1"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setSaving(false); setDraftName(""); setError(null); }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="dashed" onClick={() => setSaving(true)}>
          + Save current colors as palette
        </Button>
      )}
    </div>
  );
}

function ColorDots({ colors }: { colors: string[] }) {
  const visible = colors.slice(0, 5);
  return (
    <div className="flex flex-shrink-0 -space-x-1">
      {visible.map((c, i) => (
        <span
          key={i}
          className="h-3.5 w-3.5 rounded-full border border-black/10 ring-1 ring-surface"
          style={{ background: c, zIndex: visible.length - i }}
        />
      ))}
    </div>
  );
}
