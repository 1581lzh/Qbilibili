import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { videoUpdateSchema, validateInput } from "@/lib/validation";
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

    if (video.livePhotoVideos) {
      const liveVideos = JSON.parse(video.livePhotoVideos);
      if (Array.isArray(liveVideos)) {
        for (const vUrl of liveVideos) {
          const vKey = extractOssKey(vUrl);
          if (vKey) await oss.delete(vKey).catch(() => {});
        }
      }
    }
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

export async function PUT(
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
    return NextResponse.json({ error: "无权编辑" }, { status: 403 });
  }

  const body = await request.json();
  const validation = validateInput(videoUpdateSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const updateData = validation.data;

  const updatedVideo = await db.video.update({
    where: { id: videoId },
    data: {
      ...(updateData.title && { title: updateData.title }),
      ...(updateData.description !== undefined && { description: updateData.description }),
      ...(updateData.coverUrl && { coverUrl: updateData.coverUrl }),
      ...(updateData.imageUrls && { imageUrls: updateData.imageUrls }),
      ...(updateData.livePhotoVideos !== undefined && { livePhotoVideos: updateData.livePhotoVideos }),
      ...(updateData.imageDuration !== undefined && { imageDuration: updateData.imageDuration }),
    },
  });

  return NextResponse.json(updatedVideo);
}
