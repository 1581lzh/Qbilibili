import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      _count: {
        select: { videos: true, comments: true, likes: true, favorites: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function DELETE(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  if (user.name === "LZH") {
    return NextResponse.json({ error: "不能删除管理员" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    const videoIds = (await tx.video.findMany({ where: { authorId: userId }, select: { id: true } })).map((v) => v.id);

    if (videoIds.length > 0) {
      await tx.commentLike.deleteMany({ where: { comment: { videoId: { in: videoIds } } } });
      await tx.comment.deleteMany({ where: { videoId: { in: videoIds } } });
      await tx.like.deleteMany({ where: { videoId: { in: videoIds } } });
      await tx.favorite.deleteMany({ where: { videoId: { in: videoIds } } });
      await tx.video.deleteMany({ where: { authorId: userId } });
    }

    await tx.commentLike.deleteMany({ where: { userId } });
    await tx.comment.deleteMany({ where: { authorId: userId } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.favorite.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ success: true });
}
