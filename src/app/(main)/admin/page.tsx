"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { optimizedCover } from "@/lib/image";

interface Stats {
  totalUsers: number;
  totalVideos: number;
  totalComments: number;
  totalLikes: number;
  totalCommentLikes: number;
  totalFavorites: number;
}

interface UserItem {
  id: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  _count: { videos: number; comments: number; likes: number; favorites: number };
}

interface VideoItem {
  id: string;
  title: string;
  coverUrl: string;
  views: number;
  createdAt: string;
  author: { id: string; name: string };
  _count: { likes: number; comments: number; favorites: number };
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
  video: { id: string; title: string; coverUrl: string };
  _count: { likes: number; replies: number };
}

interface LikeItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string };
  video: { id: string; title: string; coverUrl: string };
}

interface CommentLikeItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string };
  comment: { id: string; content: string; video: { id: string; title: string; coverUrl: string } };
}

interface FavoriteItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string };
  video: { id: string; title: string; coverUrl: string };
}

const TAB_SLIDE_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -60 }),
};

const TAB_ORDER = ["overview", "users", "videos", "comments", "likes", "comment-likes", "favorites"] as const;
type Tab = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "总览",
  users: "用户管理",
  videos: "视频管理",
  comments: "评论管理",
  likes: "视频点赞",
  "comment-likes": "评论点赞",
  favorites: "收藏",
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [commentLikes, setCommentLikes] = useState<CommentLikeItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: string; name: string } | null>(null);
  const [renormalizeProgress, setRenormalizeProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    processing: number;
    pending: number;
    isRunning: boolean;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (session?.user?.name !== "LZH" && status === "authenticated") router.push("/");
  }, [session, status, router]);

  const fetchTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/${tab === "overview" ? "stats" : tab}`);
      if (res.ok) {
        const data = await res.json();
        if (tab === "overview") setStats(data);
        else if (tab === "users") setUsers(data);
        else if (tab === "videos") setVideos(data);
        else if (tab === "comments") setComments(data);
        else if (tab === "likes") setLikes(data);
        else if (tab === "comment-likes") setCommentLikes(data);
        else if (tab === "favorites") setFavorites(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.name === "LZH") fetchTab(activeTab);
  }, [activeTab, session, fetchTab]);

  // Restore renormalize state on page load
  useEffect(() => {
    if (session?.user?.name !== "LZH") return;

    const checkProgress = async () => {
      try {
        const res = await fetch("/api/audio/progress");
        if (res.ok) {
          const data = await res.json();
          setRenormalizeProgress(data);
        }
      } catch {}
    };

    checkProgress();
  }, [session]);

  // Poll renormalize progress whenever we have progress data
  useEffect(() => {
    if (!renormalizeProgress) return;

    const pollProgress = async () => {
      try {
        const res = await fetch("/api/audio/progress");
        if (res.ok) {
          const data = await res.json();
          setRenormalizeProgress(data);
        }
      } catch {}
    };

    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [renormalizeProgress]);

  const handleTabChange = (tab: Tab) => {
    const oldIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(tab);
    setSlideDir(newIdx > oldIdx ? 1 : -1);
    setActiveTab(tab);
    setSearchQuery("");
  };

  const handleDelete = async () => {
    if (!confirmAction) return;
    const endpointMap: Record<string, string> = {
      user: "users",
      video: "videos",
      comment: "comments",
      like: "likes",
      "comment-like": "comment-likes",
      favorite: "favorites",
    };
    const bodyMap: Record<string, Record<string, string>> = {
      user: { userId: confirmAction.id },
      video: { videoId: confirmAction.id },
      comment: { commentId: confirmAction.id },
      like: { likeId: confirmAction.id },
      "comment-like": { likeId: confirmAction.id },
      favorite: { favoriteId: confirmAction.id },
    };
    await fetch(`/api/admin/${endpointMap[confirmAction.type]}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyMap[confirmAction.type]),
    });
    setConfirmAction(null);
    fetchTab(activeTab);
  };

  const handleRenormalize = async () => {
    try {
      const res = await fetch("/api/audio/re-normalize", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically set progress so polling starts immediately
        setRenormalizeProgress({ total: data.addedToQueue, completed: 0, failed: 0, processing: 2, pending: data.addedToQueue, isRunning: true });
      } else {
        alert("重新标准化失败: " + (data.error || "未知错误"));
      }
    } catch (error) {
      alert("请求失败");
    }
  };

  const handleResetProgress = async () => {
    try {
      const res = await fetch("/api/audio/re-normalize?reset=true", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRenormalizeProgress(null);
      }
    } catch {}
  };

  if (status === "loading" || session?.user?.name !== "LZH") {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-zinc-500">加载中...</p></div>;
  }

  const q = searchQuery.toLowerCase();
  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(q));
  const filteredVideos = videos.filter((v) => v.title.toLowerCase().includes(q) || v.author.name.toLowerCase().includes(q));
  const filteredComments = comments.filter((c) => c.content.toLowerCase().includes(q) || c.author.name.toLowerCase().includes(q) || c.video.title.toLowerCase().includes(q));
  const filteredLikes = likes.filter((l) => l.user.name.toLowerCase().includes(q) || l.video.title.toLowerCase().includes(q));
  const filteredCommentLikes = commentLikes.filter((cl) => cl.user.name.toLowerCase().includes(q) || cl.comment.content.toLowerCase().includes(q));
  const filteredFavorites = favorites.filter((f) => f.user.name.toLowerCase().includes(q) || f.video.title.toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">管理面板</h1>

        <div className="mb-6 flex flex-wrap gap-2">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-[#FB7299] text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {activeTab !== "overview" && (
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-[#FB7299] dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-[#FB7299]"
            />
          </div>
        )}

        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={slideDir}>
            <motion.div
              key={activeTab}
              custom={slideDir}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {loading ? (
                <p className="py-10 text-center text-zinc-500">加载中...</p>
              ) : (
                <>
                  {activeTab === "overview" && stats && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                        {[
                          { label: "用户", value: stats.totalUsers },
                          { label: "视频", value: stats.totalVideos },
                          { label: "评论", value: stats.totalComments },
                          { label: "视频点赞", value: stats.totalLikes },
                          { label: "评论点赞", value: stats.totalCommentLikes },
                          { label: "收藏", value: stats.totalFavorites },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-800">
                            <p className="text-3xl font-bold text-[#FB7299]">{item.value}</p>
                            <p className="mt-1 text-sm text-zinc-500">{item.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">音频响度标准化</h3>
                            <p className="text-sm text-zinc-500">将所有已标准化的视频重新处理</p>
                          </div>
                          <div className="flex gap-2">
                            {renormalizeProgress && renormalizeProgress.isRunning && (
                              <button
                                onClick={handleResetProgress}
                                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              >
                                重置进度
                              </button>
                            )}
                            <button
                              onClick={handleRenormalize}
                              disabled={renormalizeProgress?.isRunning}
                              className="rounded-md bg-[#FB7299] px-4 py-2 text-sm font-medium text-white hover:bg-[#FB7299]/90 disabled:opacity-50"
                            >
                              {renormalizeProgress?.isRunning ? "处理中..." : "重新标准化"}
                            </button>
                          </div>
                        </div>
                        {renormalizeProgress && renormalizeProgress.isRunning && (
                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="text-zinc-600 dark:text-zinc-400">
                                进度: {renormalizeProgress.completed + renormalizeProgress.failed} / {renormalizeProgress.total}
                              </span>
                              <span className="text-zinc-500">
                                {Math.round(((renormalizeProgress.completed + renormalizeProgress.failed) / renormalizeProgress.total) * 100)}%
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                              <div
                                className="h-full rounded-full bg-[#FB7299] transition-all duration-300"
                                style={{
                                  width: `${((renormalizeProgress.completed + renormalizeProgress.failed) / renormalizeProgress.total) * 100}%`,
                                }}
                              />
                            </div>
                            <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                              <span>已完成: {renormalizeProgress.completed}</span>
                              <span>进行中: {renormalizeProgress.processing}</span>
                              <span>等待中: {renormalizeProgress.pending}</span>
                              <span className="text-red-500">失败: {renormalizeProgress.failed}</span>
                            </div>
                          </div>
                        )}
                        {renormalizeProgress && !renormalizeProgress.isRunning && renormalizeProgress.total > 0 && (
                          <div className="mt-4 text-sm text-zinc-500">
                            上次处理完成: 成功 {renormalizeProgress.completed} 个, 失败 {renormalizeProgress.failed} 个
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "users" && (
                    <div className="space-y-2">
                      {filteredUsers.map((u) => (
                        <div key={u.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FB7299] text-lg font-bold text-white">
                            {u.name[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{u.name}</p>
                            <p className="text-xs text-zinc-500">视频 {u._count.videos} · 评论 {u._count.comments} · 点赞 {u._count.likes} · 收藏 {u._count.favorites}</p>
                          </div>
                          <button onClick={() => setConfirmAction({ type: "user", id: u.id, name: u.name })} className="shrink-0 rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">删除</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "videos" && (
                    <div className="space-y-2">
                      {filteredVideos.map((v) => (
                        <div key={v.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <img src={optimizedCover(v.coverUrl, 300)} alt={v.title} width={96} height={64} loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{v.title}</p>
                            <p className="text-xs text-zinc-500">UP {v.author.name} · 播放 {v.views} · 点赞 {v._count.likes} · 评论 {v._count.comments} · 收藏 {v._count.favorites}</p>
                          </div>
                          <button onClick={() => setConfirmAction({ type: "video", id: v.id, name: v.title })} className="shrink-0 rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">删除</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "comments" && (
                    <div className="space-y-2">
                      {filteredComments.map((c) => (
                        <div key={c.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <img src={optimizedCover(c.video.coverUrl, 300)} alt={c.video.title} width={96} height={64} loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">{c.content}</p>
                            <p className="text-xs text-zinc-500">用户 {c.author.name} · 视频「{c.video.title}」 · 点赞 {c._count.likes} · 回复 {c._count.replies}</p>
                          </div>
                          <button onClick={() => setConfirmAction({ type: "comment", id: c.id, name: c.content.slice(0, 20) })} className="shrink-0 rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">删除</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "likes" && (
                    <div className="space-y-2">
                      {filteredLikes.map((l) => (
                        <div key={l.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <img src={optimizedCover(l.video.coverUrl, 300)} alt={l.video.title} width={96} height={64} loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{l.user.name} 点赞了视频「{l.video.title}」</p>
                          </div>
                          <button onClick={() => setConfirmAction({ type: "like", id: l.id, name: `${l.user.name} → ${l.video.title}` })} className="shrink-0 rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">撤销</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "comment-likes" && (
                    <div className="space-y-2">
                      {filteredCommentLikes.map((cl) => (
                        <div key={cl.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <img src={optimizedCover(cl.comment.video.coverUrl, 300)} alt={cl.comment.video.title} width={96} height={64} loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{cl.user.name} 点赞了评论「{cl.comment.content.slice(0, 50)}」</p>
                            <p className="text-xs text-zinc-500">视频「{cl.comment.video.title}」</p>
                          </div>
                          <button onClick={() => setConfirmAction({ type: "comment-like", id: cl.id, name: `${cl.user.name} → ${cl.comment.content.slice(0, 20)}` })} className="shrink-0 rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">撤销</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "favorites" && (
                    <div className="space-y-2">
                      {filteredFavorites.map((f) => (
                        <div key={f.id} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
                          <img src={optimizedCover(f.video.coverUrl, 300)} alt={f.video.title} width={96} height={64} loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{f.user.name} 收藏了视频「{f.video.title}」</p>
                          </div>
                          <button onClick={() => setConfirmAction({ type: "favorite", id: f.id, name: `${f.user.name} → ${f.video.title}` })} className="shrink-0 rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600">取消</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-0 z-50"
              style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.5)" }}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-0 z-[51] flex items-center justify-center"
              onClick={() => setConfirmAction(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="mx-4 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
              >
                <p className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">确认删除</p>
                <p className="mb-4 text-sm text-zinc-500">确定要删除「{confirmAction.name}」吗？此操作不可撤销。</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmAction(null)} className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700">取消</button>
                  <button onClick={handleDelete} className="rounded-md bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600">确认删除</button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
