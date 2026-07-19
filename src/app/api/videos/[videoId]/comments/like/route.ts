import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { commentId } = await request.json();
  const userId = session.user.id;

  if (!commentId) {
    return NextResponse.json({ error: "缺少评论ID" }, { status: 400 });
  }

  const existing = await db.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing) {
    await db.commentLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  } else {
    await db.commentLike.create({ data: { commentId, userId } });
    return NextResponse.json({ liked: true });
  }
}
