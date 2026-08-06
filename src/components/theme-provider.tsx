"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { type Theme, fetchTheme, updateTheme, getSavedTheme } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
}>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // 初始主题：先读 localStorage（保持即时渲染，与防白闪脚本一致），
  // 登录用户再异步从数据库恢复（跨设备/刷新同步，覆盖本地值）
  useEffect(() => {
    setThemeState(getSavedTheme());
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTheme(userId).then((t) => {
      if (!cancelled) setThemeState(t);
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const r = theme === "system" ? getSystemTheme() : theme;
    setResolved(r);
    document.documentElement.classList.toggle("dark", r === "dark");
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = mq.matches ? "dark" : "light";
      document.documentElement.classList.add("dark-transition");
      setResolved(r);
      document.documentElement.classList.toggle("dark", r === "dark");
      setTimeout(() => {
        document.documentElement.classList.remove("dark-transition");
      }, 350);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    document.documentElement.classList.add("dark-transition");
    setThemeState(t);
    updateTheme(t, userId);
    setTimeout(() => {
      document.documentElement.classList.remove("dark-transition");
    }, 350);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}
