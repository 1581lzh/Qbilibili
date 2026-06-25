import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const videos = await db.video.findMany({
    where: { authorId: id },
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(videos);
}
