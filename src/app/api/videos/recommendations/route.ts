import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currentVideoId = searchParams.get("currentVideoId");

  const videos = await db.video.findMany({
    where: currentVideoId ? { id: { not: currentVideoId } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(videos);
}
