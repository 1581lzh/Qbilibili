import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { videoId } = await params;
  const userId = session.user.id;

  const existing = await db.like.findUnique({
    where: { videoId_userId: { videoId, userId } },
  });

  if (existing) {
    await db.like.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  } else {
    await db.like.create({ data: { videoId, userId } });
    return NextResponse.json({ liked: true });
  }
}
