"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuthModal } from "@/components/auth/auth-modal-context";

declare global {
  interface Window {
    AliyunUpload: any;
  }
}

function loadScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function loadVodUploadSdk(): Promise<void> {
  if (window.AliyunUpload) return;
  await loadScript("es6-promise", "/lib/lib/es6-promise.min.js");
  await loadScript("aliyun-oss-sdk", "/lib/lib/aliyun-oss-sdk-6.17.1.min.js");
  await loadScript("aliyun-upload-sdk", "/lib/aliyun-upload-sdk-1.5.7.min.js");
}

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openLogin } = useAuthModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [pasteHint, setPasteHint] = useState(false);
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

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const f of arr) {
      if (f.type.startsWith("video/")) {
        setFile(f);
        if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
      } else if (f.type.startsWith("image/")) {
        setThumbnail(f);
      }
    }
  }, [title]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      let hasFile = false;
      for (const item of items) {
        if (item.kind === "file") {
          hasFile = true;
          break;
        }
      }
      if (!hasFile) return;
      e.preventDefault();
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) handleFiles(files);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFiles]);

  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        dragCounter++;
        setPasteHint(true);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          setPasteHint(false);
        }
      }
    };
    const handleDrop = (e: DragEvent) => {
      dragCounter = 0;
      setPasteHint(false);
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);
    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, [handleFiles]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-zinc-500">加载中...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-zinc-500">请先登录后再投稿</p>
          <button onClick={() => openLogin()} className="mt-2 inline-block text-sm text-[#FB7299] hover:underline">
            去登录
          </button>
        </div>
      </div>
    );
  }

  const uploadFileToOss = (file: File, type: "video" | "cover", onProgress: (p: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.url);
        } else {
          reject(new Error("文件上传失败"));
        }
      };
      xhr.onerror = () => reject(new Error("网络错误"));
      xhr.send(formData);
    });
  };

  const uploadVideoToVod = (file: File, title: string, onProgress: (p: number) => void): Promise<{ videoId: string; videoUrl: string }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const authRes = await fetch("/api/vod", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", title, fileName: file.name }),
        });

        if (!authRes.ok) {
          let errMsg = "获取上传凭证失败";
          try {
            const err = await authRes.json();
            errMsg = err.error || errMsg;
          } catch {}
          throw new Error(errMsg);
        }

        const { videoId, uploadAddress, uploadAuth } = await authRes.json();

        await loadVodUploadSdk();

        let finished = false;
        const done = (fn: () => void) => { if (!finished) { finished = true; fn(); } };

        const uploader = new window.AliyunUpload.Vod({
          userId: "123456",
          region: "cn-shenzhen",
          partSize: 10485760,
          parallel: 3,
          retryCount: 3,
          retryDuration: 2,
          enableUploadProgress: false,
          onUploadstarted: function (fileInfo: any) {
            uploader.setUploadAuthAndAddress(fileInfo, uploadAuth, uploadAddress, videoId);
          },
          onUploadProgress: function (_fileInfo: any, _percent: number, _percent2: number, _speed: number) {
            onProgress(Math.round(_percent));
          },
          onUploadSucceed: function () {
            done(() => resolve({ videoId, videoUrl: "" }));
          },
          onUploadFailed: function (_fileInfo: any, code: string, message: string) {
            done(() => reject(new Error("上传失败: " + code + " - " + message)));
          },
          onUploadTokenExpired: function () {
            done(() => reject(new Error("上传凭证过期")));
          },
        });

        uploader.addFile(file, null, null, null, null, videoId);
        uploader.startUpload();
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("请选择视频文件");
      return;
    }

    if (!title.trim()) {
      setError("请输入视频标题");
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      let videoUrl = "";
      let vodVideoId = "";

      try {
        setUploadStatus("正在通过 VOD 上传视频...");
        const vodResult = await uploadVideoToVod(file, title.trim(), (p) => setUploadProgress(p * 0.8));
        videoUrl = vodResult.videoUrl;
        vodVideoId = vodResult.videoId;
      } catch (vodErr) {
        setUploadStatus("正在使用 OSS 上传...");
        setUploadProgress(0);
        videoUrl = await uploadFileToOss(file, "video", (p) => setUploadProgress(p * 0.8));
      }

      let coverUrl = "";
      if (thumbnail) {
        setUploadStatus("正在上传封面...");
        setUploadProgress(80);
        coverUrl = await uploadFileToOss(thumbnail, "cover", (p) => setUploadProgress(80 + p * 0.2));
      }

      setUploadProgress(100);
      setUploadStatus("正在保存...");

      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          coverUrl: coverUrl || undefined,
          videoUrl,
          vodVideoId: vodVideoId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "投稿失败");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试");
      setUploadProgress(0);
      setUploadStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-2xl px-4 py-6 sm:py-8"
    >
      <h1 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-100 sm:mb-6 sm:text-2xl">
        投稿视频
      </h1>

      <div className="flex flex-col items-center justify-center py-20 text-center sm:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-600">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>
        <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
          投稿功能仅支持 PC 端
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          请前往电脑端进行视频投稿
        </p>
      </div>

      <form onSubmit={handleSubmit} className="hidden space-y-6 sm:block">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

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
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {file ? file.name : "选择文件"}
          </button>
          {file ? (
            <>
              <p className="mt-1 text-xs text-zinc-500">
                已选择: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
              {videoPreview && (
                <video
                  src={videoPreview}
                  controls
                  className="mt-2 w-full max-h-64 rounded-lg bg-black"
                />
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-zinc-400">
              支持粘贴（Ctrl+V）或拖拽文件到页面
            </p>
          )}
        </div>

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
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <p className="mt-1 text-xs text-zinc-400">{title.length}/80</p>
        </div>

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
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {thumbnail ? thumbnail.name : "选择文件"}
          </button>
          {thumbnail ? (
            <>
              <p className="mt-1 text-xs text-zinc-500">
                已选择: {thumbnail.name}
              </p>
              {thumbPreview && (
                <img
                  src={thumbPreview}
                  alt="封面预览"
                  className="mt-2 h-36 w-64 rounded-lg object-cover"
                />
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-zinc-400">
              支持粘贴截图作为封面
            </p>
          )}
        </div>

        {loading && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{uploadStatus || "上传中..."}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full bg-[#FB7299] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file || !title.trim()}
          className="w-full rounded-lg bg-[#FB7299] py-3 text-sm font-medium text-white hover:bg-[#FC8AB1] disabled:opacity-50"
        >
          {loading ? "上传中..." : "立即投稿"}
        </button>
      </form>
    </motion.div>
  );
}
