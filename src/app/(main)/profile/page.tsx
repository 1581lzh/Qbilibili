"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const AVATAR_COLORS = [
  "bg-pink-500", "bg-violet-500", "bg-blue-500", "bg-cyan-500",
  "bg-green-500", "bg-amber-500", "bg-red-500", "bg-indigo-500",
];

const TAB_SLIDE_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -60 }),
};

interface UserProfile {
  id: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  _count: { videos: number; likes: number; favorites: number; comments: number };
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  video: { id: string; title: string; coverUrl: string };
  parent: { id: string; content: string; author: { name: string } } | null;
  _count: { likes: number; replies: number };
}

interface VideoItem {
  id: string;
  title: string;
  coverUrl: string;
  author: { id: string; name: string };
  _count: { likes: number };
}

interface CommentLikeItem {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; avatar: string | null };
  video: { id: string; title: string; coverUrl: string };
  parent: { id: string; content: string; author: { name: string } } | null;
  _count: { likes: number; replies: number };
}

interface ReceivedLikeItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  comment: CommentLikeItem;
}

const AVATAR_COLORS_LIST = AVATAR_COLORS;

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "uploads" | "favorites" | "likes" | "comments">("uploads");
  const [favorites, setFavorites] = useState<VideoItem[]>([]);
  const [likes, setLikes] = useState<VideoItem[]>([]);
  const [uploads, setUploads] = useState<(VideoItem & { _count: { likes: number; comments: number } })[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [likedComments, setLikedComments] = useState<CommentLikeItem[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<ReceivedLikeItem[]>([]);
  const [likesSubTab, setLikesSubTab] = useState<"videos" | "liked-comments" | "received-likes">("videos");
  const [loading, setLoading] = useState(false);
  const slideDirRef = useRef<1 | -1>(1);
  const [, forceRender] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const TAB_ORDER: ("settings" | "uploads" | "favorites" | "likes" | "comments")[] = ["uploads", "likes", "favorites", "comments", "settings"];

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (session?.user?.id) {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((d) => {
          if (!d || d.error) {
            router.push("/");
            return;
          }
          setProfile(d);
          setName(d.name);
          const hash = window.location.hash.replace("#", "");
          if (["uploads", "favorites", "likes", "comments", "settings"].includes(hash)) {
            setActiveTab(hash as typeof activeTab);
            loadTab(hash);
          } else {
            loadTab("uploads");
          }
        });
    }
  }, [session, status, router]);

  const loadTab = useCallback(async (tab: string) => {
    const fromIdx = TAB_ORDER.indexOf(activeTabRef.current);
    const toIdx = TAB_ORDER.indexOf(tab as typeof activeTab);
    const dir = toIdx >= fromIdx ? 1 : -1;
    slideDirRef.current = dir;
    forceRender((n) => n + 1);
    setActiveTab(tab as typeof activeTab);
    setMessage("");
    if (tab === "favorites" && favorites.length === 0) {
      setLoading(true);
      const res = await fetch("/api/user/favorites");
      if (res.ok) setFavorites(await res.json());
      setLoading(false);
    }
    if (tab === "likes" && likes.length === 0) {
      setLoading(true);
      const res = await fetch("/api/user/likes");
      if (res.ok) setLikes(await res.json());
      setLoading(false);
    }
    if (tab === "likes" && likedComments.length === 0) {
      setLoading(true);
      const res = await fetch("/api/user/comment-likes");
      if (res.ok) setLikedComments(await res.json());
      setLoading(false);
    }
    if (tab === "likes" && receivedLikes.length === 0) {
      setLoading(true);
      const res = await fetch("/api/user/comment-received-likes");
      if (res.ok) setReceivedLikes(await res.json());
      setLoading(false);
    }
    if (tab === "uploads" && uploads.length === 0) {
      setLoading(true);
      const res = await fetch("/api/user/uploads");
      if (res.ok) setUploads(await res.json());
      setLoading(false);
    }
    if (tab === "comments" && comments.length === 0) {
      setLoading(true);
      const res = await fetch("/api/user/comments");
      if (res.ok) setComments(await res.json());
      setLoading(false);
    }
  }, [favorites, likes, likedComments, receivedLikes, uploads, comments]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (["settings", "uploads", "favorites", "likes", "comments"].includes(hash)) {
        loadTab(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [loadTab]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const body: Record<string, string> = {};
    if (name !== profile?.name) body.name = name;
    if (password) body.password = password;

    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setProfile((prev) => (prev ? { ...prev, name: data.name } : prev));
      setPassword("");
      setMessage("保存成功");
      update({ user: { name: data.name } });
    } else {
      const data = await res.json();
      setMessage(data.error || "保存失败");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    if (!confirmPassword) {
      setMessage("请输入密码以确认注销");
      return;
    }

    const res = await fetch("/api/user/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: confirmPassword }),
    });
    if (res.ok) {
      await fetch("/api/auth/custom-signout", { method: "POST" });
      window.location.href = "/";
    } else {
      const data = await res.json();
      setMessage(data.error || "注销失败");
    }
  };

  if (status === "loading" || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="text-center text-zinc-500">加载中...</div>
      </div>
    );
  }

  const hash = (() => {
    let h = 0;
    for (let i = 0; i < profile.name.length; i++) {
      h = profile.name.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h);
  })();
  const avatarColor = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  const handleDelete = async (videoId: string) => {
    if (!confirm("确定要删除这个视频吗？此操作不可恢复。")) return;
    const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    if (res.ok) {
      setUploads((prev) => prev.filter((v) => v.id !== videoId));
      setProfile((prev) => prev ? { ...prev, _count: { ...prev._count, videos: prev._count.videos - 1 } } : prev);
    } else {
      const data = await res.json();
      alert(data.error || "删除失败");
    }
  };

  const handleDeleteComment = async (commentId: string, videoId: string) => {
    if (!confirm("确定要删除这条评论吗？")) return;
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setProfile((prev) => prev ? { ...prev, _count: { ...prev._count, comments: prev._count.comments - 1 } } : prev);
    }
  };

  const renderVideoGrid = (videos: VideoItem[]) => {
    if (videos.length === 0) {
      return <div className="py-12 text-center text-zinc-500">暂无内容</div>;
    }
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {videos.map((v) => (
          <Link key={v.id} href={`/video/${v.id}`} className="group block" onClick={() => sessionStorage.setItem("autoPlayVideo", v.id)}>
            <div className="overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
              <img
                src={v.coverUrl}
                alt={v.title}
                className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[#FB7299]">
              {v.title}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">{v._count.likes} 赞</p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="flex items-center gap-3 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900 sm:gap-4 sm:p-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white sm:h-16 sm:w-16 sm:text-2xl ${avatarColor}`}>
          {profile.name[0]}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
            {profile.name}
          </h1>
          <p className="text-xs text-zinc-500 sm:text-sm">
            {profile._count.videos} 投稿 · {profile._count.likes} 获赞 · {profile._count.favorites} 收藏
          </p>
        </div>
      </div>

      <div className="relative mt-4 sm:mt-6">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex gap-0.5 sm:gap-1">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              onClick={() => loadTab(tab)}
              className={`relative shrink-0 whitespace-nowrap px-2.5 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                activeTab === tab ? "text-[#FB7299]" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {tab === "settings" && "设置"}
              {tab === "uploads" && `投稿(${profile._count.videos})`}
              {tab === "favorites" && `收藏(${profile._count.favorites})`}
              {tab === "likes" && `点赞(${profile._count.likes})`}
              {tab === "comments" && `评论(${profile._count.comments})`}
              {activeTab === tab && (
                <motion.span
                  layoutId="profile-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FB7299]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 sm:mt-6">
        <AnimatePresence mode="wait" custom={slideDirRef.current}>
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              custom={slideDirRef.current}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="max-w-md space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  用户名
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#FB7299] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  新密码（留空则不修改）
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#FB7299] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              {message && (
                <p className={`text-sm ${message.includes("成功") ? "text-green-500" : "text-red-500"}`}>
                  {message}
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[#FB7299] px-4 py-2 text-sm font-medium text-white hover:bg-[#FC8AB1] disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>

              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <h3 className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">危险操作</h3>
                <p className="mb-3 text-xs text-zinc-500">注销账号将删除你的所有数据，包括投稿视频、评论、点赞和收藏，此操作不可恢复。</p>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请输入密码以确认注销"
                  className="mb-3 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none dark:border-red-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={() => {
                    if (!confirmPassword) {
                      setMessage("请输入密码以确认注销");
                      return;
                    }
                    setDeleteError("");
                    setShowDeleteConfirm(true);
                  }}
                  disabled={!confirmPassword}
                  className="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  注销账号
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "uploads" && (
            <motion.div
              key="uploads"
              custom={slideDirRef.current}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {loading ? (
                <div className="py-12 text-center text-zinc-500">加载中...</div>
              ) : uploads.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  还没有投稿，<Link href="/upload" className="text-[#FB7299] hover:underline">去投稿</Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {uploads.map((v) => (
                    <div key={v.id} className="group block">
                       <Link href={`/video/${v.id}`} onClick={() => sessionStorage.setItem("autoPlayVideo", v.id)}>
                        <div className="overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                          <img
                            src={v.coverUrl}
                            alt={v.title}
                            className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[#FB7299]">
                          {v.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500">{v._count.likes} 赞 · {v._count.comments} 评论</p>
                      </Link>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="mt-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "favorites" && (
            <motion.div
              key="favorites"
              custom={slideDirRef.current}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {loading ? (
                <div className="py-12 text-center text-zinc-500">加载中...</div>
              ) : renderVideoGrid(favorites)}
            </motion.div>
          )}

          {activeTab === "likes" && (
            <motion.div
              key="likes"
              custom={slideDirRef.current}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="w-full shrink-0 sm:w-28 sm:border-r sm:border-zinc-200 dark:sm:border-zinc-800">
                  <div className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible sm:space-y-1 sm:pr-4">
                    {[
                      { key: "videos" as const, label: "视频", count: likes.length },
                      { key: "liked-comments" as const, label: "评论", count: likedComments.length },
                      { key: "received-likes" as const, label: "获赞", count: receivedLikes.length },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setLikesSubTab(item.key)}
                        className={`flex shrink-0 items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors sm:w-full ${
                          likesSubTab === item.key
                            ? "bg-[#FB7299]/10 font-medium text-[#FB7299]"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs">{item.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  {loading ? (
                    <div className="py-12 text-center text-zinc-500">加载中...</div>
                  ) : likesSubTab === "videos" ? (
                    renderVideoGrid(likes)
                  ) : likesSubTab === "liked-comments" ? (
                    likedComments.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500">暂无点赞的评论</div>
                    ) : (
                      <div className="space-y-4">
                        {likedComments.map((comment) => (
                          <a
                            key={comment.id}
                            href={`/video/${comment.video.id}#comment-${comment.id}`}
                            onClick={(e) => { e.preventDefault(); sessionStorage.setItem("highlightComment", comment.id); window.location.href = `/video/${comment.video.id}`; }}
                            className="block rounded-lg border border-zinc-200 p-3 transition-colors hover:border-[#FB7299]/30 dark:border-zinc-800 dark:hover:border-[#FB7299]/30 sm:p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                              <div className="h-32 w-full overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 sm:h-20 sm:w-32 sm:shrink-0">
                                <img src={comment.video.coverUrl} alt={comment.video.title} className="h-full w-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{comment.author.name}</span>
                                  <span>·</span>
                                  <span>{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
                                </div>
                                {comment.parent && (
                                  <div className="mt-2 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                                    <span className="font-medium">{comment.parent.author.name}：</span>
                                    {comment.parent.content.length > 50 ? comment.parent.content.slice(0, 50) + "..." : comment.parent.content}
                                  </div>
                                )}
                                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{comment.content}</p>
                                <div className="mt-2 flex items-center gap-4">
                                  <span className="text-xs text-[#FB7299]">
                                    {comment.video.title.length > 30 ? comment.video.title.slice(0, 30) + "..." : comment.video.title}
                                  </span>
                                  <span className="text-xs text-zinc-400">{comment._count.likes} 赞 · {comment._count.replies} 回复</span>
                                </div>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )
                  ) : (
                    receivedLikes.length === 0 ? (
                      <div className="py-12 text-center text-zinc-500">暂无评论获赞</div>
                    ) : (
                      <div className="space-y-4">
                        {receivedLikes.map((item) => (
                          <a
                            key={item.id}
                            href={`/video/${item.comment.video.id}#comment-${item.comment.id}`}
                            onClick={(e) => { e.preventDefault(); sessionStorage.setItem("highlightComment", item.comment.id); window.location.href = `/video/${item.comment.video.id}`; }}
                            className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-[#FB7299]/30 dark:border-zinc-800 dark:hover:border-[#FB7299]/30"
                          >
                            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.user.name}</span>
                              <span>赞了你的评论</span>
                              <span>·</span>
                              <span>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                            </div>
                            <div className="mt-3 rounded bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                              {item.comment.parent && (
                                <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                                  回复 @{item.comment.parent.author.name}：
                                  {item.comment.parent.content.length > 50 ? item.comment.parent.content.slice(0, 50) + "..." : item.comment.parent.content}
                                </div>
                              )}
                              <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.comment.content}</p>
                            </div>
                            <div className="mt-2 flex items-center gap-4">
                              <span className="text-xs text-[#FB7299]">
                                {item.comment.video.title.length > 30 ? item.comment.video.title.slice(0, 30) + "..." : item.comment.video.title}
                              </span>
                              <span className="text-xs text-zinc-400">{item.comment._count.likes} 赞 · {item.comment._count.replies} 回复</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "comments" && (
            <motion.div
              key="comments"
              custom={slideDirRef.current}
              variants={TAB_SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {loading ? (
                <div className="py-12 text-center text-zinc-500">加载中...</div>
              ) : comments.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  暂无评论
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      onClick={() => { sessionStorage.setItem("highlightComment", comment.id); window.location.href = `/video/${comment.video.id}`; }}
                      className="cursor-pointer rounded-lg border border-zinc-200 p-3 transition-colors hover:border-[#FB7299]/30 dark:border-zinc-800 dark:hover:border-[#FB7299]/30 sm:p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                        <div className="h-32 w-full overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 sm:h-20 sm:w-32 sm:shrink-0">
                          <img src={comment.video.coverUrl} alt={comment.video.title} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>
                              {comment.parent ? (
                                <>回复 <span className="font-medium text-zinc-700 dark:text-zinc-300">@{comment.parent.author.name}</span></>
                              ) : (
                                "评论了视频"
                              )}
                            </span>
                            <span>·</span>
                            <span>{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
                          </div>
                          {comment.parent && (
                            <div className="mt-2 rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                              <span className="font-medium">{comment.parent.author.name}：</span>
                              {comment.parent.content.length > 50 ? comment.parent.content.slice(0, 50) + "..." : comment.parent.content}
                            </div>
                          )}
                          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{comment.content}</p>
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-xs text-[#FB7299]">
                              {comment.video.title.length > 30 ? comment.video.title.slice(0, 30) + "..." : comment.video.title}
                            </span>
                            <span className="text-xs text-zinc-400">{comment._count.likes} 赞 · {comment._count.replies} 回复</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id, comment.video.id); }}
                              className="ml-auto text-xs text-zinc-400 hover:text-red-500"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="注销账号"
        message="确定要注销账号吗？此操作将删除你的所有数据，包括投稿视频、评论、点赞和收藏，且不可恢复！"
        confirmText="确认注销"
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
