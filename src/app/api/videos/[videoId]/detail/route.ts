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

  const allVideos = await db.video.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const currentIndex = allVideos.findIndex((v) => v.id === videoId);
  const nextVideo =
    currentIndex >= 0 && currentIndex < allVideos.length - 1
      ? allVideos[currentIndex + 1]
      : null;
  const prevVideo =
    currentIndex > 0
      ? allVideos[currentIndex - 1]
      : null;

  const [likeCount, favoriteCount] = await Promise.all([
    db.like.count({ where: { videoId } }),
    db.favorite.count({ where: { videoId } }),
  ]);

  let liked = false;
  let favorited = false;
  const session = await getSession();
  if (session?.user?.id) {
    const [existingLike, existingFavorite] = await Promise.all([
      db.like.findUnique({ where: { videoId_userId: { videoId, userId: session.user.id } } }),
      db.favorite.findUnique({ where: { videoId_userId: { videoId, userId: session.user.id } } }),
    ]);
    liked = !!existingLike;
    favorited = !!existingFavorite;
  }

  return NextResponse.json({
    id: video.id,
    title: video.title,
    description: video.description,
    coverUrl: video.coverUrl,
    videoUrl: video.videoUrl,
    vodVideoId: video.vodVideoId,
    author: video.author,
    createdAt: video.createdAt,
    nextVideoId: nextVideo?.id ?? null,
    prevVideoId: prevVideo?.id ?? null,
    likeCount,
    favoriteCount,
    liked,
    favorited,
  });
}
