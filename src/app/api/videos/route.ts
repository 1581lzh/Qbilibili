import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { videoSchema, validateInput } from "@/lib/validation";
import { requireValidOrigin } from "@/lib/csrf";
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

  const { title, description, coverUrl, videoUrl, vodVideoId } = validation.data;

  const video = await db.video.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      coverUrl: coverUrl || `https://picsum.photos/seed/${Date.now()}/640/360`,
      videoUrl: videoUrl || "",
      vodVideoId: vodVideoId || null,
      authorId: session.user.id,
    },
  });

  return NextResponse.json(video);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

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
  });

  return NextResponse.json(videos);
}
