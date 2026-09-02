import Link from "next/link";
import { db } from "@/lib/db";
import InfiniteVideoGrid from "@/components/video/infinite-video-grid";
import { VideoWithAuthor } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function HomePage() {
  const videos: VideoWithAuthor[] = await db.video.findMany({
    include: { author: { select: { id: true, name: true } }, _count: { select: { likes: true, favorites: true } } },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
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
        <InfiniteVideoGrid initialVideos={videos} />
      )}
    </div>
  );
}
