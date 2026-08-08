"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";

interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isClosing, setIsClosing] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragX, setDragX] = useState(0); // 相册式横向轨道拖拽偏移（scale<=1 时用）
  const [transitioning, setTransitioning] = useState(false); // 滑动到位动画中
  const [isPinching, setIsPinching] = useState(false);
  const [interacting, setInteracting] = useState(false); // 拖动/捏合中（禁用过渡，跟手）
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 轨道 & 拖拽所需 refs（原生监听里避免闭包陈旧值）
  const trackWidthRef = useRef(0);
  const scaleRef = useRef(1);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragBaseXRef = useRef(0);
  const dragBaseYRef = useRef(0);
  const isSlidingRef = useRef(false);
  const prevIndexRef = useRef(0);
  const nextIndexRef = useRef(0);
  const lastDoubleTapRef = useRef(0);
  // 双击判定状态机：单击设 pending，300ms 内再点才成立双击；到期作废。
  // 与 lastDoubleTapRef(350ms busy) 共同保证：单击永不触发、双击只 toggle 一次。
  const tapPendingRef = useRef(false);
  const tapPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // pointer capture 后 click 会派发到容器而非原始目标，用它记住按下时是否在图片上
  const pointerOnImageRef = useRef(false);

  // 最近一次触摸发生的时间：鼠标 dblclick 监听的触摸合成兜底（800ms 内忽略），
  // 防止移动端浏览器为快速两次触摸合成的 dblclick 与 touchend 判定双触发。
  const lastTouchTimeRef = useRef(0);

  // 双指捏合缩放状态
  const pinchDistanceRef = useRef(0);
  const pinchActiveRef = useRef(false);

  // scaleRef 与 state 同步：touchmove 高频事件中 React 渲染是异步的，
  // 若只在 useEffect 里同步 scaleRef，pinch 松手后立即操作会读到陈旧值（如 1）；
  // 因此所有写 scale 的地方统一走 setScaleSync，立即更新 ref，判定永远拿最新值。
  const setScaleSync = (next: number | ((s: number) => number)) => {
    const s = typeof next === "function" ? next(scaleRef.current) : next;
    const clamped = Math.min(Math.max(s, 0.5), 5);
    scaleRef.current = clamped;
    setScale(clamped);
  };

  useEffect(() => {
    posRef.current = position;
  }, [position]);
  // 回到 100% 进入相册轨道时，把缩放位移归零，确保居中。
  // 注意：不重置 dragX——缩放模式下 dragX 恒为 0（pinch 转入时已归零），
  // 且 slideBy/settleDrag 的滑动动画正在用 dragX，这里清零会打断动画。
  useEffect(() => {
    if (Math.abs(scale - 1) <= 0.05) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);  useEffect(() => {
    dragXRef.current = dragX;
  }, [dragX]);
  useEffect(() => {
    prevIndexRef.current = (currentIndex - 1 + images.length) % images.length;
    nextIndexRef.current = (currentIndex + 1) % images.length;
  }, [currentIndex, images.length]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const close = useCallback(() => {
    setIsClosing(true);
    timeoutRef.current = setTimeout(onClose, 200);
  }, [onClose]);

  const resetZoom = useCallback(() => {
    setScaleSync(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // ---- 相册式横向轨道：三页并排 + 拖拽跟手 + 松手结算（仿图文播放器） ----
  const slideBy = useCallback((dir: 1 | -1) => {
    if (isSlidingRef.current || isDraggingRef.current) return;
    const W = trackWidthRef.current || 0;
    if (!W) {
      setCurrentIndex((p) => (p + dir + images.length) % images.length);
      return;
    }
    isSlidingRef.current = true;
    setTransitioning(true);
    dragXRef.current = -dir * W;
    setDragX(-dir * W);
    window.setTimeout(() => {
      setCurrentIndex((p) => (p + dir + images.length) % images.length);
      dragXRef.current = 0;
      setDragX(0);
      setTransitioning(false);
      isSlidingRef.current = false;
    }, 320);
  }, [images.length]);

  const settleDrag = useCallback(() => {
    if (isSlidingRef.current) return;
    const W = trackWidthRef.current || 0;
    if (!W) return;
    const total = dragXRef.current;
    isSlidingRef.current = true;
    setTransitioning(true);
    if (total <= -W * 0.25) {
      const target = nextIndexRef.current;
      dragXRef.current = -W;
      setDragX(-W);
      window.setTimeout(() => {
        setCurrentIndex(target);
        dragXRef.current = 0;
        setDragX(0);
        setTransitioning(false);
        isSlidingRef.current = false;
      }, 320);
    } else if (total >= W * 0.25) {
      const target = prevIndexRef.current;
      dragXRef.current = W;
      setDragX(W);
      window.setTimeout(() => {
        setCurrentIndex(target);
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

  const goPrev = useCallback(() => {
    setScaleSync(1);
    setPosition({ x: 0, y: 0 });
    slideBy(-1);
  }, [slideBy]);

  const goNext = useCallback(() => {
    setScaleSync(1);
    setPosition({ x: 0, y: 0 });
    slideBy(1);
  }, [slideBy]);

  const settleDragRef = useRef(settleDrag);
  useEffect(() => { settleDragRef.current = settleDrag; }, [settleDrag]);

  // Keyboard handlers
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "0") { resetZoom(); setDragX(0); dragXRef.current = 0; }
      if (e.key === "+" || e.key === "=") setScaleSync((s) => Math.min(s + 0.25, 5));
      if (e.key === "-") setScaleSync((s) => Math.max(s - 0.25, 0.5));
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [close, goPrev, goNext, resetZoom]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 移动端系统返回键：打开灯箱时压入一条历史记录，让「返回」用来关闭灯箱，
  // 而不是直接退回上一页（首页/之前浏览的页面）。系统返回触发 popstate →
  // 先关闭灯箱，再重新压入标记，让浏览器停留在灯箱所在页面而非退出当前路由。
  const backHandledRef = useRef(false);
  useEffect(() => {
    const marker = { __biliLightbox: true };
    window.history.pushState(marker, "");
    const onPop = () => {
      if (backHandledRef.current) return;
      backHandledRef.current = true;
      close();
      window.history.pushState(marker, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [close]);

  // Initialize index
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScaleSync(1);
    setPosition({ x: 0, y: 0 });
    dragXRef.current = 0;
    setDragX(0);
  }, [initialIndex]);

  // Mouse wheel zoom - use non-passive listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScaleSync((s) => Math.min(Math.max(s + delta, 0.5), 5));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Pointer + Touch 统一交互。
  // - 鼠标（pointer 事件）：scale<=1 时横向拖拽切换相册（相邻页预览），scale>1 时拖动平移。
  // - 触摸：单指拖动（同逻辑），双指捏合缩放。
  // 用原生监听以便非 passive + setPointerCapture；React 合成 onTouch* 是 passive，preventDefault 无效。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 容器宽度（轨道布局 + 拖拽结算需要）
    const measure = () => {
      trackWidthRef.current = container.clientWidth || 0;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);

    // ---- 鼠标/手势（Pointer）----
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      pointerOnImageRef.current = !!t.closest("img");
      if (t.closest("button") || t.closest("a")) return;
      if (isSlidingRef.current) return;
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      dragStartXRef.current = e.clientX;
      dragStartYRef.current = e.clientY;
      if (isZoomedScale(scaleRef.current)) {
        dragBaseXRef.current = posRef.current.x;
        dragBaseYRef.current = posRef.current.y;
      } else {
        dragBaseXRef.current = dragXRef.current;
        dragBaseYRef.current = 0;
      }
      setInteracting(true);
      container.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      const dy = e.clientY - dragStartYRef.current;
      if (!dragMovedRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        dragMovedRef.current = true;
      }
      if (isZoomedScale(scaleRef.current)) {
        setPosition({ x: dragBaseXRef.current + dx, y: dragBaseYRef.current + dy });
      } else {
        const W = trackWidthRef.current || 0;
        if (!W) return;
        const next = Math.max(-W, Math.min(W, dragBaseXRef.current + dx));
        dragXRef.current = next;
        setDragX(next);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setInteracting(false);
      if (dragMovedRef.current) {
        if (!isZoomedScale(scaleRef.current)) settleDragRef.current();
        window.setTimeout(() => { dragMovedRef.current = false; }, 0);
      }
      // 鼠标双击缩放不在这处理：改用原生 dblclick（详情见下），
      // 避免浏览器对两次 click 合成的 dblclick 与本处判定双触发。
    };

    // 鼠标双击缩放（原生 dblclick，浏览器按平台阈值判定，最可靠）。
    // 触摸缩放的唯一入口是 touchend 的 handleTap；移动端浏览器也会为快速两次
    // 触摸合成 dblclick，故带触摸时间窗兜底：最近 800ms 内有触摸则忽略，
    // 防止触摸双击在这里重复 toggle。
    const onMouseDblClick = (e: MouseEvent) => {
      if (e.detail !== 2) return;
      if (Date.now() - lastTouchTimeRef.current < 800) return;
      e.preventDefault();
      e.stopPropagation();
      if (isZoomedScale(scaleRef.current)) {
        resetZoom();
      } else {
        setScaleSync(2.5);
        setPosition({ x: 0, y: 0 });
      }
    };

    // ---- 触摸（Touch Events）----
    const dist = (pa?: { clientX: number; clientY: number }, pb?: { clientX: number; clientY: number }) =>
      pa && pb ? Math.hypot(pa.clientX - pb.clientX, pa.clientY - pb.clientY) : 0;

    // scale 接近 1（±5%）即视为相册普通模式：单指拖动 = 切换图片；
    // 否则为缩放模式：单指拖动 = 平移。避免 pinch 残留浮点（如 1.0000001）导致永远进入缩放平移。
    const isZoomedScale = (s: number) => Math.abs(s - 1) > 0.05;

    const onTouchStart = (e: TouchEvent) => {
      lastTouchTimeRef.current = Date.now();
      const t = e.touches;
      if (t.length >= 2) {
        // 双指 = 捏合缩放（无论之前在拖动什么都立即转入 pinch）
        e.preventDefault();
        pinchActiveRef.current = true;
        setIsPinching(true);
        setInteracting(true);
        pinchDistanceRef.current = dist(t[0], t[1]);
        // 转入缩放时轨道必须归位（轨道偏移会随 zoomed 语义残留，导致当前页偏出屏幕）
        dragXRef.current = 0;
        setDragX(0);
        isDraggingRef.current = false;
        dragMovedRef.current = false;
        return;
      }
      if (t.length === 1) {
        // 单指 = 拖动（pinch 结束残留的手指也走这里重新开启拖动）
        pinchActiveRef.current = false;
        setIsPinching(false);
        isDraggingRef.current = true;
        dragMovedRef.current = false;
        dragStartXRef.current = t[0].clientX;
        dragStartYRef.current = t[0].clientY;
        if (isZoomedScale(scaleRef.current)) {
          dragBaseXRef.current = posRef.current.x;
          dragBaseYRef.current = posRef.current.y;
        } else {
          dragBaseXRef.current = dragXRef.current;
          dragBaseYRef.current = 0;
        }
        setInteracting(true);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches;
      if (t.length >= 2) {
        if (!pinchActiveRef.current) {
          // 单指拖动过程中又落下第二指：转入捏合
          pinchActiveRef.current = true;
          setIsPinching(true);
          setInteracting(true);
          pinchDistanceRef.current = dist(t[0], t[1]);
          dragXRef.current = 0;
          setDragX(0);
          isDraggingRef.current = false;
          dragMovedRef.current = false;
        }
        // 增量式缩放（与旧实现一致）：每次捏合位移按 0.01 倍累加到 scale，
        // 连续跟手、无跳档。围绕屏幕中心缩放。
        const d = dist(t[0], t[1]);
        const delta = (d - pinchDistanceRef.current) * 0.01;
        pinchDistanceRef.current = d;
        setScaleSync((s) => Math.min(Math.max(s + delta, 0.5), 5));
        return;
      }
      if (t.length !== 1) return;
      if (!isDraggingRef.current) return;
      // pinch 期间若还有残留单指移动，忽略（等待 touchend 重新开启拖动）
      const dx = t[0].clientX - dragStartXRef.current;
      const dy = t[0].clientY - dragStartYRef.current;
      if (!dragMovedRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        dragMovedRef.current = true;
      }
      if (isZoomedScale(scaleRef.current)) {
        setPosition({ x: dragBaseXRef.current + dx, y: dragBaseYRef.current + dy });
      } else {
        const W = trackWidthRef.current || 0;
        if (!W) return;
        const next = Math.max(-W, Math.min(W, dragBaseXRef.current + dx));
        dragXRef.current = next;
        setDragX(next);
      }
    };

        // ---- 双击缩放统一判定（pending 状态机）----
    // 唯一缩放 toggle 入口：原生 touchend（触摸）与 pointerup（鼠标）复用此函数。
    // React 合成 onDoubleClick 已移除——移动端浏览器对两次 tap 也会合成 dblclick，
    // 若保留会导致「原生判定一次 + dblclick 一次」双 toggle 竞态（双击太快变 250% 的根因）。
    // 规则：
    // - 第一下 tap：设 300ms pending。期间无第二下 → 单击，到期作废，永不触发缩放。
    // - 300ms 内第二下 tap：成立双击 → toggle（方向只由 scaleRef 决定，无渲染滞后）；
    //   进入 350ms busy，期间任何点击全部忽略（过滤双击后的连击/单击误判）。
    const handleTap = () => {
      const now = Date.now();
      const sinceLastDouble = now - lastDoubleTapRef.current;
      if (tapPendingRef.current) {
        // 第二下：取消 pending，成立双击
        if (tapPendingTimerRef.current) {
          clearTimeout(tapPendingTimerRef.current);
          tapPendingTimerRef.current = null;
        }
        tapPendingRef.current = false;
        if (sinceLastDouble > 350) {
          if (isZoomedScale(scaleRef.current)) {
            resetZoom();
          } else {
            setScaleSync(2.5);
            setPosition({ x: 0, y: 0 });
          }
          lastDoubleTapRef.current = now;
        }
      } else if (sinceLastDouble <= 350) {
        // busy 冷却期：双击后 350ms 内的点击全部忽略（也不设 pending）
      } else {
        // 第一下：设 pending，300ms 后作废
        tapPendingRef.current = true;
        if (tapPendingTimerRef.current) clearTimeout(tapPendingTimerRef.current);
        tapPendingTimerRef.current = setTimeout(() => {
          tapPendingRef.current = false;
          tapPendingTimerRef.current = null;
        }, 300);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.touches;
      const wasPinch = pinchActiveRef.current;

      // 捏合期间（手指多于一根或正在捏合）：只做记录，不结算
      if (t.length >= 2) return;

      if (wasPinch) {
        // 捏合结束（剩余 0 或 1 根手指都算结束）
        pinchActiveRef.current = false;
        setIsPinching(false);
        setInteracting(false);
        isDraggingRef.current = false;
        dragMovedRef.current = false;
        // 保留当前缩放比例不跳档；position 仅在接近 100% 时归零，回到相册切换模式
        if (!isZoomedScale(scaleRef.current)) setPosition({ x: 0, y: 0 });
        // 清掉可能的 pending 双击：pinch 抬手不该与之前/之后的单击凑成双击
        const tapTimer = tapPendingTimerRef.current;
        if (tapTimer) {
          clearTimeout(tapTimer);
          tapPendingTimerRef.current = null;
        }
        tapPendingRef.current = false;
        // 若还剩一根手指，重新以该手指开启单指拖动
        if (t.length === 1) {
          pinchActiveRef.current = false;
          isDraggingRef.current = true;
          dragMovedRef.current = false;
          dragStartXRef.current = t[0].clientX;
          dragStartYRef.current = t[0].clientY;
          if (isZoomedScale(scaleRef.current)) {
            dragBaseXRef.current = posRef.current.x;
            dragBaseYRef.current = posRef.current.y;
          } else {
            dragBaseXRef.current = dragXRef.current;
            dragBaseYRef.current = 0;
          }
          setInteracting(true);
        }
        return;
      }

      // 非捏合：全部手指抬起后结算拖动
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;
      setInteracting(false);
      if (wasDragging && dragMovedRef.current) {
        if (!isZoomedScale(scaleRef.current)) settleDragRef.current();
        window.setTimeout(() => { dragMovedRef.current = false; }, 0);
        return;
      }
      if (dragMovedRef.current) { dragMovedRef.current = false; return; }
      // 未移动 = tap：双击缩放判定（handleTap 状态机）。
      // pinch 结束时已清 pending，抬手不会作为单击起点影响下次双击。
      handleTap();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);
    container.addEventListener("dblclick", onMouseDblClick);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      container.removeEventListener("dblclick", onMouseDblClick);
      ro.disconnect();
    };
  }, [resetZoom]);

  // 灯箱打开期间禁用浏览器原生页面捏合缩放（双保险）
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", preventDefault, { passive: false });
    return () => document.removeEventListener("touchmove", preventDefault);
  }, []);

  // 缩放状态：接近 100%（±5%）即视为相册普通模式（三页轨道拖拽切换），
  // 否则（无论放大还是缩小）进入单页缩放模式。
  const zoomed = Math.abs(scale - 1) > 0.05;
  const prevIdx = prevIndexRef.current;
  const nextIdx = nextIndexRef.current;
  // 恒为三页轨道：缩放（zoomed）只改变交互语义（拖动=平移），不重建 DOM，
  // 避免 pinch 跨过 1±0.05 阈值瞬间闪顿/缩放中断。
  const display = [prevIdx, currentIndex, nextIdx];

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] select-none overflow-hidden"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", touchAction: "none", cursor: zoomed ? "grab" : "grab" }}
      onClick={(e) => {
        if (dragMovedRef.current) { dragMovedRef.current = false; return; }
        if (pointerOnImageRef.current) { pointerOnImageRef.current = false; return; }
        close();
      }}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); close(); }}
        className="absolute right-4 top-4 z-[210] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Zoom controls */}
      <div className="absolute right-4 top-16 z-[210] flex flex-col gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setScaleSync((s) => Math.min(s + 0.25, 5)); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          title="放大 (+)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setScaleSync((s) => Math.max(s - 0.25, 0.5)); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          title="缩小 (-)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          title="重置缩放 (0)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
          </svg>
        </button>
      </div>

      {/* Prev button */}
      {images.length > 1 && !zoomed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-4 top-1/2 z-[210] hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white sm:flex"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Next button */}
      {images.length > 1 && !zoomed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-4 top-1/2 z-[210] hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white sm:flex"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* 相册式横向轨道：拖拽时可预览到前后相邻页，松手滑入相邻页（循环）或回弹 */}
      <div
        className="absolute inset-0 z-10 flex items-center"
        style={{
          transform: `translateX(calc(-100% + ${dragX}px))`,
          transition: transitioning && !zoomed ? "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}
      >
        {display.map((idx, slot) => {
          const isCurrent = idx === currentIndex;
          return (
            <div
              key={`page-slot-${slot}`}
              className="relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden"
              style={
                isCurrent
                  ? {
                      // scale 在 translate 之后（CSS 矩阵右手先应用）：translate 保持常量偏移，
                      // 不会随 scale 放大；transformOrigin 用视口中心，缩放始终围绕屏幕中心，
                      // 放大平移后再缩小不会让图片飞出屏幕。
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                      transformOrigin: "50% 50%",
                      transition: interacting ? "none" : "transform 0.12s ease-out",
                    }
                  : undefined
              }
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[idx]}
                alt={`图片 ${idx + 1}`}
                className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain"
                draggable={false}
              />
            </div>
          );
        })}
      </div>

      {/* Counter */}
      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white/90">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Zoom level indicator */}
      {zoomed && (
        <div className="pointer-events-none absolute bottom-6 right-6 z-[100] rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80">
          {Math.round(scale * 100)}%
        </div>
      )}
    </motion.div>
  );
}