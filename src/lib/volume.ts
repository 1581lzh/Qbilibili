export interface VolumeState {
  volume: number;
  muted: boolean;
}

export const DEFAULT_VOLUME_STATE: VolumeState = { volume: 1, muted: false };

function getStorageKey(userId?: string | null): string {
  return userId ? `volume_${userId}` : "volume_guest";
}

function parseState(raw: string | null | undefined): VolumeState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const volume = typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 1 ? parsed.volume : 1;
      const muted = typeof parsed.muted === "boolean" ? parsed.muted : false;
      return { volume, muted };
    }
  } catch {}
  return null;
}

export function getSavedVolume(userId?: string | null): VolumeState {
  if (typeof window === "undefined") return DEFAULT_VOLUME_STATE;
  try {
    const key = getStorageKey(userId);
    const storage = userId ? localStorage : sessionStorage;
    const saved = parseState(storage.getItem(key));
    if (saved) return saved;
  } catch {}
  return DEFAULT_VOLUME_STATE;
}

function saveVolumeLocal(state: VolumeState, userId?: string | null) {
  try {
    const key = getStorageKey(userId);
    const storage = userId ? localStorage : sessionStorage;
    storage.setItem(key, JSON.stringify(state));
  } catch {}
}

export async function fetchVolume(userId?: string | null): Promise<VolumeState> {
  if (!userId) return getSavedVolume(null);
  try {
    const res = await fetch("/api/user/volume");
    if (!res.ok) return getSavedVolume(userId);
    const data = await res.json();
    if (typeof data === "object" && data !== null) {
      const volume = typeof data.volume === "number" && data.volume >= 0 && data.volume <= 1 ? data.volume : 1;
      const muted = typeof data.muted === "boolean" ? data.muted : false;
      const state: VolumeState = { volume, muted };
      saveVolumeLocal(state, userId);
      return state;
    }
    return DEFAULT_VOLUME_STATE;
  } catch {
    return getSavedVolume(userId);
  }
}

export async function updateVolume(state: VolumeState, userId?: string | null): Promise<void> {
  saveVolumeLocal(state, userId);
  if (!userId) return;
  try {
    await fetch("/api/user/volume", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {}
}
