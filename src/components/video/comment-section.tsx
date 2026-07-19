"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { consumeHighlightComment } from "@/lib/signals";
import CommentImages from "./comment-images";
import { ImageLightbox } from "./image-lightbox";
import { compressImage, formatFileSize } from "@/lib/image-compress";

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
  replyToName?: string;
  replyToContent?: string;
  replyToImages?: number;
  _count: { likes: number; replies: number };
  replies?: Reply[];
  images?: string[];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
  _count: { likes: number; replies: number };
  replies: Reply[];
  images: string[];
}

const MAX_IMAGES = 7;

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

  // Image states (comment)
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // Image states (reply)
  const [replySelectedImages, setReplySelectedImages] = useState<File[]>([]);
  const [replyImagePreviews, setReplyImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_COMMENT_LENGTH = 500;
  const MAX_TEXTAREA_LINES = 10;

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    const textarea = e.target;
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * MAX_TEXTAREA_LINES;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  // Auto-resize reply textarea
  const handleReplyTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setReplyContent(value);
    const textarea = e.target;
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * MAX_TEXTAREA_LINES;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const replyOverLimit = replyContent.length > MAX_COMMENT_LENGTH;
  const replyOverCount = replyContent.length - MAX_COMMENT_LENGTH;

  const commentOverLimit = content.length > MAX_COMMENT_LENGTH;
  const commentOverCount = content.length - MAX_COMMENT_LENGTH;

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      replyImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "image");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("图片上传失败");
      const { url } = await res.json();
      urls.push(url);
    }
    return urls;
  };

  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  const processImageFile = async (file: File): Promise<File | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert(`${file.name} 格式不支持`);
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      const result = await compressImage(file, 7.5, 2048);
      if (result.compressedSize > MAX_FILE_SIZE) {
        alert(`${file.name} 压缩后仍超过8MB限制（${formatFileSize(result.compressedSize)}），请使用更小的图片`);
        return null;
      }
      return result.file;
    }

    return file;
  };

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const remaining = MAX_IMAGES - selectedImages.length;
      const filesToProcess = files.slice(0, remaining);

      const processedFiles: File[] = [];
      for (const file of filesToProcess) {
        const processed = await processImageFile(file);
        if (processed) {
          processedFiles.push(processed);
        }
      }

      if (processedFiles.length > 0) {
        setSelectedImages((prev) => [...prev, ...processedFiles]);
        const newPreviews = processedFiles.map((f) => URL.createObjectURL(f));
        setImagePreviews((prev) => [...prev, ...newPreviews]);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [selectedImages.length]
  );

  const removeImage = useCallback(
    (index: number) => {
      URL.revokeObjectURL(imagePreviews[index]);
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
      setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    },
    [imagePreviews]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (imageFiles.length === 0) return;

      e.preventDefault();

      const remaining = MAX_IMAGES - selectedImages.length;
      const filesToProcess = imageFiles.slice(0, remaining);

      const processedFiles: File[] = [];
      for (const file of filesToProcess) {
        const processed = await processImageFile(file);
        if (processed) {
          processedFiles.push(processed);
        }
      }

      if (processedFiles.length > 0) {
        setSelectedImages((prev) => [...prev, ...processedFiles]);
        const newPreviews = processedFiles.map((f) => URL.createObjectURL(f));
        setImagePreviews((prev) => [...prev, ...newPreviews]);
      }
    },
    [selectedImages.length]
  );

  const handleReplyImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const remaining = MAX_IMAGES - replySelectedImages.length;
      const filesToProcess = files.slice(0, remaining);

      const processedFiles: File[] = [];
      for (const file of filesToProcess) {
        const processed = await processImageFile(file);
        if (processed) {
          processedFiles.push(processed);
        }
      }

      if (processedFiles.length > 0) {
        setReplySelectedImages((prev) => [...prev, ...processedFiles]);
        const newPreviews = processedFiles.map((f) => URL.createObjectURL(f));
        setReplyImagePreviews((prev) => [...prev, ...newPreviews]);
      }

      if (replyFileInputRef.current) replyFileInputRef.current.value = "";
    },
    [replySelectedImages.length]
  );

  const handleReplyPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (imageFiles.length === 0) return;

      e.preventDefault();

      const remaining = MAX_IMAGES - replySelectedImages.length;
      const filesToProcess = imageFiles.slice(0, remaining);

      const processedFiles: File[] = [];
      for (const file of filesToProcess) {
        const processed = await processImageFile(file);
        if (processed) {
          processedFiles.push(processed);
        }
      }

      if (processedFiles.length > 0) {
        setReplySelectedImages((prev) => [...prev, ...processedFiles]);
        const newPreviews = processedFiles.map((f) => URL.createObjectURL(f));
        setReplyImagePreviews((prev) => [...prev, ...newPreviews]);
      }
    },
    [replySelectedImages.length]
  );

  const removeReplyImage = useCallback(
    (index: number) => {
      URL.revokeObjectURL(replyImagePreviews[index]);
      setReplyImagePreviews((prev) => prev.filter((_, i) => i !== index));
      setReplySelectedImages((prev) => prev.filter((_, i) => i !== index));
    },
    [replyImagePreviews]
  );

  const openLightboxForImages = useCallback((images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setShowLightbox(true);
  }, []);

  useEffect(() => {
    const commentId = consumeHighlightComment();
    if (commentId) {
      highlightIdRef.current = commentId;
      highlightedRef.current = false;
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
    if ((!content.trim() && selectedImages.length === 0) || loading) return;
    const input = content;
    const tempImages = [...selectedImages];
    const tempId = `temp-${Date.now()}`;
    const tempComment: Comment = {
      id: tempId,
      content: input,
      images: imagePreviews,
      createdAt: new Date().toISOString(),
      author: { id: session!.user!.id!, name: session!.user!.name || "我", avatar: null },
      _count: { likes: 0, replies: 0 },
      replies: [],
    };
    setComments((prev) => [tempComment, ...prev]);
    setContent("");
    setSelectedImages([]);
    setImagePreviews([]);
    setLoading(true);
    try {
      let imageUrls: string[] = [];
      if (tempImages.length > 0) {
        setUploadingImages(true);
        imageUrls = await uploadImages(tempImages);
        setUploadingImages(false);
      }
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, images: imageUrls.length > 0 ? imageUrls : undefined }),
      });
      if (!res.ok) throw new Error();
      const newComment = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? { ...newComment, _count: { likes: 0, replies: 0 }, replies: [] }
            : c
        )
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setContent(input);
    } finally {
      setLoading(false);
    }
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
    if ((!replyContent.trim() && replySelectedImages.length === 0) || replyLoading) return;
    const input = replyContent;
    const tempImages = [...replySelectedImages];
    const targetName = replyTargetName;

    // Find parent comment content and images for the reply preview
    let parentContent = "";
    let parentImageCount = 0;
    for (const c of comments) {
      if (c.id === parentId) {
        parentContent = c.content;
        parentImageCount = c.images?.length || 0;
        break;
      }
      const foundReply = c.replies?.find((r) => r.id === parentId);
      if (foundReply) {
        parentContent = foundReply.content;
        parentImageCount = foundReply.images?.length || 0;
        break;
      }
    }

    const tempId = `temp-reply-${Date.now()}`;
    const tempReply: Reply = {
      id: tempId,
      content: input,
      images: replyImagePreviews,
      replyToName: targetName,
      replyToContent: parentContent,
      replyToImages: parentImageCount > 0 ? parentImageCount : undefined,
      createdAt: new Date().toISOString(),
      author: { id: session!.user!.id!, name: session!.user!.name || "我", avatar: null },
      _count: { likes: 0, replies: 0 },
      replies: [],
    };
    const addTempReply = (replies: Reply[], pid: string): Reply[] =>
      replies.map((r) => {
        if (r.id === pid) return { ...r, replies: [...(r.replies || []), tempReply], _count: { ...r._count, replies: r._count.replies + 1 } };
        if (r.replies?.length) return { ...r, replies: addTempReply(r.replies, pid) };
        return r;
      });
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === parentId) return { ...c, replies: [...c.replies, tempReply], _count: { ...c._count, replies: c._count.replies + 1 } };
        if (replyExistsInTree(c.replies, parentId)) return { ...c, replies: addTempReply(c.replies, parentId), _count: { ...c._count, replies: c._count.replies + 1 } };
        return c;
      })
    );
    setReplyContent("");
    setReplySelectedImages([]);
    setReplyImagePreviews([]);
    setReplyTo(null);
    setReplyTargetName("");
    setReplyLoading(true);
    try {
      let imageUrls: string[] = [];
      if (tempImages.length > 0) {
        imageUrls = await uploadImages(tempImages);
      }
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input, parentId, images: imageUrls.length > 0 ? imageUrls : undefined }),
      });
      if (!res.ok) throw new Error();
      const newReply = await res.json();
      const replyData = {
        ...newReply,
        _count: { likes: 0, replies: 0 },
        replies: [],
        replyToName: newReply.replyToName || targetName,
        replyToContent: newReply.replyToContent || parentContent,
        replyToImages: newReply.replyToImages || (parentImageCount > 0 ? parentImageCount : undefined),
      };
      const replaceTemp = (replies: Reply[]): Reply[] =>
        replies.map((r) => {
          if (r.id === tempId) return replyData;
          if (r.replies?.length) return { ...r, replies: replaceTemp(r.replies) };
          return r;
        });
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentId) return { ...c, replies: replaceTemp(c.replies) };
          if (replyExistsInTree(c.replies, parentId)) return { ...c, replies: replaceTemp(c.replies) };
          return c;
        })
      );
    } catch {
      const removeTemp = (replies: Reply[]): Reply[] =>
        replies.filter((r) => r.id !== tempId).map((r) => r.replies?.length ? { ...r, replies: removeTemp(r.replies) } : r);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentId) return { ...c, replies: removeTemp(c.replies), _count: { ...c._count, replies: c._count.replies - 1 } };
          if (replyExistsInTree(c.replies, parentId)) return { ...c, replies: removeTemp(c.replies), _count: { ...c._count, replies: c._count.replies - 1 } };
          return c;
        })
      );
      setReplyContent(input);
      setReplyTo(parentId);
    } finally {
      setReplyLoading(false);
    }
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

  const handleLikeComment = async (commentId: string, isReply: boolean) => {
    if (!session?.user) return;
    const wasLiked = isReply ? likedReplyIds.has(commentId) : likedCommentIds.has(commentId);
    const newLiked = !wasLiked;
    if (isReply) {
      setLikedReplyIds((prev) => { const n = new Set(prev); newLiked ? n.add(commentId) : n.delete(commentId); return n; });
      setComments((prev) => prev.map((c) => ({ ...c, replies: updateReplyLike(c.replies, commentId, newLiked) })));
    } else {
      setLikedCommentIds((prev) => { const n = new Set(prev); newLiked ? n.add(commentId) : n.delete(commentId); return n; });
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, _count: { ...c._count, likes: c._count.likes + (newLiked ? 1 : -1) } } : c));
    }
    try {
      const res = await fetch(`/api/videos/${videoId}/comments/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      if (isReply) {
        setLikedReplyIds((prev) => { const n = new Set(prev); wasLiked ? n.add(commentId) : n.delete(commentId); return n; });
        setComments((prev) => prev.map((c) => ({ ...c, replies: updateReplyLike(c.replies, commentId, wasLiked) })));
      } else {
        setLikedCommentIds((prev) => { const n = new Set(prev); wasLiked ? n.add(commentId) : n.delete(commentId); return n; });
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, _count: { ...c._count, likes: c._count.likes + (wasLiked ? 1 : -1) } } : c));
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
        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FB7299] text-xs font-medium text-white">
              {reply.author.name[0]}
            </div>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {reply.author.name}
            </span>
            <span className="text-xs text-zinc-400">
              {new Date(reply.createdAt).toLocaleDateString("zh-CN")}
            </span>
            {session?.user?.id === reply.author.id && (
              <button
                onClick={() => handleDelete(reply.id)}
                className="ml-auto text-xs text-zinc-400 hover:text-red-500"
              >
                删除
              </button>
            )}
          </div>
          <div className="mt-2">
            {reply.replyToName && (
              <span className="text-xs text-zinc-400">
                回复 @{reply.replyToName}
                {reply.replyToContent && reply.replyToContent.trim().length > 0
                  ? ` ${reply.replyToContent.slice(0, 4)}${reply.replyToContent.length > 4 ? "..." : ""}`
                  : reply.replyToImages && reply.replyToImages > 0
                    ? ` 图片x${reply.replyToImages}`
                    : ""
                }：
              </span>
            )}
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {reply.content}
            </span>
          </div>
          {reply.images && reply.images.length > 0 && (
            <CommentImages
              images={reply.images}
              onImageClick={(index) => openLightboxForImages(reply.images!, index)}
            />
          )}
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => handleLikeComment(reply.id, true)}
              disabled={!session?.user}
              className={`flex items-center gap-1 text-xs transition-colors ${
                likedReplyIds.has(reply.id) ? "text-[#FB7299]" : "text-zinc-400 hover:text-[#FB7299]"
              } disabled:opacity-50`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
              {reply._count.likes > 0 && reply._count.likes}
            </button>
            {session?.user && (
              <button
                onClick={() => startReply(reply.id, reply.author.name)}
                className="text-xs text-zinc-400 hover:text-[#FB7299]"
              >
                回复
              </button>
            )}
          </div>
        </div>

        {replyTo === reply.id && (
          <div className="ml-6 mt-2 sm:ml-10">
            <div className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
              <textarea
                ref={replyTextareaRef}
                value={replyContent}
                onChange={handleReplyTextareaInput}
                onPaste={handleReplyPaste}
                placeholder={`回复 @${replyTargetName}`}
                maxLength={MAX_COMMENT_LENGTH + 100}
                className="w-full resize-none bg-transparent p-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-500 sm:p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
                rows={1}
                style={{ minHeight: "40px", overflow: "hidden" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply(reply.id);
                  }
                }}
              />
              {replyImagePreviews.length > 0 && (
                <div className="flex gap-1.5 px-2.5 pb-2 sm:px-3">
                  {replyImagePreviews.map((src, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="group relative h-12 w-12 overflow-hidden rounded-md sm:h-14 sm:w-14"
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeReplyImage(i)}
                        className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-1 border-t border-zinc-200 px-2 py-1 dark:border-zinc-700 sm:px-2.5 sm:py-1.5">
                <button
                  type="button"
                  onClick={() => replyFileInputRef.current?.click()}
                  disabled={replySelectedImages.length >= MAX_IMAGES}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title={replySelectedImages.length > 0 ? `已选 ${replySelectedImages.length}/${MAX_IMAGES} 张图片` : "插入图片"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </button>
                <input
                  ref={replyFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReplyImageSelect}
                  className="hidden"
                />
                {replyOverLimit ? (
                  <span className="flex h-7 w-7 items-center justify-center text-xs font-medium text-red-500">
                    -{replyOverCount}
                  </span>
                ) : (
                  <button
                    onClick={() => handleReply(reply.id)}
                    disabled={replyLoading || (!replyContent.trim() && replySelectedImages.length === 0)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FB7299] text-white hover:bg-[#FC8AB1] disabled:opacity-50"
                  >
                    {replyLoading ? (
                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
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

  const canSubmit = content.trim() || selectedImages.length > 0;
  const canReply = replyContent.trim() || replySelectedImages.length > 0;

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:mb-4 sm:text-lg">
        评论 ({comments.reduce((acc, c) => acc + 1 + countAll(c.replies), 0)})
      </h2>

      {session?.user ? (
        <form onSubmit={handleSubmit} className="mb-4 sm:mb-6">
          <div className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaInput}
              onPaste={handlePaste}
              placeholder="发一条友善的评论"
              maxLength={MAX_COMMENT_LENGTH + 100}
              className="w-full resize-none bg-transparent p-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-500 sm:p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
              rows={3}
              style={{ minHeight: "80px", overflow: "hidden" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
            />
            {imagePreviews.length > 0 && (
              <div className="flex gap-1.5 px-2.5 pb-2 sm:px-3">
                {imagePreviews.map((src, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="group relative h-14 w-14 overflow-hidden rounded-md sm:h-16 sm:w-16"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end gap-1 border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-700 sm:px-2.5 sm:py-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={selectedImages.length >= MAX_IMAGES}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                title={selectedImages.length > 0 ? `已选 ${selectedImages.length}/${MAX_IMAGES} 张图片` : "插入图片"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              {commentOverLimit ? (
                <span className="flex h-8 w-8 items-center justify-center text-sm font-medium text-red-500">
                  -{commentOverCount}
                </span>
              ) : (
                <button
                  type="submit"
                  disabled={loading || uploadingImages || !canSubmit}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FB7299] text-white hover:bg-[#FC8AB1] disabled:opacity-50"
                >
                  {loading || uploadingImages ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
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
                {comment.images && comment.images.length > 0 && (
                  <CommentImages
                    images={comment.images}
                    onImageClick={(index) => openLightboxForImages(comment.images, index)}
                  />
                )}
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
                <div className="ml-6 mt-2 sm:ml-10">
                  <div className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                    <textarea
                      ref={replyTextareaRef}
                      value={replyContent}
                      onChange={handleReplyTextareaInput}
                      onPaste={handleReplyPaste}
                      placeholder={`回复 @${replyTargetName}`}
                      maxLength={MAX_COMMENT_LENGTH + 100}
                      className="w-full resize-none bg-transparent p-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder-zinc-500 sm:p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600"
                      rows={1}
                      style={{ minHeight: "40px", overflow: "hidden" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReply(comment.id);
                        }
                      }}
                    />
                    {replyImagePreviews.length > 0 && (
                      <div className="flex gap-1.5 px-2.5 pb-2 sm:px-3">
                        {replyImagePreviews.map((src, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="group relative h-12 w-12 overflow-hidden rounded-md sm:h-14 sm:w-14"
                          >
                            <img src={src} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeReplyImage(i)}
                              className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 border-t border-zinc-200 px-2 py-1 dark:border-zinc-700 sm:px-2.5 sm:py-1.5">
                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        disabled={replySelectedImages.length >= MAX_IMAGES}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                        title={replySelectedImages.length > 0 ? `已选 ${replySelectedImages.length}/${MAX_IMAGES} 张图片` : "插入图片"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </button>
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleReplyImageSelect}
                        className="hidden"
                      />
                      {replyOverLimit ? (
                        <span className="flex h-7 w-7 items-center justify-center text-xs font-medium text-red-500">
                          -{replyOverCount}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReply(comment.id)}
                          disabled={replyLoading || !canReply}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FB7299] text-white hover:bg-[#FC8AB1] disabled:opacity-50"
                        >
                          {replyLoading ? (
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
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

      {showLightbox && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </div>
  );
}
