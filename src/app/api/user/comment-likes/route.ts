import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const commentLikes = await db.commentLike.findMany({
    where: { userId: session.user.id },
    include: {
      comment: {
        include: {
          video: { select: { id: true, title: true, coverUrl: true } },
          author: { select: { id: true, name: true, avatar: true } },
          parent: {
            select: { id: true, content: true, author: { select: { name: true } } },
          },
          _count: { select: { likes: true, replies: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(commentLikes.map((cl) => cl.comment));
}
