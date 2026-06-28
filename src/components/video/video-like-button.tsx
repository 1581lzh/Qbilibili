"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function VideoLikeButton({
  videoId,
  initialCount,
  initialLiked = false,
}: {
  videoId: string;
  initialCount: number;
  initialLiked?: boolean;
}) {
  const { data: session } = useSession();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (!session?.user || loading) return;
    const prevLiked = liked;
    const prevCount = count;
    const newLiked = !prevLiked;
    setLiked(newLiked);
    setCount((c) => (newLiked ? c + 1 : c - 1));
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setCount((c) => (data.liked ? prevCount + 1 : prevCount - 1));
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleLike}
      disabled={!session?.user || loading}
      whileTap={{ scale: 0.95 }}
      animate={liked ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        liked
          ? "bg-[#FB7299] text-white"
          : "border border-zinc-300 text-zinc-600 hover:border-[#FB7299] hover:text-[#FB7299] dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-[#FB7299] dark:hover:text-[#FB7299]"
      } disabled:opacity-50`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-4 w-4"
      >
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.007-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
      {count > 0 && count}
      点赞
    </motion.button>
  );
}
