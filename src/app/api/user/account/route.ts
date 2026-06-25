import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { password } = await request.json();
  if (!password) {
    return NextResponse.json({ error: "请输入密码" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.password !== password) {
    return NextResponse.json({ error: "密码错误" }, { status: 400 });
  }

  const userId = session.user.id;

  try {
    await db.$transaction(async (tx) => {
      const userVideos = await tx.video.findMany({
        where: { authorId: userId },
        select: { id: true },
      });
      const videoIds = userVideos.map((v) => v.id);

      if (videoIds.length > 0) {
        await tx.commentLike.deleteMany({
          where: { comment: { videoId: { in: videoIds } } },
        });
        await tx.comment.deleteMany({
          where: { videoId: { in: videoIds } },
        });
        await tx.like.deleteMany({ where: { videoId: { in: videoIds } } });
        await tx.favorite.deleteMany({ where: { videoId: { in: videoIds } } });
        await tx.video.deleteMany({ where: { authorId: userId } });
      }

      const userComments = await tx.comment.findMany({
        where: { authorId: userId },
        select: { id: true },
      });
      const commentIds = userComments.map((c) => c.id);

      if (commentIds.length > 0) {
        await tx.commentLike.deleteMany({
          where: { commentId: { in: commentIds } },
        });
      }

      await tx.commentLike.deleteMany({ where: { userId } });
      await tx.like.deleteMany({ where: { userId } });
      await tx.favorite.deleteMany({ where: { userId } });
      await tx.comment.deleteMany({ where: { authorId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "注销失败" }, { status: 500 });
  }
}