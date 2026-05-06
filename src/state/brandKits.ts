const STORAGE_KEY = "loop-bg-brand-kits";

export interface BrandKit {
  id: string;
  name: string;
  /** Flat ordered list of hex colors captured from the preset's color slots. */
  colors: string[];
  createdAt: number;
}

export function loadKits(): BrandKit[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBrandKit);
  } catch {
    return [];
  }
}

export class BrandKitQuotaError extends Error {
  constructor(message = "Browser storage is full — delete a kit to free space") {
    super(message);
    this.name = "BrandKitQuotaError";
  }
}

export function saveKits(kits: BrandKit[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kits));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      throw new BrandKitQuotaError();
    }
    throw e;
  }
}

export function newKitId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isBrandKit(v: unknown): v is BrandKit {
  if (!v || typeof v !== "object") return false;
  const k = v as Record<string, unknown>;
  return (
    typeof k.id === "string" &&
    typeof k.name === "string" &&
    Array.isArray(k.colors) &&
    typeof k.createdAt === "number"
  );
}
