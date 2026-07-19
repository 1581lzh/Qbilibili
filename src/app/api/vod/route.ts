import { getSession } from "@/lib/auth";
import { createUploadVideo, getVideoPlayAuth, refreshUploadVideo } from "@/lib/vod";
import { requireValidOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  try {
    const { action, title, videoId, fileName } = await request.json();

    if (action === "playAuth") {
      if (!videoId) {
        return NextResponse.json({ error: "缺少 videoId" }, { status: 400 });
      }
      const auth = await getVideoPlayAuth(videoId);
      return NextResponse.json(auth);
    }

    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    if (action === "create") {
      if (!title?.trim()) {
        return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
      }
      const auth = await createUploadVideo(title.trim(), fileName);
      return NextResponse.json(auth);
    }

    if (action === "refresh") {
      if (!videoId) {
        return NextResponse.json({ error: "缺少 videoId" }, { status: 400 });
      }
      const auth = await refreshUploadVideo(videoId);
      return NextResponse.json(auth);
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (err) {
    console.error("VOD API error:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" && err instanceof Error ? err.message : "VOD 请求失败" },
      { status: 500 }
    );
  }
}
