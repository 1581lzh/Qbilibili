"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { type Theme, fetchTheme, updateTheme, getSavedTheme } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme, origin?: { x: number; y: number }) => void;
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

// 圆形遮罩扩散速度（px/s，恒定），按钮到最远角距离 ÷ 速度 = 覆盖耗时
const REVEAL_SPEED = 2200;

interface Reveal {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  target: "light" | "dark";
  currentR: number;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [reveals, setReveals] = useState<Reveal[]>([]);

  // 遮罩动画期间延迟切换 .dark：class 保持旧值，圆扩散完才切换，避免圆外区域提前变色
  const deferClassRef = useRef(false);
  const revealsRef = useRef<Reveal[]>([]);
  const revealNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const rafRef = useRef(0);
  const lastTRef = useRef(0);
  const idRef = useRef(0);

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
    // 遮罩动画进行中：class 由动画完成回调切换（保持旧值让圆外区域仍是旧主题）
    if (deferClassRef.current) return;
    document.documentElement.classList.toggle("dark", r === "dark");
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      if (!deferClassRef.current) {
        document.documentElement.classList.toggle("dark", r === "dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // 圆形遮罩 rAF 循环：所有圆以恒定速度扩散，最上层圆扩散完成后切换 class 并清理
  useEffect(() => {
    if (reveals.length === 0) return;
    lastTRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTRef.current) / 1000);
      lastTRef.current = now;
      const list = revealsRef.current;
      let topDone = false;
      for (const r of list) {
        r.currentR = Math.min(r.radius, r.currentR + REVEAL_SPEED * dt);
        const node = revealNodesRef.current.get(r.id);
        if (node) {
          node.style.transform = `translate(-50%, -50%) scale(${r.currentR / r.radius})`;
        }
      }
      if (list.length > 0 && list[list.length - 1].currentR >= list[list.length - 1].radius) {
        topDone = true;
      }
      if (topDone) {
        const topTarget = list[list.length - 1].target;
        deferClassRef.current = false;
        // 背景（圆）已扩散完成 → 切换 .dark，并给文字/UI 颜色短暂渐变过渡；
        // 圆继续保持 400ms（与文字渐变同长），期间盖住 body 背景的切换过程，
        // 避免 .dark 切换瞬间露出「白/黑闪一下」。文字只按最上层圆（最后一次）渐变一次。
        document.documentElement.classList.add("theme-text-fade");
        document.documentElement.classList.toggle("dark", topTarget === "dark");
        window.setTimeout(() => {
          document.documentElement.classList.remove("theme-text-fade");
          revealsRef.current = [];
          setReveals([]);
        }, 400);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reveals]);

  // 组件卸载清理
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const setTheme = (t: Theme, origin?: { x: number; y: number }) => {
    updateTheme(t, userId);
    setThemeState(t);
    if (origin && typeof window !== "undefined") {
      deferClassRef.current = true;
      const target: "light" | "dark" = t === "system" ? getSystemTheme() : t;
      // 圆只承担「背景层」的颜色：浅色 #ffffff / 深色 zinc-950 (#09090b)，与 body 背景一致，
      // 扩散完成后切换 .dark 再移除圆，视觉无缝。
      const color = target === "dark" ? "#09090b" : "#ffffff";
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dx = Math.max(origin.x, W - origin.x);
      const dy = Math.max(origin.y, H - origin.y);
      const radius = Math.sqrt(dx * dx + dy * dy);
      const reveal: Reveal = {
        id: ++idRef.current,
        x: origin.x,
        y: origin.y,
        radius,
        color,
        target,
        currentR: 0,
      };
      revealsRef.current = [...revealsRef.current, reveal];
      setReveals(revealsRef.current);
    } else {
      // 无点击位置（如外部调用）：直接切换，无动画
      deferClassRef.current = false;
      const r = t === "system" ? getSystemTheme() : t;
      document.documentElement.classList.toggle("dark", r === "dark");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
      {reveals.map((r) => (
        <div
          key={r.id}
          ref={(node) => {
            if (node) revealNodesRef.current.set(r.id, node);
            else revealNodesRef.current.delete(r.id);
          }}
          className="pointer-events-none fixed rounded-full"
          style={{
            left: r.x,
            top: r.y,
            width: r.radius * 2,
            height: r.radius * 2,
            background: r.color,
            transform: `translate(-50%, -50%) scale(${r.currentR / r.radius})`,
            willChange: "transform",
            // 圆放在背景层（z-index:-1）：只覆盖 body 背景所在的空白/骨架区域，
            // 卡片、按钮、视频、文字等有自己的背景/内容层，不会被圆遮挡
            zIndex: -1,
          }}
        />
      ))}
    </ThemeContext.Provider>
  );
}
