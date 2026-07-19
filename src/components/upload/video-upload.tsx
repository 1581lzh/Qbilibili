"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoUploadPageProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  file: File | null;
  setFile: (v: File | null) => void;
  thumbnail: File | null;
  setThumbnail: (v: File | null) => void;
  loading: boolean;
  uploadProgress: number;
  uploadStatus: string;
  onSubmit: () => void;
}

export function VideoUploadPage({
  title,
  setTitle,
  description,
  setDescription,
  file,
  setFile,
  thumbnail,
  setThumbnail,
  loading,
  uploadProgress,
  uploadStatus,
  onSubmit,
}: VideoUploadPageProps) {
  const [videoPreview, setVideoPreview] = useState("");
  const [thumbPreview, setThumbPreview] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setVideoPreview("");
  }, [file]);

  useEffect(() => {
    if (thumbnail) {
      const url = URL.createObjectURL(thumbnail);
      setThumbPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setThumbPreview("");
  }, [thumbnail]);

  return (
    <div className={`flex flex-col gap-6 lg:flex-row ${!file && !thumbnail ? "lg:items-end" : ""}`}>
      {/* Left: Video preview */}
      <div className="w-full lg:w-2/5">
        <div className="sticky top-4">
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <AnimatePresence mode="wait">
              {videoPreview ? (
                <motion.video
                  key="video"
                  src={videoPreview}
                  controls
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  暂无预览
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Thumbnail preview */}
          {thumbPreview && (
            <div className="mt-3">
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">封面预览</p>
              <img
                src={thumbPreview}
                alt="封面预览"
                width={256}
                height={144}
                decoding="async"
                className="w-full rounded-lg object-cover"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Content area */}
      <div className="w-full lg:w-3/5 space-y-4">
        {/* Video file upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            视频文件 *
          </label>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-6 text-center text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <svg className="mx-auto mb-2 h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {file ? file.name : "选择视频文件"}
            {file && (
              <p className="mt-1 text-xs text-zinc-400">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            {!file && (
              <p className="mt-1 text-xs text-zinc-400">
                支持粘贴（Ctrl+V）或拖拽文件到页面
              </p>
            )}
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            视频标题 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入视频标题"
            maxLength={80}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <p className="mt-1 text-xs text-zinc-400">{title.length}/80</p>
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            视频简介
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="添加视频简介（选填）"
            rows={4}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        {/* Thumbnail upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            封面图
          </label>
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => thumbInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-4 text-center text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <svg className="mx-auto mb-2 h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {thumbnail ? thumbnail.name : "选择封面图"}
            {!thumbnail && (
              <p className="mt-1 text-xs text-zinc-400">
                支持粘贴截图作为封面
              </p>
            )}
          </button>
        </div>

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
          onClick={onSubmit}
          disabled={loading || !file || !title.trim()}
          className="w-full rounded-lg bg-[#FB7299] py-3 text-sm font-medium text-white hover:bg-[#FC8AB1] disabled:opacity-50"
        >
          {loading ? "上传中..." : "立即投稿"}
        </button>
      </div>
    </div>
  );
}
