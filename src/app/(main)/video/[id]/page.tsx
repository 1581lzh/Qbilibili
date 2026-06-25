import VideoPlaySection from "@/components/video/video-play-section";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const video = await db.video.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true } } },
  });

  if (!video) {
    notFound();
  }

  const likeCount = await db.like.count({ where: { videoId: id } });
  const favoriteCount = await db.favorite.count({ where: { videoId: id } });
  const session = await getSession();
  const isOwner = session?.user?.id === video.authorId;

  let initialLiked = false;
  let initialFavorited = false;
  if (session?.user?.id) {
    const existingLike = await db.like.findUnique({
      where: { videoId_userId: { videoId: id, userId: session.user.id } },
    });
    initialLiked = !!existingLike;
    const existingFavorite = await db.favorite.findUnique({
      where: { videoId_userId: { videoId: id, userId: session.user.id } },
    });
    initialFavorited = !!existingFavorite;
  }

  const allVideos: { id: string }[] = await db.video.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const currentIndex = allVideos.findIndex((v) => v.id === id);
  const nextVideoId =
    currentIndex >= 0 && currentIndex < allVideos.length - 1
      ? allVideos[currentIndex + 1].id
      : null;
  const prevVideoId =
    currentIndex > 0
      ? allVideos[currentIndex - 1].id
      : null;

  return (
    <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <VideoPlaySection
        video={{
          id: video.id,
          title: video.title,
          description: video.description,
          coverUrl: video.coverUrl,
          videoUrl: video.videoUrl,
          vodVideoId: video.vodVideoId,
          author: video.author,
          createdAt: video.createdAt,
        }}
        nextVideoId={nextVideoId ?? undefined}
        prevVideoId={prevVideoId ?? undefined}
        isOwner={isOwner}
        initialLikeCount={likeCount}
        initialLiked={initialLiked}
        initialFavoriteCount={favoriteCount}
        initialFavorited={initialFavorited}
        userId={session?.user?.id}
      />
    </div>
  );
}
