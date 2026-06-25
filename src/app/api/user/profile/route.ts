import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { profileUpdateSchema, validateInput } from "@/lib/validation";
import { requireValidOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      avatar: true,
      createdAt: true,
      _count: { select: { videos: true, likes: true, favorites: true, comments: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json();
  const validation = validateInput(profileUpdateSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, password } = validation.data;

  if (name) {
    const existing = await db.user.findFirst({
      where: { name, NOT: { id: session.user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "用户名已被占用" }, { status: 400 });
    }
  }

  const updateData: Record<string, any> = {};
  if (name) updateData.name = name;
  if (password) {
    updateData.password = password;
    updateData.tokenVersion = { increment: 1 };
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "没有需要更新的内容" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true },
  });

  return NextResponse.json(user);
}
