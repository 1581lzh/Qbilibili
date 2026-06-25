import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { commentSchema, validateInput } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  let session = null;
  try { session = await getSession(); } catch {}
  const { videoId } = await params;

  const comments = await db.comment.findMany({
    where: { videoId, parentId: null },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      _count: { select: { likes: true, replies: true } },
      replies: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          _count: { select: { likes: true, replies: true } },
          replies: {
            include: {
              author: { select: { id: true, name: true, avatar: true } },
              _count: { select: { likes: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const likedCommentIds: string[] = [];
  const likedReplyIds: string[] = [];
  if (session?.user?.id) {
    const userLikes = await db.commentLike.findMany({
      where: { userId: session.user.id },
      select: { commentId: true },
    });
    const likeSet = new Set(userLikes.map((l) => l.commentId));
    comments.forEach((c) => {
      if (likeSet.has(c.id)) likedCommentIds.push(c.id);
      c.replies.forEach((r) => {
        if (likeSet.has(r.id)) likedReplyIds.push(r.id);
        r.replies?.forEach((rr) => {
          if (likeSet.has(rr.id)) likedReplyIds.push(rr.id);
        });
      });
    });
  }

  return NextResponse.json({ comments, likedCommentIds, likedReplyIds });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`comment:${session.user.id}`, RATE_LIMITS.comment);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "评论过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  const { videoId } = await params;
  const body = await request.json();
  const validation = validateInput(commentSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { content, parentId } = validation.data;

  if (parentId) {
    const parentComment = await db.comment.findUnique({ where: { id: parentId } });
    if (!parentComment || parentComment.videoId !== videoId) {
      return NextResponse.json({ error: "父评论不存在" }, { status: 400 });
    }
  }

  const comment = await db.comment.create({
    data: {
      content: content.trim(),
      videoId,
      authorId: session.user.id,
      parentId: parentId || null,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      _count: { select: { likes: true } },
    },
  });

  return NextResponse.json(comment);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { videoId } = await params;
  const { commentId } = await request.json();

  if (!commentId) {
    return NextResponse.json({ error: "缺少评论ID" }, { status: 400 });
  }

  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }
  if (comment.videoId !== videoId) {
    return NextResponse.json({ error: "评论不属于该视频" }, { status: 400 });
  }
  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: "只能删除自己的评论" }, { status: 403 });
  }

  const collectDescendants = async (parentId: string): Promise<string[]> => {
    const children = await db.comment.findMany({
      where: { parentId },
      select: { id: true },
    });
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...await collectDescendants(child.id));
    }
    return ids;
  };

  const allIds = [commentId, ...(await collectDescendants(commentId))];
  await db.commentLike.deleteMany({ where: { commentId: { in: allIds } } });
  await db.comment.deleteMany({ where: { id: { in: allIds } } });
  return NextResponse.json({ success: true });
}
