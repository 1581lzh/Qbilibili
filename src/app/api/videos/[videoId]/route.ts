import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { videoUpdateSchema, validateInput } from "@/lib/validation";

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

  // Note: R2 files are not deleted server-side (server can't reach R2 S3 API from China).
  // R2 free tier is 10GB/month, acceptable for MVP. Files will be orphaned but won't cost anything.

  await db.$transaction(async (tx) => {
    await tx.commentLike.deleteMany({ where: { comment: { videoId } } });
    await tx.comment.deleteMany({ where: { videoId } });
    await tx.like.deleteMany({ where: { videoId } });
    await tx.favorite.deleteMany({ where: { videoId } });
    await tx.video.delete({ where: { id: videoId } });
  });

  return NextResponse.json({ success: true });
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
