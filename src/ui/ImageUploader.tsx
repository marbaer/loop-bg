import { useRef } from "react";
import { useStore } from "../state/store";

export function ImageUploader() {
  const uploadedImage = useStore((s) => s.uploadedImage);
  const setUploadedImage = useStore((s) => s.setUploadedImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setUploadedImage(result);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file && file.type.startsWith("image/")) onFile(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-overlay-1 transition hover:border-border-strong hover:bg-overlay-2"
        style={{ aspectRatio: "16/9" }}
      >
        {uploadedImage ? (
          // checkered preview so transparent logos read clearly
          <div
            className="h-full w-full bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${uploadedImage}), linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)`,
              backgroundSize: "contain, 12px 12px, 12px 12px, 12px 12px, 12px 12px",
              backgroundPosition: "center, 0 0, 0 6px, 6px -6px, -6px 0",
              backgroundColor: "#181820",
            }}
          />
        ) : (
          <div className="text-center text-text-subtle">
            <div className="mb-1 text-sm font-medium text-text">Upload logo</div>
            <div className="text-xs">PNG / SVG / JPG · click or drop</div>
          </div>
        )}
      </div>
      {uploadedImage && (
        <button
          onClick={() => setUploadedImage(null)}
          className="w-full rounded-sm border border-border bg-overlay-1 px-2 py-1 text-xs uppercase tracking-wider text-text-muted hover:border-border-strong hover:text-text"
        >
          Remove image
        </button>
      )}
    </div>
  );
}
