import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ volume: 1, muted: false });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { volume: true, muted: true },
  });

  const volume =
    typeof user?.volume === "number" && user.volume >= 0 && user.volume <= 1 ? user.volume : 1;
  const muted = typeof user?.muted === "boolean" ? user.muted : false;

  return NextResponse.json({ volume, muted });
}

export async function PUT(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const volume = typeof body.volume === "number" && body.volume >= 0 && body.volume <= 1 ? body.volume : 1;
  const muted = typeof body.muted === "boolean" ? body.muted : false;

  await db.user.update({
    where: { id: session.user.id },
    data: { volume, muted },
  });

  return NextResponse.json({ volume, muted });
}
