"use client";

import { useState, useRef, useEffect, useCallback, useReducer, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import VideoPlayer from "@/components/video/video-player";
import VideoLikeButton from "@/components/video/video-like-button";
import VideoFavoriteButton from "@/components/video/video-favorite-button";
import VideoDeleteButton from "@/components/video/video-delete-button";
import { Pencil, Repeat, Play, SkipForward, Volume2, Volume1, VolumeX } from "lucide-react";
import { type PlayMode, MODES, fetchPlayMode, updatePlayMode } from "@/lib/play-mode";
import { fetchVolume, updateVolume, getSavedVolume } from "@/lib/volume";
import { toHttps } from "@/lib/image";
import { isEditableTarget, isComposingEvent } from "@/lib/keyboard";
import { avatarColorFor } from "@/lib/avatar";

interface VideoInfo {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  videoUrl: string;
  vodVideoId?: string | null;
  audioNormalized?: boolean;
  normalizedUrl?: string | null;
  postType?: string;
  imageUrls?: string | null;
  livePhotoVideos?: string | null;
  musicUrl?: string | null;
  musicUrls?: string | null;
  imageDuration?: number | null;
  author: { id: string; name: string };
  createdAt: Date | string;
  nextVideoId?: string | null;
  prevVideoId?: string | null;
}

interface VideoState {
  video: VideoInfo;
  videoId: string;
  nextVideoId: string | undefined;
  prevVideoId: string | undefined;
  likeCount: number;
  liked: boolean;
  favoriteCount: number;
  favorited: boolean;
}

type VideoAction =
  | { type: "NAVIGATE"; video: VideoInfo & { nextVideoId?: string; prevVideoId?: string; likeCount?: number; liked?: boolean; favoriteCount?: number; favorited?: boolean } }
  | { type: "LIKE"; count: number; liked: boolean }
  | { type: "FAVORITE"; count: number; favorited: boolean };

function videoReducer(state: VideoState, action: VideoAction): VideoState {
  switch (action.type) {
    case "NAVIGATE":
      return {
        ...state,
        video: action.video,
        videoId: action.video.id,
        nextVideoId: action.video.nextVideoId,
        prevVideoId: action.video.prevVideoId,
        likeCount: action.video.likeCount ?? state.likeCount,
        liked: action.video.liked ?? state.liked,
        favoriteCount: action.video.favoriteCount ?? state.favoriteCount,
        favorited: action.video.favorited ?? state.favorited,
      };
    case "LIKE":
      return { ...state, likeCount: action.count, liked: action.liked };
    case "FAVORITE":
      return { ...state, favoriteCount: action.count, favorited: action.favorited };
  }
}

// Image carousel for image_text posts

// 实况照片过渡：先预览 1s 封面帧 → 封面淡出/实况淡入交叉过渡 → 实况完整播放
// → 实况淡出/封面淡入交叉过渡 → 封面再预览 1s → 继续轮播下一张
const LIVE_PREVIEW_MS = 1000; // 封面帧预览时长
const LIVE_FADE_MS = 0.8; // 封面/实况交叉淡化时长

function ImageCarousel({ imageUrls, livePhotoVideos, musicUrls, imageDuration, playMode, userId, onNext }: { imageUrls: string[]; livePhotoVideos?: string[] | null; musicUrls?: string[] | null; imageDuration?: number | null; playMode: PlayMode; userId?: string | null; onNext?: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); // Start playing by default
  const [totalAudioDuration, setTotalAudioDuration] = useState(0);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false); // Track if user manually switched
  const [showIndicator, setShowIndicator] = useState<"play" | "pause" | null>(null);
  const [progress, setProgress] = useState(0); // 0-100 progress for current image
  const [mode, setMode] = useState<PlayMode>(playMode);
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { fetchPlayMode(userId).then(setMode); }, [userId]);
  useEffect(() => { fetchVolume(userId).then(s => { setVolume(s.volume); setMuted(s.muted); }); }, [userId]);
  const [volume, setVolume] = useState(() => getSavedVolume(userId).volume);
  const [muted, setMuted] = useState(() => getSavedVolume(userId).muted);
  const [showVolume, setShowVolume] = useState(false);
  const [showModeTooltip, setShowModeTooltip] = useState(false);
  const [showControls, setShowControls] = useState(() => {
    // Mobile: show controls for 3 seconds on mount
    if (typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      return true;
    }
    return false;
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const livePhotoVideoRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const indicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const progressRafRef = useRef<number>(0);
  const elapsedRef = useRef(0); // accumulated elapsed ms (survives index changes)
  const lastTickRef = useRef(0); // last RAF timestamp
  const modeRef = useRef<PlayMode>(playMode);

  // ---- 相册式横向轨道：当前页 + 前后相邻页（循环）并排排布，拖动/滑动切换 ----
  // 轨道总宽 = 3×容器宽，居中显示 current 页（translateX = -W + dragX）。
  // 鼠标按住拖动实时跟手（dragX），松手后按位移滑动到相邻页或回弹。
  const [dragX, setDragX] = useState(0);
  const [transitioning, setTransitioning] = useState(false); // 滑动到位动画中
  const [dragActive, setDragActive] = useState(false); // 鼠标按住拖动中（用于隐藏实况 canvas，避免遮挡相邻页）
  const dragXRef = useRef(0);
  const isDraggingRef = useRef(false);      // 鼠标左键是否按住拖动中
  const dragMovedRef = useRef(false);       // 本次按下是否发生了拖拽（用于区分点击）
  const dragStartXRef = useRef(0);
  const dragBaseXRef = useRef(0);
  const isSlidingRef = useRef(false);       // 滑动动画进行中，防止重复触发
  const containerWidthRef = useRef(0);
  const prevIndexRef = useRef(0);
  const nextIndexRef = useRef(0);
  useEffect(() => { prevIndexRef.current = (currentIndex - 1 + images.length) % images.length; });
  useEffect(() => { nextIndexRef.current = (currentIndex + 1) % images.length; });

  useEffect(() => { modeRef.current = mode; }, [mode]);
  const stoppedBySingleModeRef = useRef(false);

  // 图片比例按索引缓存（轨道相邻页的模糊背景与主图随页面一起平移）
  const imageRatioRefs = useRef<(number | null)[]>([]);
  const [, setRatioTick] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 容器尺寸变化时强制重渲染，保证轨道布局与图片正常显示
    const ro = new ResizeObserver(() => setRatioTick((n) => n + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Parse musicUrls（统一转 HTTPS，避免 HTTPS 页面加载 HTTP 资源被 Mixed Content 拦截）
  const audioUrls = useMemo(() => {
    if (musicUrls && musicUrls.length > 0) return musicUrls.map(toHttps);
    return [];
  }, [musicUrls]);
  audioUrlsRef.current = audioUrls;

  const images = imageUrls.filter(url => url).map(toHttps);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  // livePhotoVideos is paired 1:1 with imageUrls (same index). Filter to match images indices.
  const liveVideos = useMemo(() => {
    if (!livePhotoVideos || !Array.isArray(livePhotoVideos)) return [];
    return images.map((_, i) => (livePhotoVideos[i] ? toHttps(livePhotoVideos[i]) : ""));
  }, [livePhotoVideos, images]);
  const liveVideosRef = useRef(liveVideos);
  liveVideosRef.current = liveVideos;
  const currentLiveVideo = liveVideos[currentIndex] || "";
  // Track each live photo video's duration (seconds) to balance auto-mode preview times
  const liveDurationsRef = useRef<number[]>([]);
  const [, setLiveDurationsTick] = useState(0);

  // ---- 预加载窗口：预览第 currentIndex 张时，提前加载前后各 2 张（共 4 张）的图片
  //      与实况视频数据。图片与模糊背景是同一 URL，一次加载即可同时就绪；
  //      实况视频只预加载数据（隐藏 video 元素缓冲）、不播放，非预览状态始终显示封面，
  //      确保用户切到该实况时视频已就绪、可立即淡入播放，不会出现"切过来才开始加载"。
  const PREFETCH_RANGE = 2;
  const prefetchImagesRef = useRef<Set<string>>(new Set());
  const prefetchVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  useEffect(() => {
    if (images.length <= 1) return;
    const idxs: number[] = [];
    for (let off = -PREFETCH_RANGE; off <= PREFETCH_RANGE; off++) {
      if (off === 0) continue;
      idxs.push((currentIndex + off + images.length) % images.length);
    }
    // 图片预加载（主图 + 模糊背景同一 URL）
    for (const idx of idxs) {
      const url = images[idx];
      if (!url || prefetchImagesRef.current.has(url)) continue;
      prefetchImagesRef.current.add(url);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
    // 实况视频数据预加载（隐藏 video，仅缓冲、不播放）
    for (const idx of idxs) {
      const liveUrl = liveVideos[idx] || "";
      if (!liveUrl || prefetchVideosRef.current.has(liveUrl)) continue;
      const v = document.createElement("video");
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
      v.src = liveUrl;
      document.body.appendChild(v);
      prefetchVideosRef.current.set(liveUrl, v);
    }
  }, [currentIndex, images.length]);

  // 组件卸载时清理预加载的隐藏 video 元素
  useEffect(() => {
    return () => {
      prefetchVideosRef.current.forEach((v) => v.remove());
      prefetchVideosRef.current.clear();
      prefetchImagesRef.current.clear();
    };
  }, []);

  // 实况照片阶段机：static-preview → live-fade-in（视频淡入并播放）→ live-fade-out → static-preview
  // 仅当前图片是实况且正在播放时参与。静止图片不受影响。
  // livePhase 用 useState 驱动渲染（视频/封面透明度），机器逻辑由下方 effect 的链式定时器推进。
  const [livePhase, setLivePhase] = useState<"static-preview" | "live-fade-in" | "live-fade-out">("static-preview");
  const liveTimersRef = useRef<{ fade: NodeJS.Timeout | null; preview: NodeJS.Timeout | null; reveal: NodeJS.Timeout | null }>({ fade: null, preview: null, reveal: null });
  // 实况重播信号：当 advanceImage 要「回到当前实况图」（单图 loop）时递增，
  // 使阶段机 effect 重新运行，实现实况的循环重播。currentIndex 不变时 React 不会重渲染。
  const [liveRestartTick, setLiveRestartTick] = useState(0);
  const livePhaseTickRef = useRef(0); // 每次阶段切换递增，定时器/视频回调用它判断是否仍然有效

  // 交叉淡化控制：fade-in/out 时视频和封面同时渲染，CSS animation/transition 同时开始。
  const [liveFadeVisible, setLiveFadeVisible] = useState(false);
  const liveFadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearLiveTimers = useCallback(() => {
    const t = liveTimersRef.current;
    if (t.fade) { clearTimeout(t.fade); t.fade = null; }
    if (t.preview) { clearTimeout(t.preview); t.preview = null; }
    if (t.reveal) { clearTimeout(t.reveal); t.reveal = null; }
  }, []);

  // 交叉淡化：fade-in 时挂载视频（display:none→渲染，CSS transition 0→1），
  // fade-out 后等 CSS 过渡完成再卸载（避免封面闪烁）。
  useEffect(() => {
    if (liveFadeTimerRef.current) { clearTimeout(liveFadeTimerRef.current); liveFadeTimerRef.current = null; }

    if (livePhase === "live-fade-out") {
      // fade-out：延迟卸载视频（等 CSS opacity 过渡 0.3s 完成后再从 DOM 移除）
      liveFadeTimerRef.current = setTimeout(() => {
        setLiveFadeVisible(false);
        liveFadeTimerRef.current = null;
      }, LIVE_FADE_MS * 1000 + 50);
    } else if (livePhase === "static-preview") {
      // static-preview：立即卸载（视频 opacity 此时已是 0）
      setLiveFadeVisible(false);
    }

    return () => {
      if (liveFadeTimerRef.current) { clearTimeout(liveFadeTimerRef.current); liveFadeTimerRef.current = null; }
    };
  }, [livePhase]);

  // 实况视频播放控制：当视频挂载且处于 live-fade-in 阶段时自动播放。
  // 用独立 effect 确保不依赖 phase machine effect 的定时器调度。
  // 暂停时不自动播放（恢复由阶段机的 liveFadeVisible 分支续播）。
  useEffect(() => {
    if (!currentLiveVideo || livePhase !== "live-fade-in" || !liveFadeVisible) return;
    if (!isPlaying) return;
    const v = livePhotoVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [currentLiveVideo, livePhase, liveFadeVisible, isPlaying]);

  // 手工切换图片时：重置实况阶段为封面帧预览，并清掉所有实况定时器
  useEffect(() => {
    if (userInteracted) {
      clearLiveTimers();
      livePhaseTickRef.current += 1;
      setLivePhase("static-preview");
    }
  }, [userInteracted, clearLiveTimers]);

  // Calculate interval:
  // - Live photo images: the video's full duration (video-first, complete playback)
  // - Auto mode (no manual duration): balance so static images share the remaining audio time
  //   (totalAudioDuration - Σ live video durations) / static image count
  const getInterval = useCallback(() => {
    const liveVideo = liveVideosRef.current[currentIndex] || "";
    if (liveVideo) {
      const v = livePhotoVideoRef.current;
      if (v && v.duration && isFinite(v.duration)) return v.duration * 1000;
      return 3000; // fallback while video metadata loads
    }
    if (imageDuration && imageDuration > 0) return imageDuration * 1000;
    if (totalAudioDuration > 0 && images.length > 1) {
      const liveTotal = liveDurationsRef.current.reduce((s, d) => s + (d || 0), 0);
      const staticCount = images.length - liveVideosRef.current.filter((v) => v).length;
      if (staticCount > 0) {
        const remain = totalAudioDuration - liveTotal;
        const each = Math.max(2, Math.ceil(remain / staticCount));
        return each * 1000;
      }
      return Math.ceil(totalAudioDuration / images.length) * 1000;
    }
    return 5000; // default 5s
  }, [imageDuration, totalAudioDuration, images.length, currentIndex]);

  // 滑动动画：轨道从当前位置滑过一页（dir=1 下一张从右进、dir=-1 上一张），
  // 动画结束后把 currentIndex 更新为相邻页并瞬间复位轨道（内容已换，视觉无缝）。
  // manual=true 表示用户手动切换（按键/拖拽/按钮），会暂停自动轮播并显示满进度；
  // manual=false 表示自动轮播推进，不暂停。
  const slideBy = useCallback((dir: 1 | -1, manual: boolean) => {
    if (isSlidingRef.current || isDraggingRef.current) return;
    const W = containerWidthRef.current || 0;
    if (!W) {
      setCurrentIndex(prev => (prev + dir + images.length) % images.length);
      return;
    }
    if (manual) setUserInteracted(true);
    isSlidingRef.current = true;
    setTransitioning(true);
    // 向右切换（dir=1）：轨道向左滑一页（dragX=-W），下一张从右侧进入
    dragXRef.current = -dir * W;
    setDragX(-dir * W);
    window.setTimeout(() => {
      setCurrentIndex(prev => (prev + dir + images.length) % images.length);
      dragXRef.current = 0;
      setDragX(0);
      setTransitioning(false);
      isSlidingRef.current = false;
    }, 320);
  }, [images.length]);

  // 松手后结算：位移超过 1/4 页宽则滑到相邻页（循环），否则回弹
  // 手动拖拽切换与按键一致：暂停自动轮播、进度满显示
  const settleDrag = useCallback(() => {
    if (isSlidingRef.current) return;
    const W = containerWidthRef.current || 0;
    if (!W) return;
    const total = dragXRef.current;
    isSlidingRef.current = true;
    setTransitioning(true);
    if (total <= -W * 0.25) {
      const target = nextIndexRef.current;
      setUserInteracted(true);
      dragXRef.current = -W;
      setDragX(-W);
      window.setTimeout(() => {
        setCurrentIndex(target);
        elapsedRef.current = 0;
        setProgress(100);
        dragXRef.current = 0;
        setDragX(0);
        setTransitioning(false);
        isSlidingRef.current = false;
      }, 320);
    } else if (total >= W * 0.25) {
      const target = prevIndexRef.current;
      setUserInteracted(true);
      dragXRef.current = W;
      setDragX(W);
      window.setTimeout(() => {
        setCurrentIndex(target);
        elapsedRef.current = 0;
        setProgress(100);
        dragXRef.current = 0;
        setDragX(0);
        setTransitioning(false);
        isSlidingRef.current = false;
      }, 320);
    } else {
      dragXRef.current = 0;
      setDragX(0);
      window.setTimeout(() => {
        setTransitioning(false);
        isSlidingRef.current = false;
      }, 320);
    }
  }, []);

  // Manual image switch - pauses auto-play
  const handleManualSwitch = useCallback((newIndex: number) => {
    setUserInteracted(true);
    const cur = currentIndexRef.current;
    if (newIndex === cur) return;
    const len = imagesLengthRef.current;
    let diff = newIndex - cur;
    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;
    if (diff === 1 || diff === -1) {
      slideBy(diff as 1 | -1, true);
    } else {
      // 跳转非相邻页（进度条远跳）：直接切换，不做滑动
      setCurrentIndex(newIndex);
      dragXRef.current = 0;
      setDragX(0);
    }
  }, [slideBy]);

  // Reset elapsed on manual switch
  useEffect(() => {
    if (userInteracted) {
      elapsedRef.current = 0;
      setProgress(100); // Manual switch: show full bar
    }
  }, [userInteracted]);

  // Auto-hide controls on mobile after 3 seconds
  useEffect(() => {
    if (!showControls) return;
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showControls]);

  // Advance to the next image according to play mode (shared by live photo & static images)
  const advanceImage = useCallback(() => {
    elapsedRef.current = 0;
    const currentMode = modeRef.current;
    const cur = currentIndexRef.current;
    const isLast = cur >= images.length - 1;
    if (isLast) {
      if (currentMode === "single") {
        // Stop on last image
        stoppedBySingleModeRef.current = true;
        setIsPlaying(false);
        setProgress(100);
        return;
      }
      if (currentMode === "next") {
        // Navigate to next video
        setIsPlaying(false);
        setProgress(100);
        onNext?.();
        return;
      }
      // loop: back to first (slide 会按 % 循环回 0)
    }
    slideBy(1, false);
  }, [images.length, onNext, slideBy]);

  // 实况交叉淡化核心（单 canvas 方案）：
  // 不再依赖封面 <img> 与 canvas 的层叠关系 —— Edge 下 opacity:0 的独立合成层仍会遮挡下方内容
  // （封面 img 带 will-change:transform + backface-visibility 正是这种合成层，导致 canvas 被盖住）。
  // 因此实况阶段封面 <img> 直接不渲染（彻底消除遮挡），改由 canvas 用 globalAlpha 在同一个画布里
  // 逐帧混合「封面帧 + 实况视频帧」，实现真正的像素级半透明交叉淡化。
  // 真 <video> 保持 opacity:0 隐藏（继续硬件解码、驱动 onEnded/进度），仅作为 canvas 的帧源。
  const liveFadeRef = useRef(0); // 0=纯封面，1=纯实况
  const fadeAnimRef = useRef<{ from: number; to: number; start: number; dur: number } | null>(null);

  const startLiveFade = useCallback((to: number, durMs: number) => {
    fadeAnimRef.current = { from: liveFadeRef.current, to, start: performance.now(), dur: durMs };
  }, []);

  // 实况播放结束：淡出实况、淡入封面帧（用 React onEnded 绑定，避免 effect 里 addEventListener 时机问题）
  const handleLiveEnded = useCallback(() => {
    startLiveFade(0, LIVE_FADE_MS * 1000);
    setLivePhase("live-fade-out");
    liveTimersRef.current.reveal = setTimeout(() => {
      setLivePhase("static-preview");
      liveTimersRef.current.preview = setTimeout(() => {
        if (imagesRef.current.length <= 1) {
          const curMode = modeRef.current;
          if (curMode === "loop") {
            setLiveRestartTick((n) => n + 1);
            return;
          }
        }
        advanceImage();
      }, LIVE_PREVIEW_MS);
    }, LIVE_FADE_MS * 1000);
  }, [advanceImage, startLiveFade]);

  // 实况照片阶段机：
  //   static-preview  → (LIVE_PREVIEW_MS 后) → live-fade-in（视频淡入并播放）→ (视频 ended)
  //   → live-fade-out → (LIVE_FADE_MS 后) → static-preview → (LIVE_PREVIEW_MS 后) → 切下一张
  // 视频引用 currentLiveVideo，重挂载后走一遍完整阶段。
  // 暂停不重置阶段机：原地暂停实况（保留进度与画面），恢复时从当前位置继续。
  useEffect(() => {
    const v = livePhotoVideoRef.current;
    if (!currentLiveVideo) {
      if (v) { v.pause(); v.currentTime = 0; }
      return;
    }

    // 手动切图：回到封面帧预览并停止所有实况播放
    if (userInteracted) {
      clearLiveTimers();
      livePhaseTickRef.current += 1;
      setLivePhase("static-preview");
      if (v) { v.pause(); v.currentTime = 0; }
      return;
    }

    // 暂停：原地暂停实况，保留进度与画面（不回到封面、不重绕）
    if (!isPlaying) {
      clearLiveTimers(); // 阻止「播完→预览→切图」的定时器链在暂停期间推进
      if (v && !v.paused) v.pause();
      return;
    }

    // 从暂停恢复：实况已挂载 → 从当前位置继续播放，不走完整阶段机
    if (liveFadeVisible) {
      if (v) {
        if (v.ended) {
          // 恰好暂停在「播完淡出」时刻：重新淡入并从头播
          v.currentTime = 0;
          v.play().catch(() => {});
          liveFadeRef.current = 0;
          startLiveFade(1, LIVE_FADE_MS * 1000);
          setLivePhase("live-fade-in");
        } else if (v.paused) {
          v.play().catch(() => {});
        }
      }
      return;
    }

    // 进入 static-preview：封面帧先展示 LIVE_PREVIEW_MS，然后淡入实况
    // epoch 在重置时递增，用于守卫定时器回调。
    setLivePhase("static-preview");
    livePhaseTickRef.current += 1;
    const epoch = livePhaseTickRef.current;

    // ★ fade timer：1s 封面预览后触发交叉淡入。
    //   无论 video ref 是否就绪，都先创建此定时器，防止首次渲染 v=null 时定时器链断裂。
    liveTimersRef.current.fade = setTimeout(() => {
      if (livePhaseTickRef.current !== epoch) return;
      // 挂载隐藏视频（仅作 canvas 帧源），首帧就绪后由帧镜像 effect 触发 live-fade-in 交叉淡化
      setLiveFadeVisible(true);
      liveTimersRef.current.fade = null;
    }, LIVE_PREVIEW_MS);

    // 若 video ref 不可读，跳过（等 liveFadeVisible 变 true 后元数据 effect 挂监听）
    if (!v) {
      return () => {
        clearLiveTimers();
        if (liveFadeTimerRef.current) { clearTimeout(liveFadeTimerRef.current); liveFadeTimerRef.current = null; }
      };
    }

    if (v) { v.currentTime = 0; }
    (v as HTMLVideoElement).muted = true;

    return () => {
      clearLiveTimers();
      if (liveFadeTimerRef.current) { clearTimeout(liveFadeTimerRef.current); liveFadeTimerRef.current = null; }
    };
  }, [currentLiveVideo, isPlaying, userInteracted, currentIndex, advanceImage, clearLiveTimers, liveRestartTick, startLiveFade]);

  // 实况视频元数据与进度监听（独立于阶段机，暂停/恢复后依然驱动进度条与时长分配）
  useEffect(() => {
    if (!currentLiveVideo || !liveFadeVisible) return;
    const v = livePhotoVideoRef.current;
    if (!v) return;
    const onLoaded = () => {
      if (v.duration && isFinite(v.duration)) {
        liveDurationsRef.current[currentIndex] = v.duration;
        setLiveDurationsTick((n) => n + 1);
      }
    };
    const onTime = () => {
      if (v.duration && isFinite(v.duration)) {
        setProgress(Math.min(100, (v.currentTime / v.duration) * 100));
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [currentLiveVideo, liveFadeVisible, currentIndex]);

  // 封面帧的 canvas 绘制用 Image（与 DOM 封面 img 同 URL，走浏览器缓存）
  const coverCanvasImgRef = useRef<HTMLImageElement | null>(null);
  const currentCoverUrl = images[currentIndex];
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.src = currentCoverUrl;
    coverCanvasImgRef.current = img;
    return () => { coverCanvasImgRef.current = null; };
  }, [currentCoverUrl]);

  useEffect(() => {
    if (!currentLiveVideo || !liveFadeVisible) return;
    const v = livePhotoVideoRef.current;
    const canvas = liveCanvasRef.current;
    if (!v || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let fadedIn = false;
    let fallback: NodeJS.Timeout | null = null;

    // 按 object-contain 等比缩放居中绘制（与封面 img 的 object-contain 一致，避免裁切）
    const drawContain = (src: CanvasImageSource, w: number, h: number) => {
      const sv = src as HTMLVideoElement;
      const si = src as HTMLImageElement;
      const sw = sv.videoWidth || si.naturalWidth || 0;
      const sh = sv.videoHeight || si.naturalHeight || 0;
      if (!sw || !sh) return;
      const scale = Math.min(w / sw, h / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    const paint = () => {
      const w = canvas.clientWidth || 0;
      const h = canvas.clientHeight || 0;
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const fade = liveFadeRef.current;
      const ci = coverCanvasImgRef.current;
      if (fade < 1 && ci && ci.complete && ci.naturalWidth > 0) {
        ctx.globalAlpha = 1 - fade;
        drawContain(ci, w, h);
      }
      if (fade > 0 && v.videoWidth > 0 && v.videoHeight > 0) {
        ctx.globalAlpha = fade;
        drawContain(v, w, h);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const anim = fadeAnimRef.current;
      if (anim) {
        const t = Math.min(1, Math.max(0, (now - anim.start) / anim.dur));
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        liveFadeRef.current = anim.from + (anim.to - anim.from) * eased;
        if (t >= 1) fadeAnimRef.current = null;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };

    // 首帧就绪：先停留在封面（fade=0），再开始 0→1 淡入，避免淡入时 canvas 还是空的
    const onFrameReady = () => {
      if (fadedIn) return;
      fadedIn = true;
      if (fallback) { clearTimeout(fallback); fallback = null; }
      liveFadeRef.current = 0;
      startLiveFade(1, LIVE_FADE_MS * 1000);
      setLivePhase((prev) => (prev === "static-preview" ? "live-fade-in" : prev));
    };

    v.addEventListener("loadeddata", onFrameReady);
    if (v.readyState >= 2) onFrameReady();

    // 兜底：若视频首帧迟迟未就绪，1.5s 后仍强制淡入，避免轮播卡死
    fallback = setTimeout(() => {
      if (!fadedIn) onFrameReady();
    }, 1500);

    raf = requestAnimationFrame(tick);

    return () => {
      v.removeEventListener("loadeddata", onFrameReady);
      cancelAnimationFrame(raf);
      if (fallback) clearTimeout(fallback);
    };
  }, [currentLiveVideo, liveFadeVisible, currentIndex, liveRestartTick, startLiveFade]);

  // Auto-play timer with smooth progress animation (static images only; live photo uses video timeupdate)
  useEffect(() => {
    if (images.length <= 1 || !isPlaying || userInteracted || currentLiveVideo) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
      // When paused, freeze progress at current value
      return;
    }

    const interval = getInterval();
    lastTickRef.current = performance.now();
    // Only reset progress display when elapsed was cleared (new image or manual switch)
    if (elapsedRef.current === 0) setProgress(0);

    // Progress animation via RAF
    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      elapsedRef.current += delta;
      const pct = Math.min(100, (elapsedRef.current / interval) * 100);
      if (pct >= 100) {
        // Stop here — don't set 100 to avoid a flash before cleanup cancels RAF
        return;
      }
      setProgress(pct);
      progressRafRef.current = requestAnimationFrame(tick);
    };
    progressRafRef.current = requestAnimationFrame(tick);

    // Calculate remaining time for the cycling timer
    const remaining = Math.max(0, interval - elapsedRef.current);
    autoPlayTimerRef.current = setTimeout(advanceImage, remaining);

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    };
  }, [images.length, isPlaying, userInteracted, currentIndex, getInterval, currentLiveVideo, advanceImage]);

  // Reset userInteracted when user pauses and resumes
  useEffect(() => {
    if (!isPlaying) {
      setUserInteracted(false);
    }
  }, [isPlaying]);

  // Show temporary indicator
  const showTempIndicator = useCallback((type: "play" | "pause") => {
    if (indicatorTimerRef.current) {
      clearTimeout(indicatorTimerRef.current);
    }
    setShowIndicator(type);
    indicatorTimerRef.current = setTimeout(() => {
      setShowIndicator(null);
    }, 700);
  }, []);

  const togglePlay = useCallback(() => {
    // If paused because single mode reached the end, resume from the start of the carousel
    if (!isPlaying && stoppedBySingleModeRef.current) {
      stoppedBySingleModeRef.current = false;
      elapsedRef.current = 0;
      setProgress(0);
      setCurrentIndex(0);
    }
    if (currentLiveVideo) {
      // Live photo: toggle the muted video; the background music continues (or pauses with the whole carousel)
      if (isPlaying) {
        livePhotoVideoRef.current?.pause();
        if (audioRef.current) audioRef.current.pause();
        showTempIndicator("play");
      } else {
        if (audioRef.current) audioRef.current.play().catch(() => {});
        showTempIndicator("pause");
      }
      setIsPlaying(!isPlaying);
      // 从暂停恢复：由阶段机 liveFadeVisible 分支原地续播实况（不回到封面）
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        showTempIndicator("play");  // Show play icon = "click to resume"
      } else {
        audioRef.current.play().catch(() => {});
        showTempIndicator("pause");  // Show pause icon = "click to pause"
      }
      setIsPlaying(!isPlaying);
    } else if (audioUrls.length > 0) {
      // Audio element not yet loaded, but URLs exist - toggle state
      const newPlaying = !isPlaying;
      setIsPlaying(newPlaying);
      showTempIndicator(newPlaying ? "pause" : "play");
    } else {
      const newPlaying = !isPlaying;
      setIsPlaying(newPlaying);
      showTempIndicator(newPlaying ? "pause" : "play");
    }
  }, [isPlaying, audioUrls.length, showTempIndicator, currentLiveVideo]);

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const i = MODES.findIndex(m => m.key === prev);
      const next = MODES[(i + 1) % MODES.length].key;
      updatePlayMode(next, userIdRef.current);
      return next;
    });
  }, []);

  // Apply volume to background music audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      updateVolume({ volume, muted: next }, userIdRef.current);
      return next;
    });
  }, [volume]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    const nextMuted = v > 0 && muted ? false : muted;
    if (v > 0 && muted) setMuted(false);
    // 拖动滑块时连续触发，防抖 300ms 后再持久化，避免频繁请求
    if (volumePersistTimerRef.current) clearTimeout(volumePersistTimerRef.current);
    volumePersistTimerRef.current = setTimeout(() => {
      updateVolume({ volume: v, muted: nextMuted }, userIdRef.current);
    }, 300);
  }, [muted]);

  // 音量条自动隐藏：悬停音量图标时显示并启动 2s 定时器（鼠标不滑入滑块则自动消失）；
  // 鼠标滑入滑块后取消定时器（交互期间保持显示），移出滑块立即隐藏。
  // 控制栏 group-hover 隐藏仍生效：滑块随控制栏一起淡出。
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const volumePersistTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showVolumeTemporarily = useCallback(() => {
    setShowVolume(true);
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setShowVolume(false), 2000);
  }, []);
  const keepVolumeVisible = useCallback(() => {
    if (volumeTimerRef.current) { clearTimeout(volumeTimerRef.current); volumeTimerRef.current = null; }
    setShowVolume(true);
  }, []);
  useEffect(() => () => { if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current); if (volumePersistTimerRef.current) clearTimeout(volumePersistTimerRef.current); }, []);

  // 音量滑块样式：thumb 圆点相对轨道中线对齐（Tailwind 任意变体对 range 伪元素不可靠，用注入 CSS）
  useEffect(() => {
    const styleId = "bili-vol-slider-style";
    if (document.getElementById(styleId)) return;
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = `
      .bili-vol-slider { -webkit-appearance: none; appearance: none; }
      .bili-vol-slider::-webkit-slider-runnable-track {
        height: 4px; border-radius: 9999px; background: transparent;
      }
      .bili-vol-slider::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 12px; height: 12px; border-radius: 9999px;
        background: #FB7299; border: 0;
        margin-top: -4px; /* (thumb 12 - track 4) / 2 → 使圆心对齐轨道中线 */
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      }
      .bili-vol-slider::-moz-range-track {
        height: 4px; border-radius: 9999px; background: transparent;
      }
      .bili-vol-slider::-moz-range-thumb {
        width: 12px; height: 12px; border-radius: 9999px;
        background: #FB7299; border: 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      }
    `;
    document.head.appendChild(s);
  }, []);

  // Keep refs in sync so native event listeners always call latest callbacks
  const togglePlayRef = useRef(togglePlay);
  const currentIndexRef = useRef(currentIndex);
  const imagesLengthRef = useRef(images.length);
  const currentAudioIndexRef = useRef(currentAudioIndex);
  const settleDragRef = useRef(settleDrag);
  useEffect(() => { togglePlayRef.current = togglePlay; });
  useEffect(() => { currentIndexRef.current = currentIndex; });
  useEffect(() => { imagesLengthRef.current = images.length; });
  useEffect(() => { currentAudioIndexRef.current = currentAudioIndex; });
  useEffect(() => { settleDragRef.current = settleDrag; });

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      // Add current audio duration to total
      setTotalAudioDuration(prev => prev + audioRef.current!.duration);
      // Auto-play audio when loaded (browser may block autoplay)
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          // Autoplay blocked - will retry on user interaction
          setIsPlaying(false);
        });
      }
    }
  };

  const handleAudioEnded = () => {
    // Play next audio if available
    if (currentAudioIndexRef.current < audioUrlsRef.current.length - 1) {
      setCurrentAudioIndex(prev => prev + 1);
    }
    // Loop: restart from first audio when all audios finish
    else {
      setCurrentAudioIndex(0);
      setTotalAudioDuration(0);
      // Single audio: setCurrentAudioIndex(0) won't trigger useEffect (same value), force restart
      if (audioUrlsRef.current.length <= 1 && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  // Auto-play audio when isPlaying changes to true
  useEffect(() => {
    if (isPlaying && audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {
        // Autoplay blocked - set to paused state
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  // Pause audio when isPlaying becomes false (e.g. single mode stops on last image)
  useEffect(() => {
    if (!isPlaying && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Auto-play audio when currentAudioIndex changes (e.g. audio ended → loop back to first)
  useEffect(() => {
    if (isPlaying && audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentAudioIndex, isPlaying]);

  // Resume audio on user interaction if blocked
  useEffect(() => {
    const handleUserInteraction = () => {
      if (audioRef.current && audioRef.current.paused && isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener("click", handleUserInteraction, { once: true });
    return () => document.removeEventListener("click", handleUserInteraction);
  }, [isPlaying]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e) || isComposingEvent(e)) return;
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        e.preventDefault();
        handleManualSwitch(Math.max(0, currentIndex - 1));
      } else if (key === "arrowright" || key === "d") {
        e.preventDefault();
        handleManualSwitch(Math.min(images.length - 1, currentIndex + 1));
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length, handleManualSwitch, togglePlay]);

  // 交互（拖拽/点击/双击）：用 Pointer 事件统一处理鼠标与触摸。
  // - 鼠标左键 / 触摸按住拖动：图片实时跟手平移，松手后滑到相邻页或回弹（相册式）。
  // - 无位移的触摸 = 点击：双击切换播放/暂停，单击切换控制栏可见性。
  // - 无位移的鼠标 = 单击：交给 click 事件处理播放/暂停。
  // touchstart 仅在非交互区域 preventDefault，阻断移动端合成 click，避免与 pointerup 重复处理。
  // 所有回调通过 ref 访问，effect 只运行一次。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // 容器宽度（轨道布局 + 拖拽结算需要）
    const measure = () => { containerWidthRef.current = el.clientWidth || 0; };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const onTouchStart = (e: Event) => {
      // Block click synthesis on non-interactive areas
      const t = (e.target as HTMLElement);
      if (!t.closest("button") && !t.closest("a")) {
        e.preventDefault();
      }
    };

    const onPointerDown = (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.pointerType !== "mouse" && pe.pointerType !== "touch") return;
      if (pe.pointerType === "mouse" && pe.button !== 0) return;
      const t = pe.target as HTMLElement;
      if (t.closest("button") || t.closest("a") || t.closest("[data-controlbar]")) return;
      if (isSlidingRef.current || isDraggingRef.current) return;
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      dragStartXRef.current = pe.clientX;
      dragBaseXRef.current = dragXRef.current;
      el.setPointerCapture?.(pe.pointerId);
    };

    const onPointerMove = (e: Event) => {
      if (!isDraggingRef.current) return;
      const pe = e as PointerEvent;
      const dx = pe.clientX - dragStartXRef.current;
      if (Math.abs(dx) > 6 && !dragMovedRef.current) {
        dragMovedRef.current = true;
        setDragActive(true);
      }
      const W = containerWidthRef.current || 0;
      if (!W) return;
      const next = Math.max(-W, Math.min(W, dragBaseXRef.current + dx));
      dragXRef.current = next;
      setDragX(next);
    };

    const onPointerUp = (e: Event) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setDragActive(false);
      const pe = e as PointerEvent;
      if (dragMovedRef.current) {
        settleDragRef.current();
        // dragMovedRef 保持 true 让随后的 click 被忽略，再延迟复位
        window.setTimeout(() => { dragMovedRef.current = false; }, 0);
        return;
      }
      // 未移动 = 点击
      if (pe.pointerType === "touch") {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          togglePlayRef.current();
          lastTapRef.current = 0;
        } else {
          setShowControls(prev => !prev);
          lastTapRef.current = now;
        }
      }
      // 鼠标未移动的单击由 click 事件处理
    };

    const onClick = (e: Event) => {
      // 拖拽松手后触发的 click 视为拖动的一部分，不处理（不触发播放/暂停）
      if (dragMovedRef.current) { dragMovedRef.current = false; return; }
      // 忽略按钮/链接的点击（React stopPropagation 无法阻止原生事件冒泡到此）
      const t = (e as MouseEvent).target as HTMLElement;
      // 点击控制栏（含空白处）不触发播放/暂停，只切换控制栏可见性
      if (t.closest("[data-controlbar]")) {
        setShowControls(prev => !prev);
        return;
      }
      if (t.closest("button") || t.closest("a")) return;
      togglePlayRef.current();
    };

    el.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("click", onClick);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("click", onClick);
      ro.disconnect();
    };
  }, []); // Empty deps — all state accessed via refs

  if (images.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        暂无图片
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-black group"
      style={{ touchAction: "none" }}
      data-live-phase={livePhase}
      data-live-visible={liveFadeVisible}
    >
      {audioUrls.length > 0 && (
        <audio
          ref={audioRef}
          src={audioUrls[currentAudioIndex]}
          preload="auto"
          onLoadedMetadata={handleAudioLoadedMetadata}
          onEnded={handleAudioEnded}
        />
      )}

      {/* 实况视频：仅在交叉淡化阶段渲染，opacity:0 隐藏，仅作为 canvas 的帧源。
           GPU 把 <video> 当独立合成平面，不参与和 HTML 层的逐像素 alpha 混合，
           Edge 下即使 opacity:0 的合成层也会遮挡下方内容，因此视频不直接显示，
           由下方 opaque 的 canvas 完全盖住它；视频仅负责解码、驱动 onEnded/进度/首帧。 */}
      {currentLiveVideo && liveFadeVisible && (
        <video
          ref={livePhotoVideoRef}
          src={currentLiveVideo}
          muted
          playsInline
          loop={false}
          preload="auto"
          onEnded={handleLiveEnded}
          className="pointer-events-none absolute inset-0 z-10 opacity-0"
          data-live-phase={livePhase}
          aria-hidden
        />
      )}

      {/* 实况交叉淡化 canvas（单 canvas 方案）：
           同一画布里用 globalAlpha 逐帧混合「封面帧 + 实况视频帧」。
           canvas 置于封面 <img> 上方（z-[12] > z-[11]），实况阶段由 canvas 完全覆盖封面；
           封面 <img> 常驻在下层，作为「canvas 首帧绘制前的无缝底衬」，消除淡入时的空档闪烁。 */}
      {currentLiveVideo && liveFadeVisible && !dragActive && (
        <canvas
          ref={liveCanvasRef}
          className="absolute inset-0 z-[12] h-full w-full"
          style={{ pointerEvents: "none" }}
          data-live-phase={livePhase}
        />
      )}

      {/* 相册式横向轨道：当前页 + 前后相邻页（循环）并排，鼠标按住拖动实时跟手平移，
          松手后滑动到相邻页或回弹。每页同时包含自己的高斯模糊背景与清晰主图，二者一起平移。
          每页 overflow-hidden 把模糊（scale-110 + blur 60px）裁剪在本页内，避免相邻页模糊串色。 */}
      {(() => {
        const prevIdx = (currentIndex - 1 + images.length) % images.length;
        const nextIdx = (currentIndex + 1) % images.length;
        return (
          <div
            className="absolute inset-0 z-[11] flex h-full cursor-grab select-none"
            style={{
              transform: `translateX(calc(-100% + ${dragX}px))`,
              transition: transitioning ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
            }}
          >
            {[prevIdx, currentIndex, nextIdx].map((idx) => (
              <div key={`page-${idx}`} className="relative h-full w-full shrink-0 overflow-hidden">
                <img
                  src={images[idx]}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-[60px] brightness-[0.9] saturate-[1.15]"
                  decoding="async"
                  draggable={false}
                />
                <img
                  src={images[idx]}
                  alt={`Image ${idx + 1}`}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      imageRatioRefs.current[idx] = img.naturalWidth / img.naturalHeight;
                      setRatioTick((n) => n + 1);
                    }
                  }}
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Center play/pause indicator - elastic animation like video player */}
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            key={showIndicator}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex h-[min(18vw,18vh)] w-[min(18vw,18vh)] items-center justify-center rounded-full bg-black/60">
              {showIndicator === "pause" ? (
                <svg className="h-2/5 w-2/5" viewBox="0 0 24 24" fill="#fff">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="h-2/5 w-2/5" viewBox="0 0 24 24" fill="#fff">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图片进度条内容：点击一段跳转到对应图片 */}
      {(() => {
        const progressBar = images.length > 1 ? (
          <div className="flex h-[9px] items-center gap-[2px] px-2 pt-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (i !== currentIndex) {
                    handleManualSwitch(i);
                  }
                }}
                className="relative h-[3px] flex-1 overflow-hidden rounded-sm bg-white/30 transition-all duration-[80ms] hover:h-[9px] hover:opacity-100"
                title={`跳转到第 ${i + 1} 张`}
              >
                {i < currentIndex && (
                  <span className="absolute inset-0 bg-white" />
                )}
                {i === currentIndex && (
                  <span
                    className="absolute inset-y-0 left-0 bg-white"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </button>
            ))}
          </div>
        ) : null;

        return (
          <div className="absolute inset-x-0 bottom-0 z-20">
            {/* 进度条：始终显示，位于控制栏上方；控制栏升起时被托起，落下时回到底部 */}
            {progressBar && (
              <div className="pointer-events-auto pb-1">
                {progressBar}
              </div>
            )}
            {/* 控制栏：grid 行高 0fr↔1fr 动画 = 从底部升起/落下（水托荷叶效果） */}
            <div className={`grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr] ${showControls ? '!grid-rows-[1fr]' : ''}`}>
              <div className="overflow-hidden">
                <div data-controlbar className="bg-gradient-to-t from-black/70 to-transparent">
                  <div className="grid grid-cols-3 items-center p-3">
          {/* Left: Play/Pause button */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="text-white hover:text-[#FB7299]"
            >
              {isPlaying ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          </div>

          {/* Center: Image counter (真正的水平居中，不受左右按钮宽度影响) */}
          <div className="text-center text-sm text-white">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Right: Mode selector + Fullscreen */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cycleMode();
              }}
              onMouseEnter={() => setShowModeTooltip(true)}
              onMouseLeave={() => setShowModeTooltip(false)}
              className="relative text-white hover:text-[#FB7299]"
            >
              {mode === "loop" && <Repeat className="h-5 w-5" />}
              {mode === "single" && <Play className="h-5 w-5" />}
              {mode === "next" && <SkipForward className="h-5 w-5" />}
              {showModeTooltip && (
                <div className="absolute bottom-8 right-0 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs text-white">
                  {MODES.find(m => m.key === mode)?.label}
                </div>
              )}
            </button>
            {/* Volume control */}
            <div className="group/vol relative flex items-center">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                onMouseEnter={showVolumeTemporarily}
                className="text-white hover:text-[#FB7299]"
                title={muted ? "取消静音" : "静音"}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              {/* Volume slider on hover — 悬停图标显示（2s 后自动消失），滑入滑块取消定时器保持显示，移出滑块立即隐藏 */}
              <div
                onMouseEnter={keepVolumeVisible}
                onMouseLeave={() => { setShowVolume(false); if (volumeTimerRef.current) { clearTimeout(volumeTimerRef.current); volumeTimerRef.current = null; } }}
                className={`absolute bottom-full right-0 mb-2 flex-col items-center gap-1 rounded-md bg-black/80 px-2 py-2 transition-opacity duration-200 ${
                  showVolume ? "flex opacity-100" : "pointer-events-none flex opacity-0"
                }`}
              >
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                  className="bili-vol-slider h-1 w-20 cursor-pointer rounded-full"
                  style={{
                    background: `linear-gradient(to right, #FB7299 ${muted ? 0 : volume * 100}%, rgba(255,255,255,0.3) ${muted ? 0 : volume * 100}%)`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const el = containerRef.current;
                if (el) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    el.requestFullscreen();
                  }
                }
              }}
              className="text-white hover:text-[#FB7299]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Navigation arrows - visible on hover, hidden on mobile */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleManualSwitch(Math.max(0, currentIndex - 1)); }}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-black/90 disabled:opacity-30 disabled:hover:bg-black/50 hidden sm:block"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleManualSwitch(Math.min(images.length - 1, currentIndex + 1)); }}
            disabled={currentIndex === images.length - 1}
            className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-black/90 disabled:opacity-30 disabled:hover:bg-black/50 hidden sm:block"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

const Recommendations = dynamic(() => import("@/components/video/recommendations"), {
  loading: () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-2 animate-pulse">
          <div className="h-20 w-32 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  ),
});

const CommentSection = dynamic(() => import("@/components/video/comment-section"), {
  loading: () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="mt-2 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  ),
});

export default function VideoPlaySection({
  video,
  nextVideoId,
  prevVideoId,
  isOwner,
  initialLikeCount,
  initialLiked,
  initialFavoriteCount,
  initialFavorited,
  userId,
  playMode = "loop",
}: {
  video: VideoInfo;
  nextVideoId?: string;
  prevVideoId?: string;
  isOwner: boolean;
  initialLikeCount: number;
  initialLiked?: boolean;
  initialFavoriteCount: number;
  initialFavorited?: boolean;
  userId?: string | null;
  playMode?: PlayMode;
}) {
  const [state, dispatch] = useReducer(videoReducer, {
    video,
    videoId: video.id,
    nextVideoId,
    prevVideoId,
    likeCount: initialLikeCount,
    liked: initialLiked ?? false,
    favoriteCount: initialFavoriteCount,
    favorited: initialFavorited ?? false,
  });

  const handleNextVideo = useCallback(async () => {
    if (!state.nextVideoId) return;
    try {
      const res = await fetch(`/api/videos/${state.nextVideoId}/detail`);
      if (!res.ok) return;
      const data = await res.json();
      window.history.replaceState(null, "", `/video/${data.id}`);
      dispatch({ type: "NAVIGATE", video: data });
    } catch {
      window.location.href = `/video/${state.nextVideoId}`;
    }
  }, [state.nextVideoId]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
      <motion.div
        className="lg:col-span-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          {state.video.postType === "image_text" && state.video.imageUrls ? (
            <ImageCarousel
              imageUrls={JSON.parse(state.video.imageUrls)}
              livePhotoVideos={state.video.livePhotoVideos ? JSON.parse(state.video.livePhotoVideos) : null}
              musicUrls={state.video.musicUrls ? JSON.parse(state.video.musicUrls) : (state.video.musicUrl ? [state.video.musicUrl] : null)}
              imageDuration={state.video.imageDuration}
              playMode={playMode}
              userId={userId}
              onNext={handleNextVideo}
            />
          ) : (
            <VideoPlayer
              initialVideo={state.video}
              initialNextVideoId={state.nextVideoId}
              initialPrevVideoId={state.prevVideoId}
              userId={userId}
              onVideoChange={(v) => dispatch({ type: "NAVIGATE", video: v })}
            />
          )}
        </div>
        <div className="mt-3 sm:mt-4">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
            {state.video.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:gap-4 sm:text-sm">
            <Link href={`/user/${state.video.author.id}`} className="flex items-center gap-2 hover:opacity-80">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white sm:h-8 sm:w-8 sm:text-xs ${avatarColorFor(state.video.author.name)}`}>
                {state.video.author.name?.[0] || "U"}
              </div>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{state.video.author.name}</span>
            </Link>
            <span>{new Date(state.video.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
          {state.video.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400 sm:mt-3 sm:text-base">
              {state.video.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 sm:mt-4 sm:gap-3">
            <VideoLikeButton key={`like-${state.video.id}`} videoId={state.video.id} initialCount={state.likeCount} initialLiked={state.liked} />
            <VideoFavoriteButton key={`fav-${state.video.id}`} videoId={state.video.id} initialCount={state.favoriteCount} initialFavorited={state.favorited} />
            {isOwner && (
              <>
                <Link
                  href={`/edit/${state.video.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:border-red-500 dark:hover:text-red-400"
                >
                  <Pencil className="h-4 w-4" />
                  编辑
                </Link>
                <VideoDeleteButton videoId={state.video.id} postType={state.video.postType} />
              </>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:mt-6 sm:pt-6">
          <CommentSection videoId={state.video.id} />
        </div>
      </motion.div>
      <motion.div
        className="lg:col-span-1"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:mb-4 sm:text-lg">
          相关推荐
        </h2>
        <Recommendations currentVideoId={state.videoId} />
      </motion.div>
    </div>
  );
}
