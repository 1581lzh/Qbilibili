"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Repeat, Play, SkipBack, SkipForward } from "lucide-react";
import { createRoot } from "react-dom/client";
import { toHttps, optimizedCover } from "@/lib/image";
import { cachedFetch } from "@/lib/fetch-cache";
import { consumeAutoPlayVideo } from "@/lib/signals";
import { getVodPlayAuth } from "@/lib/vod-cache";
import { type PlayMode, MODES, fetchPlayMode, updatePlayMode } from "@/lib/play-mode";
import { type VolumeState, fetchVolume, updateVolume, getSavedVolume } from "@/lib/volume";
import { isEditableTarget, isComposingEvent } from "@/lib/keyboard";

const VIDEO_MODES: { key: PlayMode; label: string; icon: typeof Repeat }[] = [
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
  audioNormalized?: boolean;
  normalizedUrl?: string | null;
  author: { id: string; name: string };
  createdAt: Date | string;
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
    .prism-player .bili-blur-bg {
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important;
      object-fit: cover !important;
      transform: scale(1.15);
      filter: blur(72px) brightness(0.9) saturate(1.15);
      opacity: 1;
      z-index: 0 !important;
      pointer-events: none !important;
      animation: bili-bg-fade 0.4s ease-out forwards;
    }
    @keyframes bili-bg-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    /* 背景必须垫底：视频（Aliplayer 为 absolute）DOM 在背景之后天然覆盖其上，
       控件层强制提升到背景之上，确保点击控件不触发背景层的任何事件。 */
    .prism-player .prism-controlbar,
    .prism-player .playlist-component,
    .prism-player .prism-big-play-btn {
      z-index: 2 !important;
    }
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
  const autoPlayRef = useRef(false);
  const onVideoChangeRef = useRef(onVideoChange);
  const userIdRef = useRef(userId);
  const currentVideoRef = useRef(initialVideo);

  nextVideoIdRef.current = initialNextVideoId;
  onVideoChangeRef.current = onVideoChange;
  userIdRef.current = userId;
  currentVideoRef.current = initialVideo;

  useEffect(() => { fetchPlayMode(userId).then(setMode); }, [userId]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ---- 与图文播放器共享音量状态（DB 持久化，双向同步）----
  const lastVolumeStateRef = useRef<VolumeState>(getSavedVolume(userId));

  const applyVolumeToPlayer = useCallback((player: any, state: VolumeState) => {
    if (!player) return;
    lastVolumeStateRef.current = state;
    try {
      if (typeof player.setVolume === "function") {
        player.setVolume(Math.max(0, Math.min(1, state.volume)));
      }
      const tag = player.tag;
      if (tag && "muted" in tag) tag.muted = !!state.muted;
    } catch {}
  }, []);

  const syncVolumeFromPlayer = useCallback((player: any) => {
    if (!player) return;
    let vol = 1;
    let muted = false;
    try {
      const v = typeof player.getVolume === "function" ? player.getVolume() : undefined;
      if (typeof v === "number" && isFinite(v)) vol = Math.max(0, Math.min(1, v));
      muted = !!(player.tag && player.tag.muted);
    } catch {}
    const prev = lastVolumeStateRef.current;
    // 静音时保留此前音量（Aliplayer 静音会把音量清零，避免覆盖掉用户设定的音量）
    const next: VolumeState = { volume: muted ? prev.volume : vol, muted };
    if (next.volume !== prev.volume || next.muted !== prev.muted) {
      lastVolumeStateRef.current = next;
      updateVolume(next, userIdRef.current);
    }
  }, []);

  // 用户信息就绪/变化时，重新应用共享音量到播放器
  useEffect(() => {
    if (aliPlayerRef.current) {
      fetchVolume(userId).then((s) => { if (aliPlayerRef.current) applyVolumeToPlayer(aliPlayerRef.current, s); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

  const seekBy = useCallback((delta: number) => {
    const player = aliPlayerRef.current;
    if (!player) return;
    try {
      const duration = typeof player.getDuration === "function" ? (player.getDuration() || 0) : 0;
      const current = typeof player.currentTime === "function" ? (player.currentTime() || 0) : 0;
      const target = Math.max(0, duration > 0 ? Math.min(current + delta, duration) : current + delta);
      player.seek(target);
    } catch {}
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (isEditableTarget(e) || isComposingEvent(e)) return;
      const key = e.key.toLowerCase();
      if (key === "arrowright" || key === "d") { e.preventDefault(); seekBy(5); }
      else if (key === "arrowleft" || key === "a") { e.preventDefault(); seekBy(-5); }
      else if (e.key === " ") {
        e.preventDefault();
        const player = aliPlayerRef.current;
        if (player) {
          if (player.paused()) player.play();
          else player.pause();
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [seekBy]);

  useEffect(() => {
    let destroyed = false;
    let clickHandler: ((e: Event) => void) | null = null;
    let touchHandler: ((e: Event) => void) | null = null;
    let cleanupContainer: HTMLElement | null = null;
    let blurInterval: ReturnType<typeof setInterval> | null = null;
    let blurResizeHandler: (() => void) | null = null;

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

        const shouldAutoPlay = consumeAutoPlayVideo() === initialVideo.id;

        let playlist: { name: string; source: string }[] = [];
        try {
          const vs = await cachedFetch("/api/videos?limit=20", 300000) as any[];
          playlist = vs.map((v) => ({
            name: v.title,
            source: toHttps(v.audioNormalized && v.normalizedUrl ? v.normalizedUrl : v.videoUrl),
          }));
        } catch {}

        const cfg: any = { id: cid, width: "100%", height: "100%", autoplay: shouldAutoPlay, preload: true, cover: optimizedCover(initialVideo.coverUrl, 1280) || "" };

        // Use normalized URL if available, otherwise use original
        const effectiveVideoUrl = initialVideo.audioNormalized && initialVideo.normalizedUrl
          ? initialVideo.normalizedUrl
          : initialVideo.videoUrl;

        if (effectiveVideoUrl) {
          // Prefer normalized URL (or OSS direct link) over VOD auth playback
          cfg.source = toHttps(effectiveVideoUrl);
        } else if (initialVideo.vodVideoId) {
          const playAuth = await getVodPlayAuth(initialVideo.vodVideoId);
          if (!playAuth) return;

          cfg.vid = initialVideo.vodVideoId;
          cfg.playauth = playAuth;
        } else { return; }

        if (window.AliPlayerComponent?.PlaylistComponent && playlist.length > 0) {
          cfg.components = [{ name: "PlaylistComponent", type: window.AliPlayerComponent.PlaylistComponent, args: [playlist] }];
        }

        // 用缓存的音量状态（localStorage）初始化播放器，避免播放瞬间先以 100% 音量出声
        const savedVolumeState = getSavedVolume(userIdRef.current);
        if (savedVolumeState.volume !== 1) cfg.volume = savedVolumeState.volume;

        const player = new window.Aliplayer({ ...cfg, autoplay: shouldAutoPlay }, () => {});

        // 立即应用缓存的音量/静音状态（不等待网络请求），随后再用服务器状态校准
        applyVolumeToPlayer(player, savedVolumeState);

        // 应用共享音量状态（与图文播放器同步），并监听音量变化写回数据库
        ["volumechange", "volumnchanged"].forEach((evt) => player.on(evt, () => syncVolumeFromPlayer(player)));
        fetchVolume(userIdRef.current).then((s) => { if (!destroyed && aliPlayerRef.current === player) applyVolumeToPlayer(player, s); });

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

          // 白名单：只有直接点击 <video> 元素才切换播放/暂停，点击任何控件都不触发
          clickHandler = (e: Event) => {
            if (e.target === player.tag) {
              if (player.paused()) player.play(); else player.pause();
            }
          };
          containerEl.addEventListener("click", clickHandler);

          if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
            containerEl.addEventListener("touchstart", (e: Event) => {
              // 在 <video> 上触摸时阻止浏览器合成 click，避免与 touchend 双击逻辑冲突
              if ((e as TouchEvent).target === player.tag) {
                e.preventDefault();
              }
            }, { capture: true, passive: false });

            touchHandler = (e: Event) => {
              // 白名单：只有触摸目标是 <video> 元素才处理双击
              if ((e as TouchEvent).target !== player.tag) return;
              const now = Date.now();
              if (now - lastTap < 300) { if (player.paused()) player.play(); else player.pause(); lastTap = 0; } else { lastTap = now; }
            };
            containerEl.addEventListener("touchend", touchHandler, { capture: true, passive: true });
          }
        };

        setTimeout(bindClickHandlers, 500);

        // 高斯模糊背景填充黑边：使用视频封面图（不会随内容变化）。
        // 判断逻辑：比较「视频实际比例」与「容器实际比例」，差异超过阈值（存在黑边）才显示。
        // 该方式自动适配移动端竖屏全屏、PC 端横屏等任意容器比例，不依赖固定值。
        const coverUrl = optimizedCover(initialVideo.coverUrl, 1280);
        const setupBlurBackground = () => {
          const containerEl = document.getElementById(cid);
          if (!containerEl || !coverUrl) return;

          // 封面图比例（视频元数据未就绪前的兜底）
          let coverAspect: number | null = null;
          const coverProbe = new window.Image();
          coverProbe.onload = () => {
            if (coverProbe.naturalWidth > 0 && coverProbe.naturalHeight > 0) {
              coverAspect = coverProbe.naturalWidth / coverProbe.naturalHeight;
              check();
            }
          };
          coverProbe.src = coverUrl;

          // 优先用视频真实比例，未就绪时回退到封面比例
          const getMediaAspect = () => {
            const videoEl = containerEl.querySelector("video") as HTMLVideoElement | null;
            if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
              return videoEl.videoWidth / videoEl.videoHeight;
            }
            return coverAspect;
          };

          const check = () => {
            const cw = containerEl.clientWidth;
            const ch = containerEl.clientHeight;
            if (cw <= 0 || ch <= 0) return;
            const containerAspect = cw / ch;
            const mediaAspect = getMediaAspect();
            if (!mediaAspect || mediaAspect <= 0) return;
            const diff = Math.abs(mediaAspect - containerAspect) / Math.max(mediaAspect, containerAspect);
            const needsBg = diff > 0.05;

            let bg = containerEl.querySelector(".bili-blur-bg") as HTMLImageElement | null;
            if (needsBg) {
              if (!bg) {
                // 插入到播放器根内部（.prism-player 或容器自身）的第一个子元素位置，
                // 并内联强制 pointer-events:none 确保绝不拦截控件点击。
                const playerRoot = containerEl.querySelector(".prism-player") || containerEl;
                bg = document.createElement("img");
                bg.className = "bili-blur-bg";
                bg.alt = "";
                bg.loading = "lazy";
                bg.decoding = "async";
                bg.src = coverUrl;
                bg.style.pointerEvents = "none";
                bg.style.position = "absolute";
                bg.style.zIndex = "0";
                bg.style.inset = "0";
                bg.style.width = "100%";
                bg.style.height = "100%";
                bg.style.objectFit = "cover";
                bg.style.transform = "scale(1.15)";
                playerRoot.insertBefore(bg, playerRoot.firstChild);
              }
            } else if (bg) {
              bg.remove();
            }
          };
          check();
          blurInterval = setInterval(check, 500);
          blurResizeHandler = () => check();
          window.addEventListener("resize", blurResizeHandler);
        };
        setTimeout(setupBlurBackground, 800);

        aliPlayerRef.current = player;
      } catch (err) { console.error("Aliplayer init failed:", err); }
    };

    initPlayer();
    return () => {
      destroyed = true;
      if (blurInterval) clearInterval(blurInterval);
      if (blurResizeHandler) window.removeEventListener("resize", blurResizeHandler);
      if (cleanupContainer && clickHandler) cleanupContainer.removeEventListener("click", clickHandler);
      if (cleanupContainer && touchHandler) cleanupContainer.removeEventListener("touchend", touchHandler as EventListener);
      if (aliPlayerRef.current) { try { aliPlayerRef.current.dispose(); } catch {} aliPlayerRef.current = null; }
    };
  }, [initialVideo.id, initialVideo.vodVideoId, initialVideo.videoUrl]);

  const cycleMode = () => { setMode((p) => { const i = VIDEO_MODES.findIndex((m) => m.key === p); const n = VIDEO_MODES[(i + 1) % VIDEO_MODES.length].key; updatePlayMode(n, userIdRef.current); return n; }); };
  const current = VIDEO_MODES.find((m) => m.key === mode)!;
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
