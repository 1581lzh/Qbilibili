import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { addToQueue, startRenormalizeTracking, clearQueue, resetCancelled } from "@/lib/audio-queue";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const resetOnly = request.nextUrl.searchParams.get("reset") === "true";

  try {
    // Always clear queue and cancel ongoing processing
    clearQueue();

    // Reset progress
    await db.renormalizeProgress.upsert({
      where: { id: "singleton" },
      update: { isRunning: false, pending: 0 },
      create: { id: "singleton", total: 0, completed: 0, failed: 0, pending: 0, isRunning: false },
    });

    if (resetOnly) {
      return NextResponse.json({ success: true, message: "进度已重置" });
    }

    // Reset cancelled flag for new run
    resetCancelled();

    // Find all videos that have been normalized
    const videos = await db.video.findMany({
      where: {
        audioNormalized: true,
      },
      select: { id: true },
    });

    let addedCount = 0;
    for (const video of videos) {
      addToQueue(video.id);
      addedCount++;
    }

    if (addedCount > 0) {
      await startRenormalizeTracking(addedCount);
    }

    return NextResponse.json({
      success: true,
      message: `已添加 ${addedCount} 个视频到重新标准化队列`,
      totalNormalized: videos.length,
      addedToQueue: addedCount,
    });
  } catch (error) {
    console.error("Re-normalize failed:", error);
    return NextResponse.json(
      { error: "重新标准化失败" },
      { status: 500 }
    );
  }
}
