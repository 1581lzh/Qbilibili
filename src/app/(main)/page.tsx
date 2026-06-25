import Link from "next/link";
import { db } from "@/lib/db";
import VideoCard from "@/components/video/video-card";
import { VideoWithAuthor } from "@/types";

export default async function HomePage() {
  const videos: VideoWithAuthor[] = await db.video.findMany({
    include: { author: { select: { id: true, name: true } }, _count: { select: { likes: true, favorites: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <h1 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100 sm:mb-6 sm:text-2xl">
        推荐视频
      </h1>
      {videos.length === 0 ? (
        <div className="text-center text-zinc-500 dark:text-zinc-400">
          暂无视频，<Link href="/upload" className="text-[#FB7299] hover:underline">去投稿</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {videos.map((video, index) => (
            <VideoCard key={video.id} video={video} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
