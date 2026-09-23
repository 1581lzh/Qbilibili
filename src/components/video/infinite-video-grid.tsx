"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import VideoCard from "@/components/video/video-card";
import { VideoWithAuthor } from "@/types";

const PAGE_SIZE = 20;

export default function InfiniteVideoGrid({ initialVideos }: { initialVideos: VideoWithAuthor[] }) {
  const [videos, setVideos] = useState(initialVideos);
  // 首屏这一批保留入场动画，分页追加的卡片直接显示，避免快速下滑时新旧动画混杂
  const [initialCount] = useState(initialVideos.length);
  const [cursor, setCursor] = useState<string | null>(
    initialVideos.length >= PAGE_SIZE ? initialVideos[initialVideos.length - 1]?.id ?? null : null
  );
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/videos?cursor=${cursor}&limit=${PAGE_SIZE}`);
      if (!res.ok) return;
      const data: VideoWithAuthor[] = await res.json();
      if (data.length === 0) {
        setCursor(null);
      } else {
        setVideos(prev => [...prev, ...data]);
        setCursor(data[data.length - 1].id);
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {videos.map((video, index) => (
          <VideoCard key={video.id} video={video} index={index} animate={index < initialCount} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-4" />
      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-[#FB7299]" />
        </div>
      )}
    </>
  );
}
