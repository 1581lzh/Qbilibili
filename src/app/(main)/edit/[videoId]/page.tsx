"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { optimizedCover } from "@/lib/image";

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string;
  videoUrl: string;
  postType: string;
  imageUrls: string | null;
  musicUrl: string | null;
  musicUrls: string | null;
  imageDuration: number | null;
  author: { id: string; name: string };
}

export default function EditVideoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const videoId = params.videoId as string;
  const { openLogin } = useAuthModal();

  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageDuration, setImageDuration] = useState<number | null>(5);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedCoverIndex, setSelectedCoverIndex] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Cleanup cover preview on unmount
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  // Load video data
  useEffect(() => {
    if (status === "unauthenticated") {
      openLogin();
      return;
    }

    if (status === "authenticated" && videoId) {
      fetchVideoData();
    }
  }, [status, videoId]);

  const fetchVideoData = async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}/detail`);
      if (!res.ok) {
        throw new Error("视频不存在");
      }
      const data = await res.json();

      // Check permission
      if (data.author.id !== session?.user?.id) {
        router.push("/");
        return;
      }

      setVideo(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setCoverUrl(data.coverUrl);
      setImageDuration(data.imageDuration ?? null);

      if (data.imageUrls) {
        setImageUrls(JSON.parse(data.imageUrls));
        // Find the current cover in image list
        const coverIdx = JSON.parse(data.imageUrls).indexOf(data.coverUrl);
        setSelectedCoverIndex(coverIdx >= 0 ? coverIdx : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  // Upload cover to OSS
  const uploadCoverToOss = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("封面上传失败");
    const data = await res.json();
    return data.url;
  };

  // Handle cover file select
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const preview = URL.createObjectURL(file);
    setCoverPreview(preview);
    setSelectedCoverIndex(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Upload new cover if selected
      let newCoverUrl = coverUrl;
      if (coverFile) {
        newCoverUrl = await uploadCoverToOss(coverFile);
      }

      const res = await fetch(`/api/videos/${videoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          coverUrl: newCoverUrl,
          imageUrls: video?.postType === "image_text" ? JSON.stringify(imageUrls) : undefined,
          imageDuration: video?.postType === "image_text" ? imageDuration : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }

      router.push(`/video/${videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop handlers for image reordering
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newUrls = [...imageUrls];
    const [moved] = newUrls.splice(dragIndex, 1);
    newUrls.splice(index, 0, moved);
    setImageUrls(newUrls);
    // Update cover index if needed
    if (selectedCoverIndex !== null) {
      if (dragIndex === selectedCoverIndex) {
        setSelectedCoverIndex(index);
      } else if (dragIndex < selectedCoverIndex && index >= selectedCoverIndex) {
        setSelectedCoverIndex(selectedCoverIndex - 1);
      } else if (dragIndex > selectedCoverIndex && index <= selectedCoverIndex) {
        setSelectedCoverIndex(selectedCoverIndex + 1);
      }
    }
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  // Remove image from list
  const handleRemoveImage = (index: number) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newUrls);
    if (selectedCoverIndex === index) {
      setSelectedCoverIndex(null);
      // Set cover to first image or fallback
      if (newUrls.length > 0) {
        setCoverUrl(newUrls[0]);
      }
    } else if (selectedCoverIndex !== null && selectedCoverIndex > index) {
      setSelectedCoverIndex(selectedCoverIndex - 1);
    }
  };

  // Select image as cover
  const handleSelectCover = (index: number) => {
    setSelectedCoverIndex(index);
    setCoverUrl(imageUrls[index]);
    setCoverFile(null);
    setCoverPreview("");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FB7299] border-t-transparent" />
      </div>
    );
  }

  if (error && !video) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">错误</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 rounded-lg bg-[#FB7299] px-4 py-2 text-white hover:bg-[#FC8AB1]"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8 dark:bg-zinc-900">
      <div className="mx-auto max-w-2xl px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-800"
        >
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            编辑{video?.postType === "image_text" ? "图文" : "视频"}
          </h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              标题 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-[#FB7299] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="请输入标题"
            />
            <div className="mt-1 text-right text-xs text-zinc-400">
              {title.length}/100
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-[#FB7299] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="请输入描述（可选）"
            />
            <div className="mt-1 text-right text-xs text-zinc-400">
              {description.length}/2000
            </div>
          </div>

          {/* Cover */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              封面
            </label>
            <div className="flex items-start gap-4">
              <div className="h-32 w-48 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-700">
                <img
                  src={coverPreview || optimizedCover(coverUrl, 480)}
                  alt="封面预览"
                  width={480}
                  height={270}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverSelect}
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  上传新封面
                </button>
                {coverFile && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    已选择新封面，保存后生效
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Image-text: image list with drag reorder + cover selection */}
          {video?.postType === "image_text" && imageUrls.length > 0 && (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                图片列表（拖拽排序，点击设为封面）
              </label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {imageUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleSelectCover(index)}
                    className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-700 ${
                      selectedCoverIndex === index
                        ? "ring-2 ring-[#FB7299]"
                        : dragIndex === index
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <img
                      src={optimizedCover(url, 240)}
                      alt={`图片 ${index + 1}`}
                      width={240}
                      height={240}
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 text-center text-xs text-white">
                      {index + 1}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-xs text-white hover:bg-black/70"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Image duration */}
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  图片预览时长
                </label>
                <div className="flex items-center gap-3">
                  <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
                    <button
                      type="button"
                      onClick={() => setImageDuration(null)}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        imageDuration === null
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      }`}
                    >
                      自动
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageDuration(5)}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        imageDuration !== null
                          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      }`}
                    >
                      手动
                    </button>
                  </div>
                  {imageDuration !== null && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        max={30}
                        value={imageDuration}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setImageDuration(Math.max(1, Math.min(30, val)));
                        }}
                        className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                      <span className="text-xs text-zinc-400">秒</span>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {imageDuration === null
                    ? "自动模式：根据音频时长和图片数量自动计算每张图片的停留时长"
                    : "手动模式：设置每张图片的固定停留时长"}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-zinc-300 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1 rounded-lg bg-[#FB7299] py-2 text-white hover:bg-[#FC8AB1] disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
