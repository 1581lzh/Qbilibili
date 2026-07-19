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

  const session = await getSession();
  const isOwner = session?.user?.id === video.authorId;
  const userId = session?.user?.id;

  const [likeCount, favoriteCount, existingLike, existingFavorite, nextVideo, prevVideo] = await Promise.all([
    db.like.count({ where: { videoId: id } }),
    db.favorite.count({ where: { videoId: id } }),
    userId ? db.like.findUnique({ where: { videoId_userId: { videoId: id, userId } } }) : null,
    userId ? db.favorite.findUnique({ where: { videoId_userId: { videoId: id, userId } } }) : null,
    db.video.findFirst({
      where: { createdAt: { lt: video.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.video.findFirst({
      where: { createdAt: { gt: video.createdAt } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

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
          audioNormalized: video.audioNormalized,
          normalizedUrl: video.normalizedUrl,
          postType: video.postType,
          imageUrls: video.imageUrls,
          musicUrl: video.musicUrl,
          imageDuration: video.imageDuration,
          author: video.author,
          createdAt: video.createdAt,
        }}
        nextVideoId={nextVideo?.id}
        prevVideoId={prevVideo?.id}
        isOwner={isOwner}
        initialLikeCount={likeCount}
        initialLiked={!!existingLike}
        initialFavoriteCount={favoriteCount}
        initialFavorited={!!existingFavorite}
        userId={session?.user?.id}
      />
    </div>
  );
}
