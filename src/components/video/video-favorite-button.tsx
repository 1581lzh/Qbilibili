"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function VideoFavoriteButton({
  videoId,
  initialCount = 0,
  initialFavorited = false,
}: {
  videoId: string;
  initialCount?: number;
  initialFavorited?: boolean;
}) {
  const { data: session } = useSession();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleFavorite = async () => {
    if (!session?.user || loading) return;
    const prevFavorited = favorited;
    const prevCount = count;
    const newFavorited = !prevFavorited;
    setFavorited(newFavorited);
    setCount((c) => (newFavorited ? c + 1 : c - 1));
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFavorited(data.favorited);
      setCount((c) => (data.favorited ? prevCount + 1 : prevCount - 1));
    } catch {
      setFavorited(prevFavorited);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleFavorite}
      disabled={!session?.user || loading}
      whileTap={{ scale: 0.95 }}
      animate={favorited ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        favorited
          ? "bg-amber-500 text-white"
          : "border border-zinc-300 text-zinc-600 hover:border-amber-500 hover:text-amber-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-amber-500 dark:hover:text-amber-500"
      } disabled:opacity-50`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={favorited ? 0 : 2}
        className="h-4 w-4"
      >
        <path
          fillRule="evenodd"
          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005z"
          clipRule="evenodd"
        />
      </svg>
      {count > 0 && count}
      {favorited ? "已收藏" : "收藏"}
    </motion.button>
  );
}
