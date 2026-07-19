import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const likes = await db.like.findMany({
    where: { userId: session.user.id },
    include: {
      video: {
        include: {
          author: { select: { id: true, name: true } },
          _count: { select: { likes: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(likes.map((l) => l.video));
}
