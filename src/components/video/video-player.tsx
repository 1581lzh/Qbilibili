"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Repeat, Play, SkipBack, SkipForward } from "lucide-react";
import { createRoot } from "react-dom/client";
import { toHttps } from "@/lib/image";

type PlayMode = "loop" | "single" | "next";

const MODES: { key: PlayMode; label: string; icon: typeof Repeat }[] = [
  { key: "loop", label: "循环播放", icon: Repeat },
  { key: "single", label: "单次播放", icon: Play },
  { key: "next", label: "自动连播", icon: SkipForward },
];

interface VideoInfo {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  videoUrl: string;
  vodVideoId?: string | null;
  author: { id: string; name: string };
  createdAt: Date | string;
}

function getSavedMode(userId?: string | null): PlayMode {
  if (typeof window === "undefined") return "loop";
  try {
    const key = userId ? `playmode_${userId}` : "playmode_guest";
    const storage = userId ? localStorage : sessionStorage;
    const saved = storage.getItem(key);
    if (saved && MODES.some((m) => m.key === saved)) return saved as PlayMode;
  } catch {}
  return "loop";
}

function saveMode(mode: PlayMode, userId?: string | null) {
  try {
    const key = userId ? `playmode_${userId}` : "playmode_guest";
    const storage = userId ? localStorage : sessionStorage;
    storage.setItem(key, mode);
  } catch {}
}

declare global {
  interface Window {
    Aliplayer: any;
    AliPlayerComponent: any;
  }
}

let aliplayerLoaded = false;

function loadAliplayer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if (window.Aliplayer && aliplayerLoaded) { resolve(); return; }

    const scripts = [
      { id: "aliplayer-sdk", src: "https://g.alicdn.com/apsara-media-box/imp-web-player/2.25.1/aliplayer-min.js" },
      { id: "aliplayer-components", src: "/lib/aliplayercomponents.min.js" },
    ];

    let loaded = 0;
    const total = scripts.length;
    const checkDone = () => { loaded++; if (loaded === total) { aliplayerLoaded = true; resolve(); } };

    if (!document.querySelector('link[href*="aliplayer-min.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://g.alicdn.com/apsara-media-box/imp-web-player/2.25.1/skins/default/aliplayer-min.css";
      document.head.appendChild(link);
    }

    scripts.forEach((s) => {
      if (document.getElementById(s.id)) { checkDone(); return; }
      const script = document.createElement("script");
      script.id = s.id;
      script.src = s.src;
      script.onload = checkDone;
      script.onerror = () => reject(new Error("Failed to load " + s.src));
      document.head.appendChild(script);
    });
  });
}

const STYLE_ID = "bilibili-player-inject";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    .playlist-component {
      display: inline-flex !important; align-items: center !important; vertical-align: middle;
    }
    .playlist-component .icon-skip-previous,
    .playlist-component .icon-skipnext {
      display: inline-flex !important; align-items: center; justify-content: center;
      width: 28px; height: 24px; cursor: pointer; opacity: 0.85; transition: opacity 0.2s;
      color: #ebecec;
    }
    .playlist-component .icon-skip-previous::before,
    .playlist-component .icon-skipnext::before {
      display: none !important;
    }
    .playlist-component .prism-play-btn {
      display: inline-flex !important; align-items: center; justify-content: center;
      width: 28px; height: 24px; margin: 0; vertical-align: middle;
      position: relative; top: -4px; left: -5px;
    }
    .playlist-component .icon-skip-previous:hover,
    .playlist-component .icon-skipnext:hover { opacity: 1; }
    .prism-big-play-btn { display: none !important; }
    .prism-player .prism-cover { display: none !important; }
    .prism-player .prism-animation { display: none !important; }
    .prism-player .prism-text-overlay { pointer-events: none !important; }
    @keyframes bili-elastic {
      0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
      30% { opacity: 0.9; }
      50% { transform: translate(-50%,-50%) scale(1.2); opacity: 1; }
      70% { transform: translate(-50%,-50%) scale(0.92); }
      85% { transform: translate(-50%,-50%) scale(1.06); }
      100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
    }
    .bili-anim {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) scale(0);
      width: min(18vw, 18vh); height: min(18vw, 18vh); border-radius: 50%;
      background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
      z-index: 9999; pointer-events: none; opacity: 0;
    }
    .bili-anim.go { animation: bili-elastic 0.7s ease-out forwards; }
    .bili-anim svg { width: 40%; height: 40%; fill: #fff; }
    .player-tooltip {
      display: none; position: absolute; bottom: 36px; left: 50%;
      transform: translateX(-50%); background: #3c3c3c; color: #ebecec;
      font-size: 12px; padding: 5px 8px; border-radius: 4px;
      white-space: nowrap; pointer-events: none; z-index: 10;
      box-shadow: 0 0 5px rgba(0,0,0,0.1); line-height: 1.4;
    }
    .player-tooltip.visible { display: block !important; }
    .prism-player .prism-tooltip {
      background: #3c3c3c !important; color: #ebecec !important;
      font-size: 12px !important; height: auto !important;
      line-height: 1.4 !important; padding: 5px 8px !important;
      border-radius: 4px !important; bottom: 60px !important;
      pointer-events: none !important; margin: 0 !important;
    }
  `;
  document.head.appendChild(s);
}

function showAnim(el: HTMLElement, type: "play" | "pause") {
  const old = el.querySelector(".bili-anim");
  if (old) old.remove();
  const d = document.createElement("div");
  d.className = "bili-anim";
  d.innerHTML = type === "pause"
    ? '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>';
  el.appendChild(d);
  void d.offsetWidth;
  d.classList.add("go");
  setTimeout(() => d.remove(), 800);
}

const PREV_SVG = '';
const NEXT_SVG = '';

function fixTooltipPosition(tooltip: HTMLElement) {
  tooltip.style.left = '0';
  tooltip.style.right = 'auto';
  tooltip.style.transform = 'none';
  tooltip.style.top = '';
  tooltip.style.bottom = '36px';
}

function fixAllPrismTooltips(containerEl: HTMLElement) {
  const tooltips = containerEl.querySelectorAll('.prism-tooltip') as NodeListOf<HTMLElement>;
  tooltips.forEach((t) => {
    t.style.fontSize = '12px';
    t.style.height = 'auto';
    t.style.lineHeight = '1.4';
    t.style.padding = '5px 8px';
    t.style.borderRadius = '4px';
    t.style.bottom = '60px';
    t.style.color = '#ebecec';
    t.style.pointerEvents = 'none';
    t.style.margin = '0';
  });
}

function bindNavTooltips(containerEl: HTMLElement) {
  const prevIcon = containerEl.querySelector('.icon-skip-previous');
  const nextIcon = containerEl.querySelector('.icon-skipnext');
  const prevTooltip = containerEl.querySelector('.player-tooltip.prev') as HTMLElement;
  const nextTooltip = containerEl.querySelector('.player-tooltip.next') as HTMLElement;

  if (prevIcon && prevTooltip) {
    prevIcon.addEventListener('mouseenter', () => { fixTooltipPosition(prevTooltip); prevTooltip.classList.add('visible'); });
    prevIcon.addEventListener('mouseleave', () => prevTooltip.classList.remove('visible'));
  }
  if (nextIcon && nextTooltip) {
    nextIcon.addEventListener('mouseenter', () => { fixTooltipPosition(nextTooltip); nextTooltip.classList.add('visible'); });
    nextIcon.addEventListener('mouseleave', () => nextTooltip.classList.remove('visible'));
  }
}

export default function VideoPlayer({
  initialVideo,
  initialNextVideoId,
  initialPrevVideoId,
  onVideoChange,
  userId,
}: {
  initialVideo: VideoInfo;
  initialNextVideoId?: string;
  initialPrevVideoId?: string;
  onVideoChange?: (video: VideoInfo & { nextVideoId?: string; prevVideoId?: string; likeCount?: number; favoriteCount?: number; liked?: boolean; favorited?: boolean }) => void;
  userId?: string | null;
}) {
  const aliPlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PlayMode>("loop");
  const [showTooltip, setShowTooltip] = useState(false);
  const modeRef = useRef<PlayMode>("loop");
  const nextVideoIdRef = useRef(initialNextVideoId);
  const prevVideoIdRef = useRef(initialPrevVideoId);
  const autoPlayRef = useRef(false);
  const onVideoChangeRef = useRef(onVideoChange);
  const userIdRef = useRef(userId);
  const currentVideoRef = useRef(initialVideo);

  nextVideoIdRef.current = initialNextVideoId;
  prevVideoIdRef.current = initialPrevVideoId;
  onVideoChangeRef.current = onVideoChange;
  userIdRef.current = userId;
  currentVideoRef.current = initialVideo;

  useEffect(() => { setMode(getSavedMode(userId)); }, [userId]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const navigateToNext = useCallback(async () => {
    if (!nextVideoIdRef.current) return;
    try {
      const res = await fetch(`/api/videos/${nextVideoIdRef.current}/detail`);
      if (!res.ok) return;
      const data = await res.json();
      window.history.replaceState(null, "", `/video/${data.id}`);
      onVideoChangeRef.current?.(data);
    } catch { window.location.href = `/video/${nextVideoIdRef.current}`; }
  }, []);

  const navigateToPrev = useCallback(async () => {
    if (!prevVideoIdRef.current) return;
    try {
      const res = await fetch(`/api/videos/${prevVideoIdRef.current}/detail`);
      if (!res.ok) return;
      const data = await res.json();
      window.history.replaceState(null, "", `/video/${data.id}`);
      onVideoChangeRef.current?.(data);
    } catch { window.location.href = `/video/${prevVideoIdRef.current}`; }
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); navigateToNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); navigateToPrev(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigateToNext, navigateToPrev]);

  useEffect(() => {
    let destroyed = false;
    let clickHandler: ((e: Event) => void) | null = null;
    let touchHandler: (() => void) | null = null;
    let cleanupContainer: HTMLElement | null = null;

    const initPlayer = async () => {
      try {
        await loadAliplayer();
        if (destroyed) return;
        ensureStyles();

        if (aliPlayerRef.current) { try { aliPlayerRef.current.dispose(); } catch {} }

        const cid = `aliplayer-${initialVideo.id}`;
        if (containerRef.current) { containerRef.current.innerHTML = ""; containerRef.current.id = cid; }
        await new Promise(r => setTimeout(r, 50));
        if (destroyed) return;

        const shouldAutoPlay = sessionStorage.getItem("autoPlayVideo") === initialVideo.id;
        if (shouldAutoPlay) sessionStorage.removeItem("autoPlayVideo");

        let playlist: { name: string; source: string }[] = [];
        try {
          const lr = await fetch("/api/videos?limit=50");
          if (lr.ok) { const vs = await lr.json(); playlist = vs.map((v: any) => ({ name: v.title, source: toHttps(v.videoUrl) })); }
        } catch {}

        const cfg: any = { id: cid, width: "100%", height: "100%", autoplay: shouldAutoPlay, preload: true, cover: initialVideo.coverUrl || "" };

        if (initialVideo.vodVideoId) {
          const res = await fetch("/api/vod", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "playAuth", videoId: initialVideo.vodVideoId }) });
          if (!res.ok) return;
          const { playAuth } = await res.json();
          cfg.vid = initialVideo.vodVideoId; cfg.playauth = playAuth;
        } else if (initialVideo.videoUrl) {
          cfg.source = toHttps(initialVideo.videoUrl);
        } else { return; }

        if (window.AliPlayerComponent?.PlaylistComponent && playlist.length > 0) {
          cfg.components = [{ name: "PlaylistComponent", type: window.AliPlayerComponent.PlaylistComponent, args: [playlist] }];
        }

        const player = new window.Aliplayer({ ...cfg, autoplay: shouldAutoPlay }, () => {});

        if (shouldAutoPlay || autoPlayRef.current) {
          player.on("ready", () => { try { player.play(); } catch {} });
        }
        autoPlayRef.current = false;

        player.on("ended", () => {
          if (modeRef.current === "loop") { player.seek(0); player.play(); }
          else if (modeRef.current === "next" && nextVideoIdRef.current) { autoPlayRef.current = true; navigateToNext(); }
        });

        let wasPlaying = false;
        player.on("play", () => { if (!wasPlaying) { wasPlaying = true; const el = document.getElementById(cid); if (el) showAnim(el, "play"); } });
        player.on("pause", () => { wasPlaying = false; const el = document.getElementById(cid); if (el) showAnim(el, "pause"); });

        const reorderControlbar = () => {
          const containerEl = document.getElementById(cid);
          if (!containerEl) return;
          const controlbar = containerEl.querySelector(".prism-controlbar");
          if (!controlbar) return;
          const playBtn = controlbar.querySelector(".prism-play-btn");
          const prevIcon = containerEl.querySelector(".icon-skip-previous") as HTMLElement;
          const nextIcon = containerEl.querySelector(".icon-skipnext") as HTMLElement;
          if (!playBtn || !prevIcon || !nextIcon) return;
          const navContainer = prevIcon.parentElement as HTMLElement;
          if (!navContainer) return;
          if (!prevIcon.querySelector("svg")) {
            createRoot(prevIcon).render(<SkipBack size={16} />);
            createRoot(nextIcon).render(<SkipForward size={16} />);
            prevIcon.classList.remove('iconfont');
            nextIcon.classList.remove('iconfont');
          }
          navContainer.querySelectorAll(".icon-list, .player-tooltip.list").forEach(el => el.remove());
          if (navContainer.contains(playBtn)) return;
          controlbar.insertBefore(navContainer, playBtn);
          navContainer.insertBefore(playBtn, nextIcon);
        };

        let tooltipBound = false;
        const tryBindTooltips = () => {
          if (tooltipBound) return;
          const containerEl = document.getElementById(cid);
          if (!containerEl) return;
          const prevIcon = containerEl.querySelector(".icon-skip-previous");
          if (!prevIcon) return;
          bindNavTooltips(containerEl);
          tooltipBound = true;
          reorderControlbar();
          fixAllPrismTooltips(containerEl);

          player.on("tooltipShow", () => {
            requestAnimationFrame(() => {
              const tooltips = containerEl.querySelectorAll(".prism-tooltip") as NodeListOf<HTMLElement>;
              tooltips.forEach((t) => {
                if (t.style.display === "block") {
                  t.style.left = "0";
                  t.style.bottom = "60px";
                  t.style.fontSize = "12px";
                  t.style.height = "auto";
                  t.style.lineHeight = "1.4";
                  t.style.padding = "5px 8px";
                  t.style.borderRadius = "4px";
                  t.style.color = "#ebecec";
                }
              });
            });
          });
        };

        player.on("ready", tryBindTooltips);
        setTimeout(tryBindTooltips, 500);
        setTimeout(tryBindTooltips, 1000);

        // Also set up click-to-toggle and mobile double-tap
        let lastTap = 0;

        const bindClickHandlers = () => {
          const containerEl = document.getElementById(cid);
          if (!containerEl || clickHandler) return;
          cleanupContainer = containerEl;

          clickHandler = (e: Event) => {
            const t = (e as MouseEvent).target as HTMLElement;
            if (!t.closest(".prism-controlbar") && !t.closest(".prism-setting-list") && !t.closest(".prism-setting-selector") && !t.closest(".bili-nav-btn")) {
              if (player.paused()) player.play(); else player.pause();
            }
          };
          containerEl.addEventListener("click", clickHandler);

          if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
            touchHandler = () => {
              const now = Date.now();
              if (now - lastTap < 300) { if (player.paused()) player.play(); else player.pause(); lastTap = 0; } else { lastTap = now; }
            };
            containerEl.addEventListener("touchend", touchHandler, { capture: true, passive: true });
          }
        };

        setTimeout(bindClickHandlers, 500);

        aliPlayerRef.current = player;
      } catch (err) { console.error("Aliplayer init failed:", err); }
    };

    initPlayer();
    return () => {
      destroyed = true;
      if (cleanupContainer && clickHandler) cleanupContainer.removeEventListener("click", clickHandler);
      if (cleanupContainer && touchHandler) cleanupContainer.removeEventListener("touchend", touchHandler as EventListener);
      if (aliPlayerRef.current) { try { aliPlayerRef.current.dispose(); } catch {} aliPlayerRef.current = null; }
    };
  }, [initialVideo.id, initialVideo.vodVideoId, initialVideo.videoUrl]);

  const cycleMode = () => { setMode((p) => { const i = MODES.findIndex((m) => m.key === p); const n = MODES[(i + 1) % MODES.length].key; saveMode(n, userIdRef.current); return n; }); };
  const current = MODES.find((m) => m.key === mode)!;
  const Icon = current.icon;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute top-3 right-3 z-10">
        <button onClick={cycleMode} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80" title={current.label}>
          <Icon size={16} />
        </button>
        {showTooltip && <div className="absolute bottom-10 right-0 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs text-white">{current.label}</div>}
      </div>
    </div>
  );
}
