import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { videoSchema, validateInput } from "@/lib/validation";
import { requireValidOrigin } from "@/lib/csrf";
import { addToQueue } from "@/lib/audio-queue";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const validation = validateInput(videoSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title, description, coverUrl, videoUrl, vodVideoId, postType, imageUrls, musicUrl, musicUrls, imageDuration } = validation.data;

  // Parse musicUrls array and use first URL
  let finalMusicUrl = musicUrl || null;
  let finalMusicUrls = musicUrls || null;
  if (!finalMusicUrl && musicUrls) {
    try {
      const urls = JSON.parse(musicUrls);
      if (Array.isArray(urls) && urls.length > 0) {
        finalMusicUrl = urls[0];
      }
    } catch {}
  }

  const video = await db.video.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      coverUrl: coverUrl || "/placeholder.svg",
      videoUrl: videoUrl || "",
      vodVideoId: vodVideoId || null,
      postType,
      imageUrls: imageUrls || null,
      musicUrl: finalMusicUrl,
      musicUrls: finalMusicUrls,
      imageDuration: imageDuration || null,
      authorId: session.user.id,
    },
  });

  // Add to audio normalization queue for all videos with playable content
  if (videoUrl || vodVideoId || (postType === "image_text" && finalMusicUrl)) {
    addToQueue(video.id);
  }

  return NextResponse.json(video);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

  const where = q
    ? {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { author: { name: { contains: q } } },
        ],
      }
    : undefined;

  const videos = await db.video.findMany({
    where,
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { likes: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
    take: q ? undefined : limit,
  });

  return NextResponse.json(videos);
}
