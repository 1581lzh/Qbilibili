import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const comments = await db.comment.findMany({
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      video: { select: { id: true, title: true, coverUrl: true } },
      _count: { select: { likes: true, replies: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

export async function DELETE(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { commentId } = await request.json();
  if (!commentId) {
    return NextResponse.json({ error: "缺少评论ID" }, { status: 400 });
  }

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    const collectDescendants = async (parentId: string): Promise<string[]> => {
      const children = await tx.comment.findMany({ where: { parentId }, select: { id: true } });
      let ids: string[] = children.map((c) => c.id);
      for (const child of children) {
        ids = ids.concat(await collectDescendants(child.id));
      }
      return ids;
    };

    const allReplyIds = await collectDescendants(commentId);
    const allIds = [commentId, ...allReplyIds];

    await tx.commentLike.deleteMany({ where: { commentId: { in: allIds } } });
    await tx.comment.deleteMany({ where: { id: { in: allIds } } });
  });

  return NextResponse.json({ success: true });
}
