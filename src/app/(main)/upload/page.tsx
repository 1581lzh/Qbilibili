"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuthModal } from "@/components/auth/auth-modal-context";
import { CompressDialog } from "@/components/ui/compress-dialog";
import { compressImage, needsCompression, formatFileSize } from "@/lib/image-compress";
import { compressMusic, needsMusicCompression } from "@/lib/music-compress";
import { ImageTextUploadPage } from "@/components/upload/image-text-upload";
import { VideoUploadPage } from "@/components/upload/video-upload";

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


  // Image-text posting state
  const [activeTab, setActiveTab] = useState<"video" | "image_text">("video");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [selectedCoverIndex, setSelectedCoverIndex] = useState<number | null>(null);
  const [music, setMusic] = useState<{ file: File; preview: string }[]>([]);
  const [imageDuration, setImageDuration] = useState(5);
  const [compressDialogOpen, setCompressDialogOpen] = useState(false);
  const [compressTarget, setCompressTarget] = useState<{ file: File; type: "image" | "music" } | null>(null);

  // Cleanup image and music previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      music.forEach((m) => URL.revokeObjectURL(m.preview));
    };
  }, []);

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

  const handleCompressConfirm = async () => {
    if (!compressTarget) return;

    if (compressTarget.type === "image") {
      const result = await compressImage(compressTarget.file);
      if (result.compressedSize > 15 * 1024 * 1024) {
        setError("图片压缩后仍然超过15MB限制，请使用专业工具压缩");
        setCompressDialogOpen(false);
        setCompressTarget(null);
        return;
      }
      const preview = URL.createObjectURL(result.file);
      setImages((prev) => [...prev, { file: result.file, preview }]);
    } else {
      // Music compression - for now just add the original
      const preview = URL.createObjectURL(compressTarget.file);
      setMusic((prev) => [...prev, { file: compressTarget.file, preview }]);
    }

    setCompressDialogOpen(false);
    setCompressTarget(null);
  };

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

  const uploadFileToOss = (file: File, type: "video" | "cover" | "image" | "music", onProgress: (p: number) => void): Promise<string> => {
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

    if (activeTab === "video") {
      // Existing video upload logic
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
            videoUrl: videoUrl || undefined,
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
    } else {
      // Image-text post
      if (!title.trim()) {
        setError("请输入标题");
        return;
      }
      if (images.length === 0) {
        setError("请至少上传一张图片");
        return;
      }

      setLoading(true);
      setUploadProgress(0);

      try {
        // Upload images
        setUploadStatus("正在上传图片...");
        const imageUrls: string[] = [];
        
        for (let i = 0; i < images.length; i++) {
          const imageUrl = await uploadFileToOss(images[i].file, "image", (p) => {
            const baseProgress = (i / images.length) * 80;
            const stepProgress = (p / 100) * (80 / images.length);
            setUploadProgress(baseProgress + stepProgress);
          });
          imageUrls.push(imageUrl);
        }

        // Upload music if present
        const musicUrls: string[] = [];
        if (music.length > 0) {
          setUploadStatus("正在上传音乐...");
          for (let i = 0; i < music.length; i++) {
            const musicUrl = await uploadFileToOss(music[i].file, "music", (p) => {
              const baseProgress = 80 + (i / music.length) * 15;
              const stepProgress = (p / 100) * (15 / music.length);
              setUploadProgress(baseProgress + stepProgress);
            });
            musicUrls.push(musicUrl);
          }
        }

        // Create post
        setUploadProgress(95);
        setUploadStatus("正在保存...");

        // Use coverIndex and imageDuration from ImageTextUploadPage component
        const coverIdx = (window as any).__coverIndex ?? 0;
        const imgDuration = (window as any).__imageDuration ?? null;
        delete (window as any).__coverIndex;
        delete (window as any).__imageDuration;
        const coverUrl = imageUrls[coverIdx] || imageUrls[0];

        const res = await fetch("/api/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            coverUrl: coverUrl || undefined,
            postType: "image_text",
            imageUrls: JSON.stringify(imageUrls),
            musicUrls: musicUrls.length > 0 ? JSON.stringify(musicUrls) : undefined,
            imageDuration: imgDuration,
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
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-6xl px-4 py-6 sm:py-8"
    >
      <h1 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-100 sm:mb-6 sm:text-2xl">
        投稿
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

        {/* Tab buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "video"
                ? "bg-[#FB7299] text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            视频投稿
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("image_text")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "image_text"
                ? "bg-[#FB7299] text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            图文投稿
          </button>
        </div>

        {/* Video form */}
        {activeTab === "video" && (
          <VideoUploadPage
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            file={file}
            setFile={setFile}
            thumbnail={thumbnail}
            setThumbnail={setThumbnail}
            loading={loading}
            uploadProgress={uploadProgress}
            uploadStatus={uploadStatus}
            onSubmit={() => {
              const form = document.querySelector("form");
              if (form) form.requestSubmit();
            }}
          />
        )}

        {/* Image-text form */}
        {activeTab === "image_text" && (
          <ImageTextUploadPage
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            images={images}
            setImages={setImages}
            music={music}
            setMusic={setMusic}
            imageDuration={imageDuration}
            setImageDuration={setImageDuration}
            loading={loading}
            uploadProgress={uploadProgress}
            uploadStatus={uploadStatus}
            onSubmit={(coverIdx) => {
              // Store coverIndex and imageDuration for form submission
              (window as any).__coverIndex = coverIdx;
              (window as any).__imageDuration = imageDuration;
              // Directly call handleSubmit
              handleSubmit({ preventDefault: () => {} } as React.FormEvent);
            }}
          />
        )}
      </form>

      <CompressDialog
        open={compressDialogOpen}
        fileName={compressTarget?.file.name || ""}
        originalSize={compressTarget?.file.size || 0}
        compressedSize={compressTarget ? compressTarget.file.size * 0.9 : 0}
        type={compressTarget?.type || "image"}
        onConfirm={handleCompressConfirm}
        onCancel={() => {
          setCompressDialogOpen(false);
          setCompressTarget(null);
        }}
      />
    </motion.div>
  );
}
