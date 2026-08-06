import { MotionPhotoParser } from "motion-photo";
import { normalizeHeicFile, isHeicFile } from "heic-normalize";
import JSZip from "jszip";

export interface LivePhotoPair {
  // The image File (after HEIC→JPEG conversion if needed)
  image: File;
  // The paired live-photo video File, or null if static image
  video: File | null;
  // Human-readable label for the source (e.g. "IMG_1234.HEIC")
  name: string;
}

export interface ProcessedImage {
  file: File;
  preview: string;
  livePhotoVideo: File | null;
}

const parser = new MotionPhotoParser();

const VIDEO_EXTENSIONS = ["mov", "mp4", "webm"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"];

function getExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function isVideoExt(ext: string): boolean {
  return VIDEO_EXTENSIONS.includes(ext);
}

function isImageExt(ext: string): boolean {
  return IMAGE_EXTENSIONS.includes(ext);
}

// 实况标记后缀：用于「相似名」配对，如 "1.jpg" 与 "1_实况.mp4"。
// 支持带序号变体（"1_实况2.mp4"）及多种命名（_live/live/_mov/mov）。
// 注意：剥离后缀后必须与图片基名完全相等，因此 "11.jpg" 与 "1.mp4" 不会误配。
const LIVE_MARKER_SUFFIXES = [
  "_实况", "实况",
  "_live", "live",
  "_mov", "mov",
];

/**
 * 匹配实况视频：先尝试与图片基名完全相等（同名），再尝试剥离实况标记后缀后相等（相似名）。
 * 返回匹配到的视频下标，未匹配返回 -1。
 */
function matchLiveVideo(base: string, videoFiles: File[], exclude: Set<number>): number {
  // 1. 精确同名
  for (let i = 0; i < videoFiles.length; i++) {
    if (exclude.has(i)) continue;
    if (stripExt(videoFiles[i].name).toLowerCase() === base) return i;
  }
  // 2. 相似名：视频基名去掉实况标记后缀（可带数字序号）后与图片基名完全相等
  for (let i = 0; i < videoFiles.length; i++) {
    if (exclude.has(i)) continue;
    const videoBase = stripExt(videoFiles[i].name).toLowerCase();
    for (const suffix of LIVE_MARKER_SUFFIXES) {
      // 纯后缀：如 "1_实况"
      if (videoBase.length > suffix.length && videoBase.endsWith(suffix)) {
        if (videoBase.slice(0, -suffix.length) === base) return i;
      }
      // 带序号后缀：如 "1_实况2"
      const numberedMatch = new RegExp(`^(.*?)${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+$`);
      const nm = videoBase.match(numberedMatch);
      if (nm && nm[1] === base) return i;
    }
  }
  return -1;
}

/**
 * Try to parse a single-file Motion Photo (JPEG with embedded MP4).
 * Returns { image, video } or null if it's a static image / not parseable.
 */
async function tryParseMotionPhoto(file: File): Promise<{ image: Blob; video: Blob } | null> {
  try {
    const parsed = await parser.parse(file);
    if (!parsed.hasVideo || !parsed.videoSrc || !parsed.imageSrc) return null;
    // parser returns blob URLs — fetch them back as blobs
    const imageRes = await fetch(parsed.imageSrc);
    const videoRes = await fetch(parsed.videoSrc);
    if (!imageRes.ok || !videoRes.ok) return null;
    const image = await imageRes.blob();
    const video = await videoRes.blob();
    // Revoke the temporary blob URLs
    try { URL.revokeObjectURL(parsed.imageSrc); } catch {}
    try { URL.revokeObjectURL(parsed.videoSrc); } catch {}
    if (image.size === 0 || video.size === 0) return null;
    return { image, video };
  } catch {
    return null;
  }
}

/**
 * Try to unpack a .livp archive (Apple Live Photo bundle: HEIC + MOV).
 * Returns the first image file and the first video file found.
 */
async function tryParseLivp(file: File): Promise<{ image: File; video: File; name: string } | null> {
  try {
    const zip = await JSZip.loadAsync(file);
    let imageFile: File | null = null;
    let videoFile: File | null = null;
    let baseName = stripExt(file.name);

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const ext = getExt(name);
      const parts = name.split("/");
      const leaf = parts[parts.length - 1];
      if (isImageExt(ext) && !imageFile) {
        const blob = await entry.async("blob");
        imageFile = new File([blob], leaf, { type: blob.type || "image/heic" });
      } else if (isVideoExt(ext) && !videoFile) {
        const blob = await entry.async("blob");
        videoFile = new File([blob], leaf, { type: blob.type || "video/quicktime" });
      }
    }

    if (!imageFile || !videoFile) return null;
    return { image: imageFile, video: videoFile, name: `${baseName}.livp` };
  } catch {
    return null;
  }
}

/**
 * Normalize an image file:
 * - HEIC/HEIF → JPEG via heic-normalize (Safari native + WASM fallback)
 * - Other formats pass through unchanged
 */
async function normalizeImage(file: File): Promise<File> {
  try {
    if (await isHeicFile(file)) {
      return await normalizeHeicFile(file, "image/jpeg");
    }
  } catch {}
  return file;
}

/**
 * Detect if a file is a single-file Motion Photo or .livp, and extract its paired video.
 * If the file is an Apple-style separate HEIC+unknown, returns null (handled by pairing logic).
 */
export async function extractLivePhoto(file: File): Promise<{ image: File; video: File | null; name: string } | null> {
  const ext = getExt(file.name);

  // 1. .livp archive
  if (ext === "livp") {
    return tryParseLivp(file);
  }

  // 2. Single-file Motion Photo (JPEG with embedded MP4)
  if (ext === "jpg" || ext === "jpeg") {
    const parsed = await tryParseMotionPhoto(file);
    if (parsed) {
      const image = await normalizeImage(new File([parsed.image], file.name, { type: "image/jpeg" }));
      const video = new File([parsed.video], stripExt(file.name) + ".mp4", { type: "video/mp4" });
      return { image, video, name: file.name };
    }
  }

  // 3. Plain image (or HEIC to be normalized) — no video
  return null;
}

/**
 * Read a video file's duration in seconds.
 * Resolves to null if the duration can't be determined (e.g. corrupted file).
 */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const cleanup = () => {
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
    const done = (value: number | null) => {
      cleanup();
      resolve(value);
    };
    video.onloadedmetadata = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        done(video.duration);
      } else {
        done(null);
      }
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

/**
 * Extract a poster frame (first frame by default) from a video file.
 * Draws the frame to a canvas and returns a Blob URL that can be used
 * as an <img>/<video poster> preview. Returns null on failure.
 * Note: callers should revoke the returned URL when no longer needed.
 */
export function extractVideoCover(file: File, time = 0): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - 0.05)));
      } catch {
        // seeking not yet ready; fall through
      }
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) {
            cleanup();
            resolve(null);
            return;
          }
          const coverUrl = URL.createObjectURL(blob);
          cleanup();
          resolve(coverUrl);
        }, "image/jpeg", 0.85);
      } catch {
        cleanup();
        resolve(null);
      }
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

/**
 * Quick check whether a batch of files contains anything that needs live-photo processing:
 * a .livp archive, a HEIC/HEIF image, or video files present alongside images (Apple split format).
 * If false, the caller can use the legacy plain-image upload path (with compression).
 */
export function needsLivePhotoProcessing(files: File[]): boolean {
  for (const f of files) {
    const ext = getExt(f.name);
    if (ext === "livp" || ext === "heic" || ext === "heif") return true;
  }
  const hasVideo = files.some((f) => isVideoExt(getExt(f.name)));
  const hasImage = files.some((f) => isImageExt(getExt(f.name)));
  if (hasVideo && hasImage) return true;
  // A .jpg motion photo can't be cheaply detected without reading bytes; let the
  // processor decide by attempting extraction (it's a no-op for plain JPEG).
  return false;
}

/**
 * Process a list of selected files (from file input) into image items with paired live-photo videos.
 * Handles:
 *  - Single-file Motion Photo / .livp → auto-extract to image+video pair
 *  - Apple separate HEIC/JPEG + MOV → auto-match by base filename
 *  - Plain images → static image (no video)
 * Returns an array of ProcessedImage, ordered as given.
 */
export async function processImageFiles(files: File[]): Promise<ProcessedImage[]> {
  // Group files by type
  const imageFiles: File[] = [];
  const videoFiles: File[] = [];

  for (const f of files) {
    const ext = getExt(f.name);
    if (ext === "livp" || ext === "jpg" || ext === "jpeg") {
      imageFiles.push(f); // may be motion photo, will be extracted below
    } else if (isVideoExt(ext)) {
      videoFiles.push(f);
    } else if (isImageExt(ext)) {
      imageFiles.push(f);
    }
    // else: ignore unsupported
  }

  // 1. First pass: extract self-contained formats (Motion Photo / .livp)
  const results: ProcessedImage[] = [];
  const remainingImages: File[] = [];
  const matchedVideos = new Set<number>();

  for (const f of imageFiles) {
    const extracted = await extractLivePhoto(f);
    if (extracted) {
      // Convert extracted image to a processed item
      const image = extracted.image;
      const imageFile = new File([image], image.name || f.name, { type: image.type || "image/jpeg" });
      const preview = URL.createObjectURL(imageFile);
      results.push({ file: imageFile, preview, livePhotoVideo: extracted.video });
      // If there was a video, mark any same-named video file as used
      if (extracted.video) {
        const base = stripExt(f.name).toLowerCase();
        const m = matchLiveVideo(base, videoFiles, matchedVideos);
        if (m !== -1) matchedVideos.add(m);
      }
    } else {
      remainingImages.push(f);
    }
  }

  // 2. Second pass: HEIC/plain images, match with same-named video files
  for (const f of remainingImages) {
    const normalized = await normalizeImage(f);
    const preview = URL.createObjectURL(normalized);
    const base = stripExt(f.name).toLowerCase();

    let matchedVideo: File | null = null;
    let matchedIdx = -1;
    const matchedIdx2 = matchLiveVideo(base, videoFiles, matchedVideos);
    if (matchedIdx2 !== -1) {
      matchedVideo = videoFiles[matchedIdx2];
      matchedIdx = matchedIdx2;
    }
    if (matchedIdx !== -1) matchedVideos.add(matchedIdx);

    results.push({ file: normalized, preview, livePhotoVideo: matchedVideo });
  }

  // 3. Third pass: leftover videos that had no matching image →
  //    convert into their own live-photo item (extract a cover frame).
  for (let i = 0; i < videoFiles.length; i++) {
    if (matchedVideos.has(i)) continue;
    const vf = videoFiles[i];
    try {
      const coverUrl = await extractVideoCover(vf, 0);
      if (coverUrl) {
        const blob = await (await fetch(coverUrl)).blob();
        const coverFile = new File([blob], stripExt(vf.name) + ".jpg", { type: "image/jpeg" });
        results.push({ file: coverFile, preview: coverUrl, livePhotoVideo: vf });
      }
    } catch {
      // 封面帧提取失败：忽略该视频
    }
  }

  return results;
}
