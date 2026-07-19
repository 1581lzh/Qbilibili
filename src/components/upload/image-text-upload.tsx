"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CompressDialog } from "@/components/ui/compress-dialog";
import { compressImage, needsCompression, formatFileSize } from "@/lib/image-compress";
import { MusicPlayer } from "@/components/upload/music-player";

interface ImageTextUploadPageProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  images: { file: File; preview: string }[];
  setImages: React.Dispatch<React.SetStateAction<{ file: File; preview: string }[]>>;
  music: { file: File; preview: string }[];
  setMusic: React.Dispatch<React.SetStateAction<{ file: File; preview: string }[]>>;
  imageDuration: number;
  setImageDuration: (v: number) => void;
  loading: boolean;
  uploadProgress: number;
  uploadStatus: string;
  onSubmit: (coverIndex: number) => void;
}

export function ImageTextUploadPage({
  title,
  setTitle,
  description,
  setDescription,
  images,
  setImages,
  music,
  setMusic,
  imageDuration,
  setImageDuration,
  loading,
  uploadProgress,
  uploadStatus,
  onSubmit,
}: ImageTextUploadPageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [imageOrders, setImageOrders] = useState<number[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [imagesSnapshot, setImagesSnapshot] = useState<{ file: File; preview: string }[] | null>(null);
  const [coverIndex, setCoverIndex] = useState<number | null>(null);
  const [playMode, setPlayMode] = useState<"sequential" | "simultaneous" | "shuffle">("sequential");
  const [compressDialogOpen, setCompressDialogOpen] = useState(false);
  const [compressTarget, setCompressTarget] = useState<File | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGES = 40;
  const MAX_AUDIO = 3;

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      music.forEach((m) => URL.revokeObjectURL(m.preview));
    };
  }, []);

  // Image selection
  const handleImagesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      alert(`最多只能上传${MAX_IMAGES}张图片`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);

    for (const file of filesToProcess) {
      if (needsCompression(file)) {
        setCompressTarget(file);
        setCompressDialogOpen(true);
        return;
      }
      addImage(file);
    }
  };

  const addImage = (file: File) => {
    const preview = URL.createObjectURL(file);
    setImages((prev) => [...prev, { file, preview }]);
  };

  const handleCompressConfirm = async () => {
    if (!compressTarget) return;
    const result = await compressImage(compressTarget);
    if (result.compressedSize > 15 * 1024 * 1024) {
      alert("图片压缩后仍然超过15MB限制");
    } else {
      addImage(result.file);
    }
    setCompressDialogOpen(false);
    setCompressTarget(null);
  };

  // Image click - toggle sort order in sort mode, or switch preview
  const handleImageClick = (index: number) => {
    if (!editMode) {
      setCurrentImageIndex(index);
      return;
    }

    const currentOrder = imageOrders.indexOf(index);
    if (currentOrder !== -1) {
      setImageOrders((prev) => prev.filter((i) => i !== index));
    } else {
      setImageOrders((prev) => [...prev, index]);
    }
    setHasChanges(true);
    setCurrentImageIndex(index);
  };

  const getImageOrder = (index: number) => {
    const order = imageOrders.indexOf(index);
    return order !== -1 ? order + 1 : null;
  };

  // Drag reorder
  const handleReorderImages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setImages((prev) => {
      const newImages = [...prev];
      const [removed] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, removed);
      return newImages;
    });

    if (currentImageIndex === fromIndex) {
      setCurrentImageIndex(toIndex);
    } else if (fromIndex < currentImageIndex && toIndex >= currentImageIndex) {
      setCurrentImageIndex(currentImageIndex - 1);
    } else if (fromIndex > currentImageIndex && toIndex <= currentImageIndex) {
      setCurrentImageIndex(currentImageIndex + 1);
    }

    if (editMode) {
      setHasChanges(true);
    }
  };

  // Save order
  const handleSaveOrder = () => {
    const orderedImages = [...images];
    const newImages: typeof images = [];

    imageOrders.forEach((index) => {
      if (orderedImages[index]) {
        newImages.push(orderedImages[index]);
      }
    });

    orderedImages.forEach((img, index) => {
      if (!imageOrders.includes(index)) {
        newImages.push(img);
      }
    });

    setImages(newImages);
    setImageOrders([]);
    setHasChanges(false);
    setEditMode(false);
  };

  // Delete selected images (all marked in edit mode, or current image)
  const handleDeleteSelected = () => {
    if (images.length === 0) return;

    // In edit mode with marked images, delete all marked
    if (editMode && imageOrders.length > 0) {
      const indicesToDelete = new Set(imageOrders);
      const newImages = images.filter((img, index) => {
        if (indicesToDelete.has(index)) {
          URL.revokeObjectURL(img.preview);
          return false;
        }
        return true;
      });
      setImages(newImages);
      setImageOrders([]);
      setCurrentImageIndex(Math.min(currentImageIndex, newImages.length - 1));
      setHasChanges(true);
      return;
    }

    // Otherwise delete current image
    if (currentImageIndex < 0) return;

    const newImages = [...images];
    URL.revokeObjectURL(newImages[currentImageIndex].preview);
    newImages.splice(currentImageIndex, 1);

    setImages(newImages);

    if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(Math.max(0, newImages.length - 1));
    }

    if (editMode) {
      setImageOrders((prev) =>
        prev
          .filter((i) => i !== currentImageIndex)
          .map((i) => (i > currentImageIndex ? i - 1 : i))
      );
      setHasChanges(true);
    }
  };

  // Music selection
  const handleMusicSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_AUDIO - music.length;
    if (remaining <= 0) {
      alert(`最多只能上传${MAX_AUDIO}个音频`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    const newMusic = filesToProcess.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setMusic((prev) => [...prev, ...newMusic]);
  };

  // Touch swipe for main preview
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentImageIndex < images.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else if (diff < 0 && currentImageIndex > 0) {
        setCurrentImageIndex(currentImageIndex - 1);
      }
    }
    setTouchStart(null);
  };

  // Get cover index for submission
  const getCoverIndex = () => {
    if (coverIndex !== null) return coverIndex;
    // Default to first image
    return 0;
  };

  // Enter edit mode - create snapshot with new ObjectURLs
  const handleEnterEditMode = () => {
    setEditMode(true);
    setImageOrders([]);
    setHasChanges(false);
    setCoverIndex(null);
    // Create new ObjectURLs for snapshot to avoid sharing with current images
    setImagesSnapshot(images.map(img => ({
      file: img.file,
      preview: URL.createObjectURL(img.file)
    })));
  };

  // Exit edit mode - revert changes
  const handleExitEditMode = () => {
    if (hasChanges && imagesSnapshot) {
      // Revoke current images' URLs
      images.forEach(img => URL.revokeObjectURL(img.preview));
      // Use snapshot (which has its own URLs)
      setImages(imagesSnapshot);
    } else {
      // No changes, just revoke snapshot URLs
      imagesSnapshot?.forEach(img => URL.revokeObjectURL(img.preview));
    }
    setEditMode(false);
    setImageOrders([]);
    setHasChanges(false);
    setImagesSnapshot(null);
  };

  return (
    <div className={`flex flex-col gap-6 lg:flex-row ${images.length === 0 ? "lg:items-end" : ""}`}>
      {/* Left: Large preview */}
      <div className="w-full lg:w-2/5">
        <div className="sticky top-4">
          <div
            className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait">
              {images.length > 0 ? (
                <motion.img
                  key={currentImageIndex}
                  src={images[currentImageIndex]?.preview}
                  alt={`Image ${currentImageIndex + 1}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  暂无预览
                </div>
              )}
            </AnimatePresence>

            {images.length > 0 && (
              <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                  disabled={currentImageIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1))}
                  disabled={currentImageIndex === images.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Content area */}
      <div className="w-full lg:w-3/5 space-y-4">
        {/* Title */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            标题 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入标题"
            maxLength={80}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <p className="mt-1 text-xs text-zinc-400">{title.length}/80</p>
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="添加描述（选填）"
            rows={3}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        {/* Image upload */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              图片 *（最多{MAX_IMAGES}张）
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={editMode ? handleExitEditMode : handleEnterEditMode}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                  editMode
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {editMode ? "退出编辑" : "编辑模式"}
              </button>

              {editMode && hasChanges && (
                <button
                  type="button"
                  onClick={handleSaveOrder}
                  className="rounded-lg bg-[#FB7299] px-3 py-1 text-xs font-medium text-white hover:bg-[#FC8AB1]"
                >
                  保存
                </button>
              )}

              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={images.length === 0}
                className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                删除选中
              </button>
            </div>
          </div>
          <input
            ref={imagesInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => imagesInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-6 text-center text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <svg className="mx-auto mb-2 h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            点击或拖拽上传图片
            <p className="mt-1 text-xs text-zinc-400">支持 JPG、PNG、GIF、WebP，单张最大 15MB</p>
          </button>
        </div>

        {/* Thumbnail grid - waterfall style */}
        {images.length > 0 && (
          <div className="scrollbar-thin max-h-80 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
              {images.map((image, index) => (
                <div
                  key={index}
                  draggable={!editMode}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", index.toString());
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
                    if (!isNaN(fromIndex)) handleReorderImages(fromIndex, index);
                  }}
                  onClick={() => handleImageClick(index)}
                  className={`relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                    index === currentImageIndex
                      ? "border-[#FB7299] ring-2 ring-[#FB7299]/50"
                      : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <img
                    src={image.preview}
                    alt={`Image ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />

                  {/* Sort order badge */}
                  {editMode && getImageOrder(index) !== null && (
                    <div className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FB7299] text-[10px] font-bold text-white">
                      {getImageOrder(index)}
                    </div>
                  )}

                  {/* Cover indicator */}
                  {!editMode && coverIndex === index && (
                    <div className="absolute top-1 left-1 rounded bg-[#FB7299] px-1 py-0.5 text-[10px] font-medium text-white">
                      封面
                    </div>
                  )}

                  {/* Edit mode buttons */}
                  {editMode && (
                    <div className="absolute top-1 right-1 flex gap-1">
                      {/* Set cover button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoverIndex(coverIndex === index ? null : index);
                          setHasChanges(true);
                        }}
                        className={`rounded-full p-1 text-white ${
                          coverIndex === index ? "bg-[#FB7299]" : "bg-black/50 hover:bg-black/70"
                        }`}
                        title={coverIndex === index ? "取消封面" : "设为封面"}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newIndex = images.length - 1 <= currentImageIndex
                            ? Math.max(0, images.length - 2)
                            : currentImageIndex >= index && currentImageIndex > 0
                              ? currentImageIndex - 1
                              : currentImageIndex;
                          setImages((prev) => {
                            const newImages = [...prev];
                            URL.revokeObjectURL(newImages[index].preview);
                            newImages.splice(index, 1);
                            return newImages;
                          });
                          setCurrentImageIndex(newIndex);
                          setHasChanges(true);
                        }}
                        className="rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Current index indicator */}
                  {!editMode && index === currentImageIndex && (
                    <div className="absolute bottom-1 left-1 rounded bg-[#FB7299] px-1 py-0.5 text-[10px] font-medium text-white">
                      当前
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Music upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            背景音乐（选填，最多{MAX_AUDIO}个）
          </label>
          <input
            ref={musicInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleMusicSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => musicInputRef.current?.click()}
            disabled={music.length >= MAX_AUDIO}
            className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-4 text-center text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <svg className="mx-auto mb-2 h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            点击上传背景音乐
            <p className="mt-1 text-xs text-zinc-400">支持 MP3、WAV，最大 50MB</p>
          </button>
        </div>

        {/* Play mode selector */}
        {music.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">播放模式：</span>
            <select
              value={playMode}
              onChange={(e) => setPlayMode(e.target.value as typeof playMode)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="sequential">顺序播放</option>
              <option value="simultaneous">同时播放</option>
              <option value="shuffle">随机播放</option>
            </select>
          </div>
        )}

        {/* Music list */}
        {music.length > 0 && (
          <div className="space-y-2">
            {music.map((m, index) => (
              <MusicPlayer
                key={index}
                file={m.file}
                preview={m.preview}
                onRemove={() => {
                  URL.revokeObjectURL(m.preview);
                  setMusic((prev) => prev.filter((_, i) => i !== index));
                }}
              />
            ))}
          </div>
        )}

        {/* Image duration setting */}
        {images.length > 1 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              图片预览时长（秒）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={imageDuration}
                onChange={(e) => setImageDuration(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <span className="text-xs text-zinc-400">
                {music.length > 0 ? "不设置则根据音频时长自动计算" : "默认 5 秒"}
              </span>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {loading && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{uploadStatus || "上传中..."}</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full bg-[#FB7299] transition-all duration-300"
                style={{ width: `${Math.round(uploadProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={() => onSubmit(getCoverIndex())}
          disabled={loading || !title.trim() || images.length === 0}
          className="w-full rounded-lg bg-[#FB7299] py-3 text-sm font-medium text-white hover:bg-[#FC8AB1] disabled:opacity-50"
        >
          {loading ? "上传中..." : "立即投稿"}
        </button>
      </div>

      <CompressDialog
        open={compressDialogOpen}
        fileName={compressTarget?.name || ""}
        originalSize={compressTarget?.size || 0}
        compressedSize={compressTarget ? compressTarget.size * 0.9 : 0}
        type="image"
        onConfirm={handleCompressConfirm}
        onCancel={() => {
          setCompressDialogOpen(false);
          setCompressTarget(null);
        }}
      />
    </div>
  );
}
