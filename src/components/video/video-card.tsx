"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { optimizedCover } from "@/lib/image";
import { setAutoPlayVideo } from "@/lib/signals";

interface Video {
  id: string;
  title: string;
  coverUrl: string;
  author: { id: string; name: string };
  _count: { likes: number; favorites: number };
}

const AVATAR_COLORS = [
  "bg-pink-500", "bg-violet-500", "bg-blue-500", "bg-cyan-500",
  "bg-green-500", "bg-amber-500", "bg-red-500", "bg-indigo-500",
];

export default function VideoCard({ video, index = 0 }: { video: Video; index?: number }) {
  const avatarColor = useMemo(() => {
    let h = 0;
    for (let i = 0; i < video.author.name.length; i++) {
      h = video.author.name.charCodeAt(i) + ((h << 5) - h);
    }
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }, [video.author.name]);

  return (
    <motion.div
      className="group block"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
    >
      <Link
        href={`/video/${video.id}`}
        onClick={() => setAutoPlayVideo(video.id)}
      >
        <div className="aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
          <img
            src={optimizedCover(video.coverUrl)}
            alt={video.title}
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor}`}>
            {video.author.name?.[0] || "U"}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-[#FB7299]">
              {video.title}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {video.author.name} · {video._count.likes} 赞 · {video._count.favorites} 收藏
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
