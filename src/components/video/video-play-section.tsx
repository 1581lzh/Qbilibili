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
const CAROUSEL_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 100 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -100 }),
};

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
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showModeTooltip, setShowModeTooltip] = useState(false);
  const [showControls, setShowControls] = useState(() => {
    // Mobile: show controls for 3 seconds on mount
    if (typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      return true;
    }
    return false;
  });
  const dirRef = useRef(0);
  const [, forceRender] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const livePhotoVideoRef = useRef<HTMLVideoElement>(null);
  const [needBlurBg, setNeedBlurBg] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const indicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const progressRafRef = useRef<number>(0);
  const elapsedRef = useRef(0); // accumulated elapsed ms (survives index changes)
  const lastTickRef = useRef(0); // last RAF timestamp
  const modeRef = useRef<PlayMode>(playMode);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  const stoppedBySingleModeRef = useRef(false);

  // 判断当前图片是否需要模糊背景填充黑边：
  // 比较「当前图片实际比例」与「容器实际比例」，差异超过阈值（存在黑边）才显示。
  // 用 ResizeObserver 监听容器尺寸变化 + 图片 onLoad 获取真实比例，自动适配移动端/PC 端。
  const curImageRatioRef = useRef<number | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const check = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const ratio = curImageRatioRef.current;
      if (cw <= 0 || ch <= 0 || !ratio || ratio <= 0) return;
      const containerAspect = cw / ch;
      const diff = Math.abs(ratio - containerAspect) / Math.max(ratio, containerAspect);
      setNeedBlurBg(diff > 0.05);
    };

    // 先按当前已知比例评估一次
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [currentIndex]);

  // Parse musicUrls
  const audioUrls = useMemo(() => {
    if (musicUrls && musicUrls.length > 0) return musicUrls;
    return [];
  }, [musicUrls]);
  audioUrlsRef.current = audioUrls;

  const images = imageUrls.filter(url => url);
  // livePhotoVideos is paired 1:1 with imageUrls (same index). Filter to match images indices.
  const liveVideos = useMemo(() => {
    if (!livePhotoVideos || !Array.isArray(livePhotoVideos)) return [];
    return images.map((_, i) => livePhotoVideos[i] || "");
  }, [livePhotoVideos, images]);
  const liveVideosRef = useRef(liveVideos);
  liveVideosRef.current = liveVideos;
  const currentLiveVideo = liveVideos[currentIndex] || "";
  // Track each live photo video's duration (seconds) to balance auto-mode preview times
  const liveDurationsRef = useRef<number[]>([]);
  const [, setLiveDurationsTick] = useState(0);

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

  const goToImage = useCallback((newIndex: number) => {
    setCurrentIndex(prev => {
      const dir = newIndex > prev ? 1 : -1;
      dirRef.current = dir;
      forceRender(n => n + 1);
      return newIndex;
    });
  }, []);

  // Manual image switch - pauses auto-play
  const handleManualSwitch = useCallback((newIndex: number) => {
    setUserInteracted(true);
    goToImage(newIndex);
  }, [goToImage]);

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
    setCurrentIndex(prev => {
      const isLast = prev >= images.length - 1;
      if (isLast) {
        if (currentMode === "single") {
          // Stop on last image
          stoppedBySingleModeRef.current = true;
          setIsPlaying(false);
          setProgress(100);
          return prev;
        }
        if (currentMode === "next") {
          // Navigate to next video
          setIsPlaying(false);
          setProgress(100);
          onNext?.();
          return prev;
        }
        // loop: back to first
        dirRef.current = 1;
        forceRender(n => n + 1);
        return 0;
      }
      dirRef.current = 1;
      forceRender(n => n + 1);
      return prev + 1;
    });
  }, [images.length, onNext]);

  // Live photo video playback control:
  // - When current image is a live photo and isPlaying, play the muted video, drive progress from timeupdate
  // - On video 'ended', advance to next image (respecting play mode)
  useEffect(() => {
    const v = livePhotoVideoRef.current;
    if (!currentLiveVideo) {
      if (v) { v.pause(); v.currentTime = 0; }
      return;
    }
    if (v && isPlaying && !userInteracted) {
      v.muted = true;
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
      const onEnded = () => { advanceImage(); };
      v.addEventListener("loadedmetadata", onLoaded);
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("ended", onEnded);
      v.play().catch(() => {});
      return () => {
        v.removeEventListener("loadedmetadata", onLoaded);
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("ended", onEnded);
      };
    } else if (v) {
      v.pause();
    }
  }, [currentLiveVideo, isPlaying, userInteracted, advanceImage, currentIndex]);

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
        livePhotoVideoRef.current?.play().catch(() => {});
        if (audioRef.current) audioRef.current.play().catch(() => {});
        showTempIndicator("pause");
      }
      setIsPlaying(!isPlaying);
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
    setMuted(prev => !prev);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    if (v > 0 && muted) setMuted(false);
  }, [muted]);

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
  const handleManualSwitchRef = useRef(handleManualSwitch);
  const togglePlayRef = useRef(togglePlay);
  const currentIndexRef = useRef(currentIndex);
  const imagesLengthRef = useRef(images.length);
  const currentAudioIndexRef = useRef(currentAudioIndex);
  useEffect(() => { handleManualSwitchRef.current = handleManualSwitch; });
  useEffect(() => { togglePlayRef.current = togglePlay; });
  useEffect(() => { currentIndexRef.current = currentIndex; });
  useEffect(() => { imagesLengthRef.current = images.length; });
  useEffect(() => { currentAudioIndexRef.current = currentAudioIndex; });

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
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleManualSwitch(Math.max(0, currentIndex - 1));
      } else if (e.key === "ArrowRight") {
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

  // Native touch/click handlers — must use addEventListener with { passive: false }
  // to guarantee preventDefault() blocks the synthesized click event (React's
  // synthetic onTouchStart is passive by default and ignores preventDefault).
  // All callbacks accessed via refs so this effect never re-runs.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: Event) => {
      const te = e as TouchEvent;
      touchStartX = te.touches[0].clientX;
      touchStartY = te.touches[0].clientY;
      // Block click synthesis on non-interactive areas
      const t = (te.target as HTMLElement);
      if (!t.closest("button") && !t.closest("a")) {
        te.preventDefault();
      }
    };

    const onTouchEnd = (e: Event) => {
      const te = e as TouchEvent;
      const endX = te.changedTouches[0].clientX;
      const endY = te.changedTouches[0].clientY;
      const diffX = touchStartX - endX;
      const diffY = touchStartY - endY;

      // Swipe → navigate
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        const len = imagesLengthRef.current;
        const idx = currentIndexRef.current;
        if (diffX > 0) handleManualSwitchRef.current(Math.min(len - 1, idx + 1));
        else handleManualSwitchRef.current(Math.max(0, idx - 1));
        return;
      }

      // Double-tap → toggle play/pause (keep controls state unchanged)
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        togglePlayRef.current();
        lastTapRef.current = 0;
      } else {
        // Single tap → toggle controls visibility
        setShowControls(prev => !prev);
        lastTapRef.current = now;
      }
    };

    // 检测是否是真正的触摸设备（排除触摸屏笔记本）
    const isTouchDevice = () => {
      // 有 ontouchstart 事件的是真正的触摸设备
      if ("ontouchstart" in window) return true;
      // maxTouchPoints > 0 且没有鼠标的是触摸设备
      if (navigator.maxTouchPoints > 0) {
        // 检查是否通过媒体查询判断为触摸设备
        return window.matchMedia("(pointer: coarse)").matches;
      }
      return false;
    };

    const onClick = (e: Event) => {
      // 忽略按钮/链接的点击（React stopPropagation 无法阻止原生事件冒泡到此）
      const t = (e as MouseEvent).target as HTMLElement;
      // 点击控制栏（含空白处）不触发播放/暂停，只切换控制栏可见性
      if (t.closest("[data-controlbar]")) {
        setShowControls(prev => !prev);
        return;
      }
      if (t.closest("button") || t.closest("a")) return;
      // Mobile: single tap toggles controls visibility
      if (isTouchDevice()) {
        setShowControls(prev => !prev);
      } else {
        togglePlayRef.current();
      }
    };

    // Only attach touch handlers on touch devices (matching video-player.tsx pattern)
    if (isTouchDevice()) {
      el.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
      el.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    }
    el.addEventListener("click", onClick);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("click", onClick);
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

      {currentLiveVideo && (
        <video
          ref={livePhotoVideoRef}
          src={currentLiveVideo}
          muted
          playsInline
          loop={false}
          preload="auto"
          className="relative z-10 h-full w-full object-contain"
        />
      )}

      {/* 高斯模糊背景填充黑边：随当前图片动态变化，仅在存在黑边时显示。
          使用独立 AnimatePresence 让背景与前景一起交叉淡化切换，避免原地突变。 */}
      <AnimatePresence initial={false}>
        {needBlurBg && (
          <motion.div
            key={`bg-${currentIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute inset-0 z-0 bg-black"
            aria-hidden
          >
            <img
              src={images[currentIndex]}
              alt=""
              className="h-full w-full scale-110 object-cover opacity-100 blur-[60px] brightness-[0.9] saturate-[1.15]"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" custom={dirRef.current}>
        <motion.img
          key={`img-${currentIndex}`}
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          custom={dirRef.current}
          variants={CAROUSEL_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              curImageRatioRef.current = img.naturalWidth / img.naturalHeight;
              // 触发容器内比例检查
              const container = containerRef.current;
              if (container) {
                const cw = container.clientWidth;
                const ch = container.clientHeight;
                const ratio = curImageRatioRef.current;
                const containerAspect = cw / ch;
                const diff = Math.abs(ratio - containerAspect) / Math.max(ratio, containerAspect);
                setNeedBlurBg(diff > 0.05);
              }
            }
          }}
          className={`relative z-10 h-full w-full object-contain ${currentLiveVideo ? "opacity-0" : ""}`}
          draggable={false}
        />
      </AnimatePresence>

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

      {/* Bottom control bar - like video player */}
      <div data-controlbar className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${showControls ? '!opacity-100' : ''}`}>
        {/* Progress bar - click a segment to jump to that image */}
        {images.length > 1 && (
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
        )}
        <div className="flex items-center justify-between p-3">
          {/* Left: Play/Pause button */}
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

          {/* Center: Image counter */}
          <div className="text-sm text-white">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Right: Mode selector + Fullscreen */}
          <div className="flex items-center gap-2">
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
                onMouseEnter={() => setShowVolume(true)}
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
              {/* Volume slider on hover — 滑块属于 hover 区域，鼠标移入不消失，移出才隐藏 */}
              <div
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
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
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FB7299] text-[10px] font-bold text-white sm:h-8 sm:w-8 sm:text-xs">
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
