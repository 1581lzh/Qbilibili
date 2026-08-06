import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireValidOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";

const VALID_THEMES = ["light", "dark", "system"];

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ theme: "system" });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true },
  });

  const theme = VALID_THEMES.includes(user?.theme ?? "") ? user!.theme : "system";

  return NextResponse.json({ theme });
}

export async function PUT(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  if (!VALID_THEMES.includes(body.theme)) {
    return NextResponse.json({ error: "无效的主题" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { theme: body.theme },
  });

  return NextResponse.json({ theme: body.theme });
}
