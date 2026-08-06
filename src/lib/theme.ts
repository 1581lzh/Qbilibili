export type Theme = "light" | "dark" | "system";

export const THEMES: Theme[] = ["light", "dark", "system"];

const STORAGE_KEY = "theme";

export function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && THEMES.includes(saved)) return saved;
  } catch {}
  return "system";
}

function saveThemeLocal(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

export async function fetchTheme(userId?: string | null): Promise<Theme> {
  if (!userId) return getSavedTheme();
  try {
    const res = await fetch("/api/user/theme");
    if (!res.ok) return getSavedTheme();
    const data = await res.json();
    if (data.theme && THEMES.includes(data.theme as Theme)) {
      saveThemeLocal(data.theme as Theme);
      return data.theme as Theme;
    }
    return "system";
  } catch {
    return getSavedTheme();
  }
}

export async function updateTheme(theme: Theme, userId?: string | null): Promise<void> {
  saveThemeLocal(theme);
  if (!userId) return;
  try {
    await fetch("/api/user/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
  } catch {}
}
