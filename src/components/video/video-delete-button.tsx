"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VideoDeleteButton({ videoId, postType }: { videoId: string; postType?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isImageText = postType === "image_text";

  const handleDelete = async () => {
    const confirmMsg = isImageText ? "确定要删除这个图文吗？此操作不可恢复。" : "确定要删除这个视频吗？此操作不可恢复。";
    if (!confirm(confirmMsg)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "删除失败");
        return;
      }
      window.location.href = "/";
    } catch {
      alert("删除失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const btnText = loading ? "删除中..." : isImageText ? "删除图文" : "删除视频";

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-500 hover:text-red-500 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:border-red-500 dark:hover:text-red-400"
    >
      {btnText}
    </button>
  );
}
