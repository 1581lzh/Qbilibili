"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { setAutoPlayVideo } from "@/lib/signals";
import { avatarColorFor } from "@/lib/avatar";
import EmojiText from "@/components/ui/emoji-text";
import PostTypeBadge from "@/components/video/post-type-badge";

interface Video {
  id: string;
  title: string;
  coverUrl: string;
  postType?: string | null;
  author: { id: string; name: string };
  _count: { likes: number; favorites: number };
}

export default function VideoCard({
  video,
  index = 0,
  animate = true,
}: {
  video: Video;
  index?: number;
  animate?: boolean;
}) {
  const avatarColor = useMemo(() => avatarColorFor(video.author.name), [video.author.name]);

  return (
    <motion.div
      className="group block"
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animate ? (index % 20) * 0.05 : 0, ease: "easeOut" }}
    >
      <Link
        href={`/video/${video.id}`}
        onClick={() => setAutoPlayVideo(video.id)}
      >
        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
          <Image
            src={video.coverUrl}
            alt={video.title}
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
          <PostTypeBadge postType={video.postType} />
        </div>
        <div className="mt-2 flex gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor}`}>
            {video.author.name?.[0] || "U"}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-[#FB7299]">
              <EmojiText text={video.title} />
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
