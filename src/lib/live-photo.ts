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
        videoFiles.forEach((v, idx) => {
          if (stripExt(v.name).toLowerCase() === base) matchedVideos.add(idx);
        });
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
    for (let i = 0; i < videoFiles.length; i++) {
      if (matchedVideos.has(i)) continue;
      if (stripExt(videoFiles[i].name).toLowerCase() === base) {
        matchedVideo = videoFiles[i];
        matchedIdx = i;
        break;
      }
    }
    if (matchedIdx !== -1) matchedVideos.add(matchedIdx);

    results.push({ file: normalized, preview, livePhotoVideo: matchedVideo });
  }

  // 3. Third pass: leftover videos that had no image — ignore (or could pair with next unmatched image)
  // (Deliberately skipped: without a clear image to pair with, dropping is safer.)

  return results;
}
