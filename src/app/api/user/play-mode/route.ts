import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";

const VALID_MODES = ["loop", "single", "next"];

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ playMode: "loop" });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { playMode: true },
  });

  return NextResponse.json({ playMode: user?.playMode ?? "loop" });
}

export async function PUT(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.playMode || !VALID_MODES.includes(body.playMode)) {
    return NextResponse.json({ error: "无效的播放模式" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { playMode: body.playMode },
  });

  return NextResponse.json({ playMode: body.playMode });
}
