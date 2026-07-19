import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const myComments = await db.comment.findMany({
    where: { authorId: session.user.id },
    select: { id: true },
  });

  const myCommentIds = myComments.map((c) => c.id);

  const receivedLikes = await db.commentLike.findMany({
    where: { commentId: { in: myCommentIds } },
    include: {
      comment: {
        include: {
          video: { select: { id: true, title: true, coverUrl: true } },
          parent: {
            select: { id: true, content: true, author: { select: { name: true } } },
          },
          _count: { select: { likes: true, replies: true } },
        },
      },
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(receivedLikes);
}
