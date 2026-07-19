import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    include: { author: { select: { id: true, name: true } } },
  });

  if (!video) {
    return NextResponse.json({ error: "视频不存在" }, { status: 404 });
  }

  const session = await getSession();
  const userId = session?.user?.id;

  const [likeCount, favoriteCount, existingLike, existingFavorite, nextVideo, prevVideo] = await Promise.all([
    db.like.count({ where: { videoId } }),
    db.favorite.count({ where: { videoId } }),
    userId ? db.like.findUnique({ where: { videoId_userId: { videoId, userId } } }) : null,
    userId ? db.favorite.findUnique({ where: { videoId_userId: { videoId, userId } } }) : null,
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

  return NextResponse.json({
    id: video.id,
    title: video.title,
    description: video.description,
    coverUrl: video.coverUrl,
    videoUrl: video.videoUrl,
    vodVideoId: video.vodVideoId,
    audioNormalized: video.audioNormalized,
    normalizedUrl: video.normalizedUrl,
    author: video.author,
    createdAt: video.createdAt,
    nextVideoId: nextVideo?.id ?? null,
    prevVideoId: prevVideo?.id ?? null,
    likeCount,
    favoriteCount,
    liked: !!existingLike,
    favorited: !!existingFavorite,
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, max-age=300" },
  });
}
