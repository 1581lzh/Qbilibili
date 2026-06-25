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

  const existing = await db.favorite.findUnique({
    where: { videoId_userId: { videoId, userId } },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  } else {
    await db.favorite.create({ data: { videoId, userId } });
    return NextResponse.json({ favorited: true });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await getSession();
  const { videoId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ favorited: false });
  }

  const existing = await db.favorite.findUnique({
    where: { videoId_userId: { videoId, userId: session.user.id } },
  });

  return NextResponse.json({ favorited: !!existing });
}
