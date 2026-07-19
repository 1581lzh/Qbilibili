import { db } from "./db";
import { normalizeAudioFromUrl } from "./audio-normalize";
import { getVodPlayUrl } from "./vod";
import client from "./oss";

const PROGRESS_ID = "singleton";
const MAX_RETRIES = 2;
const PROCESS_INTERVAL_MS = 5000;
const MAX_CONCURRENT = 2;

interface QueueItem {
  videoId: string;
  retries: number;
  status: "pending" | "processing";
}

interface RenormalizeProgress {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  isRunning: boolean;
}

interface QueueState {
  queue: Map<string, QueueItem>;
  activeCount: number;
  intervalId: NodeJS.Timeout | null;
  renormalizeCancelled: boolean;
  started: boolean;
}

// All mutable state lives on globalThis so Turbopack multi-chunk bundles share it
const g = globalThis as unknown as { __audioQueueState?: QueueState };
if (!g.__audioQueueState) {
  g.__audioQueueState = {
    queue: new Map(),
    activeCount: 0,
    intervalId: null,
    renormalizeCancelled: false,
    started: false,
  };
}
const state = g.__audioQueueState;

export function addToQueue(videoId: string): void {
  if (!state.queue.has(videoId)) {
    state.queue.set(videoId, { videoId, retries: 0, status: "pending" });
    console.log(`[AudioQueue] Added video ${videoId} to queue`);
  }
}

export function clearQueue(): void {
  state.renormalizeCancelled = true;
  state.queue.clear();
  state.activeCount = 0;
  console.log("[AudioQueue] Queue cleared");
}

export function resetCancelled(): void {
  state.renormalizeCancelled = false;
}

export function getQueuedVideoIds(): Set<string> {
  return new Set(state.queue.keys());
}

export async function startRenormalizeTracking(total: number): Promise<void> {
  await db.renormalizeProgress.upsert({
    where: { id: PROGRESS_ID },
    update: { total, completed: 0, failed: 0, pending: total, isRunning: true },
    create: { id: PROGRESS_ID, total, completed: 0, failed: 0, pending: total, isRunning: true },
  });
}

export async function updateRenormalizeProgress(status: "completed" | "failed"): Promise<void> {
  const progress = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
  if (!progress) return;

  await db.renormalizeProgress.update({
    where: { id: PROGRESS_ID },
    data: {
      completed: progress.completed + (status === "completed" ? 1 : 0),
      failed: progress.failed + (status === "failed" ? 1 : 0),
      pending: Math.max(0, progress.pending - 1),
      isRunning: progress.completed + progress.failed + 1 < progress.total,
    },
  });
}

export async function getRenormalizeProgress(): Promise<RenormalizeProgress> {
  const progress = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
  if (!progress) return { total: 0, completed: 0, failed: 0, processing: 0, pending: 0, isRunning: false };

  return {
    total: progress.total,
    completed: progress.completed,
    failed: progress.failed,
    processing: progress.isRunning ? Math.min(2, progress.pending) : 0,
    pending: progress.pending,
    isRunning: progress.isRunning,
  };
}

async function processItem(item: QueueItem): Promise<void> {
  if (state.renormalizeCancelled) {
    state.queue.delete(item.videoId);
    return;
  }

  item.status = "processing";
  console.log(`[AudioQueue] Processing video ${item.videoId}`);

  try {
    const video = await db.video.findUnique({ where: { id: item.videoId } });
    if (!video) { state.queue.delete(item.videoId); return; }

    let videoUrl = video.videoUrl;

    // Fix local paths: convert /uploads/... to full URL
    if (videoUrl && videoUrl.startsWith("/")) {
      videoUrl = `https://your-domain.com${videoUrl}`;
    }

    if (!videoUrl && video.vodVideoId) {
      console.log(`[AudioQueue] Fetching VOD play URL for video ${video.id}`);
      const playInfo = await getVodPlayUrl(video.vodVideoId);
      if (!playInfo || !playInfo.playURL) {
        console.log(`[AudioQueue] No play URL available for VOD video ${video.vodVideoId}`);
        state.queue.delete(item.videoId);
        const p = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
        if (p?.isRunning) await updateRenormalizeProgress("completed");
        return;
      }
      videoUrl = playInfo.playURL;
    }

    if (!videoUrl && video.musicUrl) {
      // Clean control characters from music URL
      videoUrl = video.musicUrl.replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();
    }

    if (!videoUrl) {
      console.log(`[AudioQueue] Skipping video ${video.id}: no video or music URL`);
      state.queue.delete(item.videoId);
      const p = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
      if (p?.isRunning) await updateRenormalizeProgress("completed");
      return;
    }

    const result = await normalizeAudioFromUrl(videoUrl);
    if (result.success && result.outputBuffer) {
      const isImageText = video.postType === "image_text";
      const normalizedKey = isImageText ? `music/normalized_${video.id}.m4a` : `videos/normalized_${video.id}.mp4`;
      const contentType = isImageText ? "audio/mp4" : "video/mp4";
      const ossResult = await client.put(normalizedKey, result.outputBuffer, { headers: { "Content-Type": contentType } });

      await db.video.update({ where: { id: video.id }, data: { audioNormalized: true, normalizedUrl: ossResult.url } });

      console.log(`[AudioQueue] Successfully normalized video ${video.id}`);
      state.queue.delete(item.videoId);
      const p = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
      if (p?.isRunning) await updateRenormalizeProgress("completed");
    } else {
      throw new Error(result.error || "Normalization failed");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[AudioQueue] Error processing video ${item.videoId} (attempt ${item.retries + 1}/${MAX_RETRIES + 1}):`, errorMsg);
    item.retries++;
    item.status = "pending";

    if (item.retries > MAX_RETRIES) {
      console.error(`[AudioQueue] GIVING UP on video ${item.videoId} after ${MAX_RETRIES + 1} attempts. Last error: ${errorMsg}`);
      state.queue.delete(item.videoId);
      const p = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
      if (p?.isRunning) await updateRenormalizeProgress("failed");
    }
  }
}

async function backfillQueue(): Promise<void> {
  try {
    const queuedIds = getQueuedVideoIds();
    const videos = await db.video.findMany({
      where: {
        audioNormalized: false,
        id: { notIn: Array.from(queuedIds) },
        OR: [{ videoUrl: { not: "" } }, { vodVideoId: { not: null } }, { musicUrl: { not: null } }],
      },
      select: { id: true },
    });
    for (const v of videos) addToQueue(v.id);
    if (videos.length > 0) console.log(`[AudioQueue] Backfilled ${videos.length} un-normalized videos`);
  } catch (error) {
    console.error("[AudioQueue] Backfill failed:", error);
  }
}

async function resumeRenormalizeQueue(): Promise<void> {
  try {
    const progress = await db.renormalizeProgress.findUnique({ where: { id: PROGRESS_ID } });
    if (!progress || !progress.isRunning || progress.pending <= 0) return;

    console.log(`[AudioQueue] Resuming renormalize: ${progress.pending} videos pending`);
    const queuedIds = getQueuedVideoIds();
    const videos = await db.video.findMany({
      where: { audioNormalized: true, id: { notIn: Array.from(queuedIds) } },
      select: { id: true },
    });
    for (const v of videos) addToQueue(v.id);
    console.log(`[AudioQueue] Re-queued ${videos.length} videos for renormalize`);
  } catch (error) {
    console.error("[AudioQueue] Resume renormalize failed:", error);
  }
}

export function startQueueProcessor(): void {
  if (state.started) return;
  state.started = true;

  backfillQueue();
  resumeRenormalizeQueue();

  state.intervalId = setInterval(async () => {
    const pendingItems: QueueItem[] = [];
    for (const item of state.queue.values()) {
      if (item.status === "pending") pendingItems.push(item);
    }

    const slotsAvailable = MAX_CONCURRENT - state.activeCount;
    if (slotsAvailable <= 0 || pendingItems.length === 0) return;

    const toProcess = pendingItems.slice(0, slotsAvailable);
    state.activeCount += toProcess.length;

    await Promise.allSettled(
      toProcess.map(async (item) => {
        try {
          await processItem(item);
        } finally {
          state.activeCount--;
        }
      })
    );
  }, PROCESS_INTERVAL_MS);

  console.log("[AudioQueue] Queue processor started (concurrency: 2)");
}

export function stopQueueProcessor(): void {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.started = false;
    console.log("[AudioQueue] Queue processor stopped");
  }
}

export function getQueueStatus(): { pending: number; processing: number } {
  let pending = 0;
  let processing = 0;
  for (const item of state.queue.values()) {
    if (item.status === "pending") pending++;
    else if (item.status === "processing") processing++;
  }
  return { pending, processing };
}
