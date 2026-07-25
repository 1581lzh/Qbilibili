export type PlayMode = "loop" | "single" | "next";

export const MODES: { key: PlayMode; label: string }[] = [
  { key: "loop", label: "循环播放" },
  { key: "single", label: "单次播放" },
  { key: "next", label: "自动连播" },
];

function getStorageKey(userId?: string | null): string {
  return userId ? `playmode_${userId}` : "playmode_guest";
}

export function getSavedMode(userId?: string | null): PlayMode {
  if (typeof window === "undefined") return "loop";
  try {
    const key = getStorageKey(userId);
    const storage = userId ? localStorage : sessionStorage;
    const saved = storage.getItem(key);
    if (saved && MODES.some((m) => m.key === saved)) return saved as PlayMode;
  } catch {}
  return "loop";
}

function saveModeLocal(mode: PlayMode, userId?: string | null) {
  try {
    const key = getStorageKey(userId);
    const storage = userId ? localStorage : sessionStorage;
    storage.setItem(key, mode);
  } catch {}
}

export async function fetchPlayMode(userId?: string | null): Promise<PlayMode> {
  if (!userId) return getSavedMode(null);
  try {
    const res = await fetch("/api/user/play-mode");
    if (!res.ok) return getSavedMode(userId);
    const data = await res.json();
    if (data.playMode && MODES.some((m) => m.key === data.playMode)) {
      saveModeLocal(data.playMode as PlayMode, userId);
      return data.playMode as PlayMode;
    }
    return "loop";
  } catch {
    return getSavedMode(userId);
  }
}

export async function updatePlayMode(mode: PlayMode, userId?: string | null): Promise<void> {
  saveModeLocal(mode, userId);
  if (!userId) return;
  try {
    await fetch("/api/user/play-mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playMode: mode }),
    });
  } catch {}
}
