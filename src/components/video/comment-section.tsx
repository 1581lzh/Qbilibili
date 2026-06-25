"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthModal } from "@/components/auth/auth-modal-context";

interface Author {
  id: string;
  name: string;
  avatar: string | null;
}

interface Reply {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
  _count: { likes: number; replies: number };
  replies?: Reply[];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
  _count: { likes: number; replies: number };
  replies: Reply[];
}

export default function CommentSection({ videoId }: { videoId: string }) {
  const { data: session } = useSession();
  const { openLogin } = useAuthModal();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());
  const [likedReplyIds, setLikedReplyIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyTargetName, setReplyTargetName] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const highlightIdRef = useRef<string | null>(null);
  const highlightedRef = useRef(false);

  useEffect(() => {
    const commentId = sessionStorage.getItem("highlightComment");
    if (commentId) {
      highlightIdRef.current = commentId;
      highlightedRef.current = false;
      sessionStorage.removeItem("highlightComment");
    } else {
      highlightIdRef.current = null;
      highlightedRef.current = false;
    }
    fetch(`/api/videos/${videoId}/comments`)
      .then((res) => res.json())
      .then((data) => {
        setComments(data.comments);
        setLikedCommentIds(new Set(data.likedCommentIds));
        setLikedReplyIds(new Set(data.likedReplyIds));
      })
      .finally(() => setFetching(false));
  }, [videoId]);

  useEffect(() => {
    if (!highlightIdRef.current || highlightedRef.current) return;
    const getAbsoluteTop = (el: HTMLElement): number => {
      let top = 0;
      let current: HTMLElement | null = el;
      while (current) {
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      return top;
    };
    const tryScroll = () => {
      const el = document.getElementById(`comment-${highlightIdRef.current}`);
      if (el) {
        highlightedRef.current = true;
        const targetTop = getAbsoluteTop(el) - 80;
        window.scrollTo({ top: targetTop, behavior: "smooth" });
        let count = 0;
        const flash = () => {
          if (count >= 4) {
            el.style.transition = "";
            el.style.boxShadow = "";
            el.style.borderRadius = "";
            return;
          }
          el.style.transition = "box-shadow 500ms ease-in-out";
          el.style.borderRadius = "0.5rem";
          el.style.boxShadow = count % 2 === 0 ? "0 0 0 2px #FB7299, 0 0 12px 2px rgba(251,114,153,0.4)" : "none";
          count++;
          setTimeout(flash, 500);
        };
        setTimeout(flash, 600);
        return true;
      }
      return false;
    };
    if (tryScroll()) return;
    const timer = setInterval(() => {
      if (tryScroll()) clearInterval(timer);
    }, 200);
    const timeout = setTimeout(() => clearInterval(timer), 5000);
    return () => { clearInterval(timer); clearTimeout(timeout); };
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;
    setLoading(true);
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const newComment = await res.json();
      setComments((prev) => [
        { ...newComment, _count: { likes: 0, replies: 0 }, replies: [] },
        ...prev,
      ]);
      setContent("");
    }
    setLoading(false);
  };

  const replyExistsInTree = (replies: Reply[], id: string): boolean => {
    return replies.some((r) => r.id === id || (r.replies && replyExistsInTree(r.replies, id)));
  };

  const addReplyToTree = (replies: Reply[], parentId: string, newReply: Reply): Reply[] => {
    return replies.map((r) => {
      if (r.id === parentId) {
        return { ...r, replies: [...(r.replies || []), newReply], _count: { ...r._count, replies: r._count.replies + 1 } };
      }
      if (r.replies && r.replies.length > 0) {
        return { ...r, replies: addReplyToTree(r.replies, parentId, newReply) };
      }
      return r;
    });
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim() || replyLoading) return;
    setReplyLoading(true);
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: replyContent, parentId }),
    });
    if (res.ok) {
      const newReply = await res.json();
      const replyData = { ...newReply, _count: { likes: 0, replies: 0 }, replies: [] };
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...c.replies, replyData], _count: { ...c._count, replies: c._count.replies + 1 } };
          }
          if (replyExistsInTree(c.replies, parentId)) {
            return { ...c, replies: addReplyToTree(c.replies, parentId, replyData), _count: { ...c._count, replies: c._count.replies + 1 } };
          }
          return c;
        })
      );
      setReplyContent("");
      setReplyTo(null);
      setReplyTargetName("");
    }
    setReplyLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (!res.ok) return;
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      el.style.maxHeight = el.scrollHeight + "px";
      el.style.overflow = "hidden";
      requestAnimationFrame(() => {
        el.style.transition = "opacity 0.3s ease, max-height 0.3s ease";
        el.style.opacity = "0";
        el.style.maxHeight = "0px";
      });
    }
    setTimeout(() => {
      setComments((prev) => {
        const filtered = prev.filter((c) => c.id !== commentId);
        if (filtered.length < prev.length) return filtered;
        return prev.map((c) => ({
          ...c,
          replies: removeCommentFromTree(c.replies, commentId),
        }));
      });
    }, 300);
  };

  const removeCommentFromTree = (replies: Reply[], id: string): Reply[] => {
    return replies
      .filter((r) => r.id !== id)
      .map((r) => ({
        ...r,
        replies: r.replies ? removeCommentFromTree(r.replies, id) : [],
      }));
  };

  const handleLikeComment = async (commentId: string, isReply: boolean, parentId?: string) => {
    if (!session?.user) return;
    const res = await fetch(`/api/videos/${videoId}/comments/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (isReply) {
        setLikedReplyIds((prev) => {
          const next = new Set(prev);
          if (data.liked) { next.add(commentId); } else { next.delete(commentId); }
          return next;
        });
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            replies: updateReplyLike(c.replies, commentId, data.liked),
          }))
        );
      } else {
        setLikedCommentIds((prev) => {
          const next = new Set(prev);
          if (data.liked) { next.add(commentId); } else { next.delete(commentId); }
          return next;
        });
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, _count: { ...c._count, likes: c._count.likes + (data.liked ? 1 : -1) } }
              : c
          )
        );
      }
    }
  };

  const updateReplyLike = (replies: Reply[], id: string, liked: boolean): Reply[] => {
    return replies.map((r) => {
      if (r.id === id) {
        return { ...r, _count: { ...r._count, likes: r._count.likes + (liked ? 1 : -1) } };
      }
      if (r.replies && r.replies.length > 0) {
        return { ...r, replies: updateReplyLike(r.replies, id, liked) };
      }
      return r;
    });
  };

  const startReply = (id: string, name: string) => {
    setReplyTo(replyTo === id ? null : id);
    setReplyTargetName(name);
    setReplyContent("");
  };

  const countAll = (replies: Reply[]): number => {
    return replies.reduce((acc, r) => acc + 1 + countAll(r.replies || []), 0);
  };

  const renderReply = (reply: Reply, isIndented: boolean) => {
    return (
      <div key={reply.id} id={`comment-${reply.id}`} className={isIndented ? "ml-6 sm:ml-10" : ""}>
        <div className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800 sm:p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FB7299] text-[10px] font-medium text-white">
              {reply.author.name[0]}
            </div>
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
              {reply.author.name}
            </span>
            <span className="text-[10px] text-zinc-400">
              {new Date(reply.createdAt).toLocaleDateString("zh-CN")}
            </span>
            {session?.user?.id === reply.author.id && (
              <button
                onClick={() => handleDelete(reply.id)}
                className="ml-auto text-[10px] text-zinc-400 hover:text-red-500"
              >
                删除
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            {reply.content}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              onClick={() => handleLikeComment(reply.id, true)}
              disabled={!session?.user}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                likedReplyIds.has(reply.id) ? "text-[#FB7299]" : "text-zinc-400 hover:text-[#FB7299]"
              } disabled:opacity-50`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
              {reply._count.likes > 0 && reply._count.likes}
            </button>
            {session?.user && (
              <button
                onClick={() => startReply(reply.id, reply.author.name)}
                className="text-[10px] text-zinc-400 hover:text-[#FB7299]"
              >
                回复
              </button>
            )}
          </div>
        </div>

        {replyTo === reply.id && (
          <div className="ml-6 mt-2 flex gap-2 sm:ml-10">
            <input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`回复 @${replyTargetName}`}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:px-3 sm:py-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleReply(reply.id);
                }
              }}
            />
            <button
              onClick={() => handleReply(reply.id)}
              disabled={replyLoading || !replyContent.trim()}
              className="shrink-0 rounded-lg bg-[#FB7299] px-2.5 py-1.5 text-sm text-white hover:bg-[#FC8AB1] disabled:opacity-50 sm:px-3 sm:py-2"
            >
              {replyLoading ? "..." : "回复"}
            </button>
          </div>
        )}

        {reply.replies && reply.replies.length > 0 && (
          <div className="space-y-2 mt-2">
            {reply.replies.map((child) => renderReply(child, false))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:mb-4 sm:text-lg">
        评论 ({comments.reduce((acc, c) => acc + 1 + countAll(c.replies), 0)})
      </h2>

      {session?.user ? (
        <form onSubmit={handleSubmit} className="mb-4 sm:mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="发一条友善的评论"
            className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:p-3"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="mt-2 rounded-md bg-[#FB7299] px-4 py-2 text-sm font-medium text-white hover:bg-[#FC8AB1] disabled:opacity-50"
          >
            {loading ? "发送中..." : "发表评论"}
          </button>
        </form>
      ) : (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <button onClick={() => openLogin()} className="text-[#FB7299] hover:underline">登录</button>
          后参与评论
        </div>
      )}

      <div className="space-y-4">
        {fetching ? (
          <div className="text-center text-sm text-zinc-400">加载中...</div>
        ) : comments.length === 0 ? (
          <div className="text-center text-zinc-500 dark:text-zinc-400">
            暂无评论，{session?.user ? "来发表第一条评论吧" : "登录后发表第一条评论"}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                id={`comment-${comment.id}`}
                layout
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, layout: { duration: 0.2 } }}
                style={{ overflow: "hidden" }}
              >
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FB7299] text-xs font-medium text-white">
                    {comment.author.name[0]}
                  </div>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {comment.author.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  {session?.user?.id === comment.author.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="ml-auto text-xs text-zinc-400 hover:text-red-500"
                    >
                      删除
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {comment.content}
                </p>
                <div className="mt-2 flex items-center gap-4">
                  <button
                    onClick={() => handleLikeComment(comment.id, false)}
                    disabled={!session?.user}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      likedCommentIds.has(comment.id) ? "text-[#FB7299]" : "text-zinc-400 hover:text-[#FB7299]"
                    } disabled:opacity-50`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                    {comment._count.likes > 0 && comment._count.likes}
                  </button>
                  {session?.user && (
                    <button
                      onClick={() => startReply(comment.id, comment.author.name)}
                      className="text-xs text-zinc-400 hover:text-[#FB7299]"
                    >
                      回复
                    </button>
                  )}
                </div>
              </div>

              {replyTo === comment.id && (
                <div className="ml-6 mt-2 flex gap-2 sm:ml-10">
                  <input
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`回复 @${replyTargetName}`}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:px-3 sm:py-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply(comment.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleReply(comment.id)}
                    disabled={replyLoading || !replyContent.trim()}
                    className="shrink-0 rounded-lg bg-[#FB7299] px-2.5 py-1.5 text-sm text-white hover:bg-[#FC8AB1] disabled:opacity-50 sm:px-3 sm:py-2"
                  >
                    {replyLoading ? "..." : "回复"}
                  </button>
                </div>
              )}

              {comment.replies.length > 0 && (
                <div className="space-y-2 mt-2">
                  {comment.replies.map((reply) => renderReply(reply, true))}
                </div>
              )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
