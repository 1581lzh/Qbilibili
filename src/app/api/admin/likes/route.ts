import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const likes = await db.like.findMany({
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
      video: { select: { id: true, title: true, coverUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(likes);
}

export async function DELETE(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user || session.user.name !== "LZH") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { likeId } = await request.json();
  if (!likeId) {
    return NextResponse.json({ error: "缺少点赞ID" }, { status: 400 });
  }

  await db.like.delete({ where: { id: likeId } });
  return NextResponse.json({ success: true });
}
