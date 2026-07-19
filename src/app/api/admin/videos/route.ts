import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const videos = await db.video.findMany({
    select: {
      id: true,
      title: true,
      coverUrl: true,
      views: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      _count: { select: { likes: true, comments: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(videos);
}

export async function DELETE(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { videoId } = await request.json();
  if (!videoId) {
    return NextResponse.json({ error: "缺少视频ID" }, { status: 400 });
  }

  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json({ error: "视频不存在" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.commentLike.deleteMany({ where: { comment: { videoId } } });
    await tx.comment.deleteMany({ where: { videoId } });
    await tx.like.deleteMany({ where: { videoId } });
    await tx.favorite.deleteMany({ where: { videoId } });
    await tx.video.delete({ where: { id: videoId } });
  });

  return NextResponse.json({ success: true });
}
