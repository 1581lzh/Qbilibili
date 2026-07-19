import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import oss from "@/lib/oss";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireValidOrigin } from "@/lib/csrf";
import { Readable } from "node:stream";

export const maxDuration = 300;

const VIDEO_MAX_SIZE = 500 * 1024 * 1024;
const IMAGE_MAX_SIZE = 15 * 1024 * 1024;
const MUSIC_MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "flv", "mkv"];
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
const ALLOWED_MUSIC_EXTENSIONS = ["mp3", "wav", "ogg", "aac", "flac"];

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
    const isCover = type === "cover";
    const isImage = type === "image" || (file.type.startsWith("image/") && !isCover);
    const isMusic = type === "music" || file.type.startsWith("audio/");

    if (!isVideo && !isCover && !isImage && !isMusic) {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    let maxSize: number;
    let allowedExtensions: string[];
    let maxLabel: string;

    if (isMusic) {
      maxSize = MUSIC_MAX_SIZE;
      allowedExtensions = ALLOWED_MUSIC_EXTENSIONS;
      maxLabel = "50MB";
    } else if (isVideo) {
      maxSize = VIDEO_MAX_SIZE;
      allowedExtensions = ALLOWED_VIDEO_EXTENSIONS;
      maxLabel = "500MB";
    } else {
      maxSize = IMAGE_MAX_SIZE;
      allowedExtensions = ALLOWED_IMAGE_EXTENSIONS;
      maxLabel = "15MB";
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大 ${maxLabel}）` },
        { status: 400 }
      );
    }

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式：.${ext}` },
        { status: 400 }
      );
    }

    const defaultExt = isMusic ? "mp3" : isVideo ? "mp4" : "png";
    const safeExt = ext || defaultExt;
    const dir = isMusic ? "music" : isVideo ? "videos" : isCover ? "covers" : "images";
    const filename = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    // Stream upload for large files (>5MB) to avoid buffering entire file in memory
    const STREAM_THRESHOLD = 5 * 1024 * 1024;
    if (file.size > STREAM_THRESHOLD) {
      const nodeStream = Readable.fromWeb(file.stream() as any);
      await oss.putStream(filename, nodeStream, {
        mime: file.type || "application/octet-stream",
      } as any);
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      await oss.put(filename, buffer);
    }

    const url = oss.generateObjectUrl(filename);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
