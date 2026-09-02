import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac } from "crypto";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;
const WORKER_URL = "https://your-worker.workers.dev/r2-upload";
const UPLOAD_TOKEN_SECRET = process.env.UPLOAD_TOKEN_SECRET!;

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 900): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn });
  return { uploadUrl, publicUrl: `${R2_PUBLIC_URL}/${key}` };
}

export async function getPresignedDeleteUrl(key: string, expiresIn = 900): Promise<string> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

export function extractR2Key(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const key = parsed.pathname.slice(1);
    if (!key) return null;
    if (key.includes("..") || key.includes("\\")) return null;
    return key;
  } catch {
    return null;
  }
}

export function generateR2Key(type: "video" | "cover" | "image" | "music", ext: string): string {
  const dir = type === "music" ? "music" : type === "video" ? "videos" : type === "cover" ? "covers" : "images";
  return `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export function generateUploadToken(key: string, contentType: string): string {
  const payload = { key, ct: contentType, exp: Date.now() + 15 * 60 * 1000 };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = createHmac("sha256", UPLOAD_TOKEN_SECRET).update(payloadStr).digest("hex");
  return `${payloadStr}.${signature}`;
}

export function getWorkerUploadUrl(key: string, contentType: string): { uploadUrl: string; publicUrl: string } {
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;
  const token = generateUploadToken(key, contentType);
  const uploadUrl = `${WORKER_URL}/upload?token=${encodeURIComponent(token)}&key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}&publicUrl=${encodeURIComponent(publicUrl)}`;
  return { uploadUrl, publicUrl };
}
