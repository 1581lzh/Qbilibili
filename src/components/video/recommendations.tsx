"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { optimizedCover } from "@/lib/image";
import { cachedFetch } from "@/lib/fetch-cache";
import { setAutoPlayVideo } from "@/lib/signals";

interface Video {
  id: string;
  title: string;
  coverUrl: string | null;
  author: { id: string; name: string };
}

export default function Recommendations({ currentVideoId }: { currentVideoId: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    cachedFetch(`/api/videos/recommendations?currentVideoId=${currentVideoId}`, 60000)
      .then((data) => { setVideos(data as Video[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentVideoId]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-2 animate-pulse">
        <div className="h-20 w-32 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    ))}</div>;
  }

  return (
    <div className="space-y-4">
      {videos.map((v, index) => (
        <motion.a
          key={v.id}
          href={`/video/${v.id}`}
          onClick={() => setAutoPlayVideo(v.id)}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.08 }}
          className="flex gap-2 rounded-lg p-1 -m-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            {v.coverUrl ? (
              <img src={optimizedCover(v.coverUrl, 400)} alt="" width={128} height={72} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                无封面
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {v.title}
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {v.author.name}
            </p>
          </div>
        </motion.a>
      ))}
      {videos.length === 0 && (
        <p className="text-sm text-zinc-400">暂无其他视频</p>
      )}
    </div>
  );
}
