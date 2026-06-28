"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import VideoCard from "@/components/video/video-card";
import { motion } from "framer-motion";
import { optimizedCover } from "@/lib/image";

interface Video {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string;
  author: { id: string; name: string };
  _count: { likes: number; favorites: number };
  matchField: "title" | "description" | "author";
  positions: number[];
}

interface CommentResult {
  id: string;
  content: string;
  createdAt: string;
  video: { id: string; title: string; coverUrl: string };
  author: { id: string; name: string };
  parent: { id: string; content: string; author: { name: string } } | null;
  matchField: "content" | "parent";
  positions: number[];
}

function HighlightText({ text, positions }: { text: string; positions: number[] }) {
  const posSet = new Set(positions);
  return (
    <>
      {text.split("").map((char, i) =>
        posSet.has(i) ? (
          <span key={i} className="font-bold text-[#FB7299]">{char}</span>
        ) : (
          <span key={i}>{char}</span>
        )
      )}
    </>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") || "";
  const type = (searchParams.get("type") as "video" | "comment") || "video";
  const [videos, setVideos] = useState<Video[]>([]);
  const [comments, setComments] = useState<CommentResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    if (!q) {
      setVideos([]);
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}`);
      const data = await res.json();
      if (type === "video") {
        setVideos(data);
      } else {
        setComments(data);
      }
    } catch {
      setVideos([]);
      setComments([]);
    }
    setLoading(false);
  }, [q, type]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const switchType = (newType: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("type", newType);
    router.push(`/search?${params.toString()}`);
  };

  const getMatchLabel = (field: string) => {
    const map: Record<string, string> = {
      title: "标题",
      description: "简介",
      author: "UP主",
      content: "评论内容",
      parent: "被回复内容",
    };
    return map[field] || field;
  };

  return (
    <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
          {q ? `搜索结果：${q}` : "搜索"}
        </h1>
        {q && (
          <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => switchType("video")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                type === "video"
                  ? "bg-[#FB7299] text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              搜索视频
            </button>
            <button
              onClick={() => switchType("comment")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                type === "comment"
                  ? "bg-[#FB7299] text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              搜索评论
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-1 h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : !q ? (
        <div className="py-20 text-center">
          <div className="mb-4 text-6xl">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto h-16 w-16 text-zinc-300 dark:text-zinc-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-medium text-zinc-700 dark:text-zinc-300">搜索你想看的内容</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">输入关键词搜索视频或评论</p>
        </div>
      ) : type === "video" ? (
        videos.length === 0 ? (
          <div className="text-center text-zinc-500 dark:text-zinc-400">
            未找到相关视频，<Link href="/" className="text-[#FB7299] hover:underline">返回首页</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">找到 {videos.length} 个视频</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {videos.map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <VideoCard video={video} />
                  <div className="mt-1 px-1">
                    <span className="text-[10px] text-zinc-400">
                      匹配{getMatchLabel(video.matchField)}：
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">
                      {video.matchField === "title" && <HighlightText text={video.title} positions={video.positions} />}
                      {video.matchField === "description" && <HighlightText text={video.description || ""} positions={video.positions} />}
                      {video.matchField === "author" && (
                        <>UP主 <HighlightText text={video.author.name} positions={video.positions} /></>
                      )}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )
      ) : comments.length === 0 ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400">
          未找到相关评论
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">找到 {comments.length} 条评论</p>
          {comments.map((comment, index) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link href={`/video/${comment.video.id}`} className="h-32 w-full overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 sm:h-20 sm:w-32 sm:shrink-0">
                  <img src={optimizedCover(comment.video.coverUrl, 400)} alt={comment.video.title} width={128} height={72} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{comment.author.name}</span>
                    <span>·</span>
                    <span>{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
                    <span>·</span>
                    <span>匹配{getMatchLabel(comment.matchField)}</span>
                  </div>

                  {comment.parent && (
                    <div className="mt-2 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                      <span className="font-medium">{comment.parent.author.name}：</span>
                      {comment.matchField === "parent" ? (
                        <HighlightText text={comment.parent.content} positions={comment.positions} />
                      ) : (
                        <>{comment.parent.content.length > 80 ? comment.parent.content.slice(0, 80) + "..." : comment.parent.content}</>
                      )}
                    </div>
                  )}

                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {comment.matchField === "content" ? (
                      <HighlightText text={comment.content} positions={comment.positions} />
                    ) : (
                      <>{comment.content.length > 100 ? comment.content.slice(0, 100) + "..." : comment.content}</>
                    )}
                  </p>

                  <Link href={`/video/${comment.video.id}`} className="mt-2 inline-block text-xs text-[#FB7299] hover:underline">
                    {comment.video.title.length > 40 ? comment.video.title.slice(0, 40) + "..." : comment.video.title}
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="text-center text-zinc-500 dark:text-zinc-400">加载中...</div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
