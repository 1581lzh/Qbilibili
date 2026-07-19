import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const execFileAsync = promisify(execFile);

export interface NormalizeResult {
  success: boolean;
  outputBuffer?: Buffer;
  error?: string;
}

/**
 * Find the FFmpeg binary path.
 * Works in both development and production (Next.js bundled) environments.
 */
async function findFfmpeg(): Promise<string | null> {
  // Try environment variable first (ffmpeg-static sets this)
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  // Try require.resolve to find the ffmpeg-static package
  try {
    const ffmpegStaticPath = require.resolve("ffmpeg-static");
    // ffmpeg-static exports a path to the binary, we need to find it relative to the package
    const pkgDir = ffmpegStaticPath.replace(/\/index\.js$/, "");
    const ffmpegPath = join(pkgDir, "ffmpeg");
    await access(ffmpegPath);
    return ffmpegPath;
  } catch {}

  // Fallback: try common locations
  const candidates = [
    join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    join("/home/lisi/bilibili/node_modules/ffmpeg-static/ffmpeg"),
  ];

  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch {}
  }

  return null;
}

/**
 * Normalize audio using two-pass loudnorm for better accuracy (±0.5 LU).
 * First pass: measure audio statistics. Second pass: apply normalization with measured values.
 */
async function normalizeAudioPasses(
  inputPath: string,
  outputPath: string,
  ffmpegPath: string
): Promise<void> {
  // First pass: measure audio statistics
  const { stderr } = await execFileAsync(ffmpegPath, [
    "-i", inputPath,
    "-af", "loudnorm=I=-14:TP=-2:LRA=7:print_format=json",
    "-f", "null",
    "-",
  ], { timeout: 300000 });

  // Parse measured values from JSON output (loudnorm prints to stderr)
  // Keep \n for structure, remove \r and other problematic control characters
  const cleaned = stderr.replace(/\r/g, "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "");
  // Find the JSON block that appears after [Parsed_loudnorm
  const loudnormIdx = cleaned.indexOf("[Parsed_loudnorm");
  const searchStr = loudnormIdx >= 0 ? cleaned.slice(loudnormIdx) : cleaned;
  const jsonMatch = searchStr.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse loudnorm measurement");
  const measured = JSON.parse(jsonMatch[0]);
  const { input_i, input_tp, input_lra, input_thresh } = measured;
  if (input_i == null || input_tp == null || input_lra == null || input_thresh == null) {
    throw new Error("Incomplete loudnorm measurement data");
  }

  // Skip if measured values are invalid (e.g. no audio track, silent audio)
  if (input_i === "-inf" || input_i === "-nan" || Number(input_i) < -100) {
    console.log(`[AudioNormalize] Skipping: measured loudness ${input_i} LUFS is too low`);
    // Just copy the file as-is
    await execFileAsync(ffmpegPath, [
      "-i", inputPath,
      "-c", "copy",
      "-y",
      outputPath,
    ], { timeout: 300000 });
    return;
  }

  // Second pass: normalize with measured values
  await execFileAsync(ffmpegPath, [
    "-i", inputPath,
    "-af", `loudnorm=I=-14:TP=-2:LRA=7:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:linear=true`,
    "-c:v", "copy",
    "-y",
    outputPath,
  ], { timeout: 300000 });
}

/**
 * Normalize audio loudness using FFmpeg loudnorm filter (EBU R128 standard).
 * Target: -14 LUFS (streaming platform standard).
 * Only processes audio track, video is copied without re-encoding.
 */
export async function normalizeAudio(inputBuffer: Buffer): Promise<NormalizeResult> {
  const ffmpegPath = await findFfmpeg();
  if (!ffmpegPath) {
    return { success: false, error: "FFmpeg not available" };
  }

  const tmpId = randomBytes(8).toString("hex");
  const inputPath = join(tmpdir(), `input_${tmpId}.mp4`);
  const outputPath = join(tmpdir(), `output_${tmpId}.mp4`);

  try {
    // Stream write input buffer to temp file (avoids holding full buffer + file descriptor)
    await pipeline(
      Readable.from(inputBuffer),
      createWriteStream(inputPath)
    );

    await normalizeAudioPasses(inputPath, outputPath, ffmpegPath);

    const outputBuffer = await readFile(outputPath);
    return { success: true, outputBuffer };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Audio normalization failed:", msg);
    return { success: false, error: msg };
  } finally {
    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
  }
}

/**
 * Normalize audio from a remote URL without buffering the entire file in memory.
 * Downloads → temp file → FFmpeg → temp output → read result.
 */
export async function normalizeAudioFromUrl(videoUrl: string): Promise<NormalizeResult> {
  const ffmpegPath = await findFfmpeg();
  if (!ffmpegPath) {
    return { success: false, error: "FFmpeg not available" };
  }

  const tmpId = randomBytes(8).toString("hex");
  const inputPath = join(tmpdir(), `input_${tmpId}.mp4`);
  const outputPath = join(tmpdir(), `output_${tmpId}.mp4`);

  try {
    // Stream download directly to temp file
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    if (!response.body) throw new Error("No response body");

    // Check content type to avoid downloading HTML error pages
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      throw new Error(`URL returned non-video content: ${contentType}`);
    }

    await pipeline(
      Readable.fromWeb(response.body as any),
      createWriteStream(inputPath)
    );

    await normalizeAudioPasses(inputPath, outputPath, ffmpegPath);

    const outputBuffer = await readFile(outputPath);
    return { success: true, outputBuffer };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Audio normalization from URL failed:", msg);
    return { success: false, error: msg };
  } finally {
    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
  }
}

/**
 * Check if FFmpeg is available.
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  const path = await findFfmpeg();
  return !!path;
}
