"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import VideoPlayer from "@/components/video/video-player";
import VideoLikeButton from "@/components/video/video-like-button";
import VideoFavoriteButton from "@/components/video/video-favorite-button";
import VideoDeleteButton from "@/components/video/video-delete-button";

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

interface VideoInfo {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  videoUrl: string;
  vodVideoId?: string | null;
  author: { id: string; name: string };
  createdAt: Date | string;
  nextVideoId?: string | null;
  prevVideoId?: string | null;
}

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
}) {
  const [currentVideo, setCurrentVideo] = useState(video);
  const [currentVideoId, setCurrentVideoId] = useState(video.id);
  const [currentNextVideoId, setCurrentNextVideoId] = useState(nextVideoId);
  const [currentPrevVideoId, setCurrentPrevVideoId] = useState(prevVideoId);
  const [currentLikeCount, setCurrentLikeCount] = useState(initialLikeCount);
  const [currentLiked, setCurrentLiked] = useState(initialLiked);
  const [currentFavoriteCount, setCurrentFavoriteCount] = useState(initialFavoriteCount);
  const [currentFavorited, setCurrentFavorited] = useState(initialFavorited);

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
      <motion.div
        className="lg:col-span-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <VideoPlayer
            initialVideo={currentVideo}
            initialNextVideoId={currentNextVideoId}
            initialPrevVideoId={currentPrevVideoId}
            userId={userId}
            onVideoChange={(v) => {
              setCurrentVideo(v);
              setCurrentVideoId(v.id);
              setCurrentNextVideoId(v.nextVideoId);
              setCurrentPrevVideoId(v.prevVideoId);
              if (v.likeCount !== undefined) setCurrentLikeCount(v.likeCount);
              if (v.liked !== undefined) setCurrentLiked(v.liked);
              if (v.favoriteCount !== undefined) setCurrentFavoriteCount(v.favoriteCount);
              if (v.favorited !== undefined) setCurrentFavorited(v.favorited);
            }}
          />
        </div>
        <div className="mt-3 sm:mt-4">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
            {currentVideo.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:gap-4 sm:text-sm">
            <Link href={`/user/${currentVideo.author.id}`} className="flex items-center gap-2 hover:opacity-80">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FB7299] text-[10px] font-bold text-white sm:h-8 sm:w-8 sm:text-xs">
                {currentVideo.author.name?.[0] || "U"}
              </div>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentVideo.author.name}</span>
            </Link>
            <span>{new Date(currentVideo.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
          {currentVideo.description && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 sm:mt-3 sm:text-base">
              {currentVideo.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 sm:mt-4 sm:gap-3">
            <VideoLikeButton key={`like-${currentVideo.id}`} videoId={currentVideo.id} initialCount={currentLikeCount} initialLiked={currentLiked} />
            <VideoFavoriteButton key={`fav-${currentVideo.id}`} videoId={currentVideo.id} initialCount={currentFavoriteCount} initialFavorited={currentFavorited} />
            {isOwner && <VideoDeleteButton videoId={currentVideo.id} />}
          </div>
        </div>
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:mt-6 sm:pt-6">
          <CommentSection videoId={currentVideo.id} />
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
        <Recommendations currentVideoId={currentVideoId} />
      </motion.div>
    </div>
  );
}
