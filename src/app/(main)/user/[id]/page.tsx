"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { optimizedCover } from "@/lib/image";
import { setAutoPlayVideo } from "@/lib/signals";

const AVATAR_COLORS = [
  "bg-pink-500", "bg-violet-500", "bg-blue-500", "bg-cyan-500",
  "bg-green-500", "bg-amber-500", "bg-red-500", "bg-indigo-500",
];

interface UserProfile {
  id: string;
  name: string;
  createdAt: string;
  _count: { videos: number; likes: number; favorites: number; comments: number };
}

interface VideoItem {
  id: string;
  title: string;
  coverUrl: string;
  author: { id: string; name: string };
  _count: { likes: number };
}

export default function UserPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => setResolvedId(id));
  }, [params]);

  useEffect(() => {
    if (!resolvedId) return;
    if (session?.user?.id === resolvedId) {
      router.replace("/profile");
      return;
    }
    Promise.all([
      fetch(`/api/user/${resolvedId}`).then((r) => r.json()),
      fetch(`/api/user/${resolvedId}/videos`).then((r) => r.json()),
    ]).then(([profileData, videosData]) => {
      setProfile(profileData);
      setVideos(videosData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session, router, resolvedId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-2 py-4 sm:px-4 sm:py-6">
        <div className="text-center text-zinc-500">加载中...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl px-2 py-4 sm:px-4 sm:py-6">
        <div className="text-center text-zinc-500">用户不存在</div>
      </div>
    );
  }

  const hash = (() => {
    let h = 0;
    for (let i = 0; i < profile.name.length; i++) {
      h = profile.name.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h);
  })();
  const avatarColor = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return (
    <div className="mx-auto max-w-4xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="flex items-center gap-3 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900 sm:gap-4 sm:p-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white sm:h-16 sm:w-16 sm:text-2xl ${avatarColor}`}>
          {profile.name[0]}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:text-xl">
            {profile.name}
          </h1>
          <p className="text-xs text-zinc-500 sm:text-sm">
            {profile._count.videos} 投稿 · {profile._count.likes} 获赞 · {profile._count.favorites} 收藏
          </p>
        </div>
      </div>

      <div className="mt-4 sm:mt-6">
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100 sm:mb-4 sm:text-lg">
          TA 的投稿
        </h2>
        {videos.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">暂无投稿</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {videos.map((v) => (
              <Link key={v.id} href={`/video/${v.id}`} className="group block" onClick={() => setAutoPlayVideo(v.id)}>
                <div className="overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  <img
                    src={optimizedCover(v.coverUrl)}
                    alt={v.title}
                    width={640}
                    height={360}
                    loading="lazy"
                    decoding="async"
                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-[#FB7299]">
                  {v.title}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">{v._count.likes} 赞</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
