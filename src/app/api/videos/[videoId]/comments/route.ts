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
          parent: { select: { id: true, author: { select: { name: true } } } },
          _count: { select: { likes: true, replies: true } },
          replies: {
            include: {
              author: { select: { id: true, name: true, avatar: true } },
              parent: { select: { id: true, author: { select: { name: true } } } },
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

  const parsedComments = comments.map((c) => ({
    ...c,
    images: c.images ? JSON.parse(c.images as string) : [],
    replies: c.replies.map((r) => {
      const parentComment = r.parentId ? comments.find((cc) => cc.id === r.parentId) : undefined;
      const parentReply = r.parentId && !parentComment ? r.parent : undefined;
      const replyToContent = parentComment?.content || (parentReply as any)?.content;
      const replyToImagesRaw = parentComment?.images || (parentReply as any)?.images;
      const replyToImages = replyToImagesRaw ? (JSON.parse(replyToImagesRaw as string) as string[]).length : undefined;

      return {
        ...r,
        images: r.images ? JSON.parse(r.images as string) : [],
        replyToName: r.parentId ? (r.parent?.author?.name || parentComment?.author?.name) : undefined,
        replyToContent,
        replyToImages,
        replies: r.replies?.map((rr) => {
          const rrParentReply = rr.parentId ? r : undefined;
          const rrReplyToContent = rrParentReply?.content;
          const rrReplyToImagesRaw = rrParentReply?.images;
          const rrReplyToImages = rrReplyToImagesRaw ? (JSON.parse(rrReplyToImagesRaw as string) as string[]).length : undefined;

          return {
            ...rr,
            images: rr.images ? JSON.parse(rr.images as string) : [],
            replyToName: rr.parentId ? (rr.parent?.author?.name || r.author?.name) : undefined,
            replyToContent: rrReplyToContent,
            replyToImages: rrReplyToImages,
          };
        }),
      };
    }),
  }));

  return NextResponse.json({ comments: parsedComments, likedCommentIds, likedReplyIds });
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

  const { content, parentId, images } = validation.data;

  if (parentId) {
    const parentComment = await db.comment.findUnique({ where: { id: parentId } });
    if (!parentComment || parentComment.videoId !== videoId) {
      return NextResponse.json({ error: "父评论不存在" }, { status: 400 });
    }
  }

  const comment = await db.comment.create({
    data: {
      content: content?.trim() || "",
      videoId,
      authorId: session.user.id,
      parentId: parentId || null,
      images: images ? JSON.stringify(images) : null,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      _count: { select: { likes: true } },
    },
  });

  let replyToName: string | undefined;
  let replyToContent: string | undefined;
  let replyToImages: number | undefined;
  if (parentId) {
    const parentComment = await db.comment.findUnique({
      where: { id: parentId },
      select: {
        author: { select: { name: true } },
        content: true,
        images: true,
      },
    });
    replyToName = parentComment?.author?.name;
    replyToContent = parentComment?.content;
    if (parentComment?.images) {
      const parsedImages = JSON.parse(parentComment.images as string);
      replyToImages = Array.isArray(parsedImages) ? parsedImages.length : 0;
    }
  }

  return NextResponse.json({
    ...comment,
    images: comment.images ? JSON.parse(comment.images as string) : [],
    replyToName,
    replyToContent,
    replyToImages,
  });
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

  // BFS to collect all descendant comment IDs (iterative, no N+1)
  const allIds: string[] = [commentId];
  let queue = [commentId];
  while (queue.length > 0) {
    const children = await db.comment.findMany({
      where: { parentId: { in: queue } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    allIds.push(...childIds);
    queue = childIds;
  }
  await db.commentLike.deleteMany({ where: { commentId: { in: allIds } } });
  await db.comment.deleteMany({ where: { id: { in: allIds } } });
  return NextResponse.json({ success: true });
}
