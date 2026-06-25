import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import oss from "@/lib/oss";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireValidOrigin } from "@/lib/csrf";

export const maxDuration = 300;

const VIDEO_MAX_SIZE = 500 * 1024 * 1024;
const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "flv", "mkv"];
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

export async function POST(request: NextRequest) {
  const originError = requireValidOrigin(request);
  if (originError) return originError;

  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`upload:${session.user.id}`, RATE_LIMITS.upload);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "上传过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const isVideo = type === "video" || file.type.startsWith("video/");
    const isImage = type === "cover" || file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
    const allowedExtensions = isVideo ? ALLOWED_VIDEO_EXTENSIONS : ALLOWED_IMAGE_EXTENSIONS;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大 ${isVideo ? "500MB" : "5MB"}）` },
        { status: 400 }
      );
    }

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式：.${ext}` },
        { status: 400 }
      );
    }

    const safeExt = ext || (isVideo ? "mp4" : "png");
    const dir = isVideo ? "videos" : "covers";
    const filename = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await oss.put(filename, buffer);

    const url = oss.generateObjectUrl(filename);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
