import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const [totalUsers, totalVideos, totalComments, totalLikes, totalCommentLikes, totalFavorites] = await Promise.all([
    db.user.count(),
    db.video.count(),
    db.comment.count(),
    db.like.count(),
    db.commentLike.count(),
    db.favorite.count(),
  ]);

  return NextResponse.json({
    totalUsers,
    totalVideos,
    totalComments,
    totalLikes,
    totalCommentLikes,
    totalFavorites,
  });
}
