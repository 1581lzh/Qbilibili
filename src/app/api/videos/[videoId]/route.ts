import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import oss from "@/lib/oss";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { videoId } = await params;

  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json({ error: "视频不存在" }, { status: 404 });
  }

  if (video.authorId !== session.user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  try {
    const videoKey = extractOssKey(video.videoUrl);
    if (videoKey) await oss.delete(videoKey).catch(() => {});

    const coverKey = extractOssKey(video.coverUrl);
    if (coverKey) await oss.delete(coverKey).catch(() => {});
  } catch {
    // ignore file cleanup errors
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

function extractOssKey(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const key = parsed.pathname.slice(1);
    if (!key) return null;
    if (key.includes("..") || key.includes("\\")) return null;
    return key;
  } catch {
    return null;
  }
}
